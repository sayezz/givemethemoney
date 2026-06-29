#ifndef POSITIONS_CONTROLLER_H
#define POSITIONS_CONTROLLER_H

#include "oatpp/web/server/api/ApiController.hpp"
#include "oatpp/core/macro/codegen.hpp"
#include "oatpp/core/macro/component.hpp"
#include "../dto/DTOs.hpp"
#include "../database/Database.hpp"
#include "../repository/PositionRepository.hpp"
#include "../utils/CorsUtils.hpp"
#include "../utils/EmailUtils.hpp"
#include "../utils/JwtUtils.hpp"
#include <memory>
#include <cstdlib>
#include <string>

#include OATPP_CODEGEN_BEGIN(ApiController)

class PositionsController : public oatpp::web::server::api::ApiController {
public:
  PositionsController(const std::shared_ptr<ObjectMapper>& objectMapper,
                      std::shared_ptr<Database> database)
    : oatpp::web::server::api::ApiController(objectMapper),
      m_database(database),
      m_positionRepository(std::make_shared<PositionRepository>(database->getExecutor())) {
    const char* secret = std::getenv("JWT_SECRET");
    if (!secret || std::string(secret).empty()) {
      throw std::runtime_error("JWT_SECRET environment variable must be set");
    }
    m_jwtSecret = secret;
  }

  ENDPOINT_INFO(getPositions) {
    info->summary = "Get all positions for user";
    info->addResponse<Object<PositionsListResponseDto>>(Status::CODE_200, "application/json");
    info->addResponse<Object<ErrorResponseDto>>(Status::CODE_401, "application/json");
  }
  ENDPOINT("GET", "/api/positions", getPositions, REQUEST(std::shared_ptr<IncomingRequest>, request)) {
    int userId = 0; std::string userEmail;
    auto authError = authenticate(request, userId, userEmail);
    if (authError) {
      return authError;
    }

    auto result = m_positionRepository->findByUserId(oatpp::Int32(userId));
    if (!result->isSuccess()) {
      return errorResponse(Status::CODE_401, "Failed to load positions");
    }

    auto response = PositionsListResponseDto::createShared();
    response->success = true;
    response->positions = result->fetch<oatpp::Vector<oatpp::Object<PositionDto>>>();
    return createCorsDtoResponse(Status::CODE_200, response);
  }

  ENDPOINT_INFO(createPosition) {
    info->summary = "Create new position";
    info->addConsumes<Object<PositionDto>>("application/json");
    info->addResponse<Object<PositionResponseDto>>(Status::CODE_201, "application/json");
    info->addResponse<Object<ErrorResponseDto>>(Status::CODE_400, "application/json");
    info->addResponse<Object<ErrorResponseDto>>(Status::CODE_401, "application/json");
  }
  ENDPOINT("POST", "/api/positions", createPosition,
           REQUEST(std::shared_ptr<IncomingRequest>, request),
           BODY_DTO(Object<PositionDto>, body)) {
    int userId = 0; std::string userEmail;
    auto authError = authenticate(request, userId, userEmail);
    if (authError) return authError;

    if (!body->name || body->name->empty() ||
        !body->ticker || body->ticker->empty() ||
        !body->quantity || !body->purchase_cost) {
      return errorResponse(Status::CODE_400, "name, ticker, quantity and purchase_cost are required");
    }

    oatpp::Float64 purchaseFee = body->purchase_fee ? body->purchase_fee : oatpp::Float64(0.0);
    oatpp::Float64 purchaseFeeFixed = body->purchase_fee_fixed ? body->purchase_fee_fixed : oatpp::Float64(0.0);
    oatpp::Float64 purchaseFeePercent = body->purchase_fee_percent ? body->purchase_fee_percent : oatpp::Float64(0.0);
    oatpp::Float64 sellFee = body->sell_fee ? body->sell_fee : oatpp::Float64(0.0);
    oatpp::Float64 sellFeeFixed = body->sell_fee_fixed ? body->sell_fee_fixed : oatpp::Float64(0.0);
    oatpp::Float64 sellFeePercent = body->sell_fee_percent ? body->sell_fee_percent : oatpp::Float64(0.0);
    oatpp::Float64 taxRate = body->tax_rate ? body->tax_rate : oatpp::Float64(26.375);
    oatpp::String quoteProvider = body->quote_provider && !body->quote_provider->empty()
      ? body->quote_provider : oatpp::String("yahoo");

    auto result = m_positionRepository->create(
      oatpp::Int32(userId),
      body->name,
      body->ticker,
      body->quantity,
      body->purchase_cost,
      purchaseFee,
      purchaseFeeFixed,
      purchaseFeePercent,
      sellFee,
      sellFeeFixed,
      sellFeePercent,
      taxRate,
      quoteProvider,
      body->purchase_date
    );

    if (!result->isSuccess()) {
      return errorResponse(Status::CODE_400, "Failed to create position");
    }

    auto rows = result->fetch<oatpp::Vector<oatpp::Object<PositionDto>>>();
    if (rows->size() == 0) {
      return errorResponse(Status::CODE_400, "Failed to create position");
    }

    auto response = PositionResponseDto::createShared();
    response->success = true;
    response->message = "Position created";
    response->position = rows[0];
    return createCorsDtoResponse(Status::CODE_201, response);
  }

  ENDPOINT("OPTIONS", "/api/positions", optionsPositions) {
    return createCorsPreflightResponse();
  }

  ENDPOINT("DELETE", "/api/positions/{id}", deletePosition,
           REQUEST(std::shared_ptr<IncomingRequest>, request),
           PATH(Int32, id)) {
    int userId = 0; std::string userEmail;
    auto authError = authenticate(request, userId, userEmail);
    if (authError) return authError;

    auto result = m_positionRepository->deleteById(id, oatpp::Int32(userId));
    if (!result->isSuccess()) {
      return errorResponse(Status::CODE_400, "Failed to delete position");
    }

    auto response = ErrorResponseDto::createShared();
    response->success = true;
    response->message = "Position deleted";
    return createCorsDtoResponse(Status::CODE_200, response);
  }

  ENDPOINT("OPTIONS", "/api/positions/{id}", optionsPositionById) {
    return createCorsPreflightResponse();
  }

  ENDPOINT("PATCH", "/api/positions/{id}/trailing-stop", patchTrailingStop,
           REQUEST(std::shared_ptr<IncomingRequest>, request),
           PATH(Int32, id),
           BODY_DTO(Object<TrailingStopRequestDto>, body)) {
    int userId = 0; std::string userEmail;
    auto authError = authenticate(request, userId, userEmail);
    if (authError) return authError;

    bool active = body->trailing_stop_active ? *body->trailing_stop_active : false;
    auto result = m_positionRepository->setTrailingStop(id, oatpp::Int32(userId), oatpp::Boolean(active));
    if (!result->isSuccess()) {
      return errorResponse(Status::CODE_400, "Failed to update trailing stop");
    }

    auto response = ErrorResponseDto::createShared();
    response->success = true;
    response->message = "Trailing stop updated";
    return createCorsDtoResponse(Status::CODE_200, response);
  }

  ENDPOINT("OPTIONS", "/api/positions/{id}/trailing-stop", optionsTrailingStop) {
    return createCorsPreflightResponse();
  }

  ENDPOINT("PATCH", "/api/positions/{id}/provider", patchProvider,
           REQUEST(std::shared_ptr<IncomingRequest>, request),
           PATH(Int32, id),
           BODY_DTO(Object<UpdateProviderRequestDto>, body)) {
    int userId = 0; std::string userEmail;
    auto authError = authenticate(request, userId, userEmail);
    if (authError) return authError;

    oatpp::String provider = body->quote_provider && !body->quote_provider->empty()
      ? body->quote_provider : oatpp::String("yahoo");

    auto result = m_positionRepository->setQuoteProvider(id, oatpp::Int32(userId), provider);
    if (!result->isSuccess()) {
      return errorResponse(Status::CODE_400, "Failed to update provider");
    }

    auto response = ErrorResponseDto::createShared();
    response->success = true;
    response->message = "Provider updated";
    return createCorsDtoResponse(Status::CODE_200, response);
  }

  ENDPOINT("OPTIONS", "/api/positions/{id}/provider", optionsProvider) {
    return createCorsPreflightResponse();
  }

  ENDPOINT("POST", "/api/positions/{id}/notify-trailing-stop", notifyTrailingStop,
           REQUEST(std::shared_ptr<IncomingRequest>, request),
           PATH(Int32, id),
           BODY_DTO(Object<NotifyTrailingStopRequestDto>, body)) {
    int userId = 0; std::string userEmail;
    auto authError = authenticate(request, userId, userEmail);
    if (authError) return authError;

    auto posResult = m_positionRepository->findById(id, oatpp::Int32(userId));
    if (!posResult->isSuccess()) {
      return errorResponse(Status::CODE_404, "Position not found");
    }
    auto rows = posResult->fetch<oatpp::Vector<oatpp::Object<PositionDto>>>();
    if (rows->empty()) {
      return errorResponse(Status::CODE_404, "Position not found");
    }
    auto pos = rows[0];

    if (pos->ts_notification_sent && *pos->ts_notification_sent) {
      auto resp = ErrorResponseDto::createShared();
      resp->success = true;
      resp->message = "Already notified";
      return createCorsDtoResponse(Status::CODE_200, resp);
    }

    // Mark as sent first to prevent duplicate sends on concurrent requests
    m_positionRepository->setNotificationSent(id, oatpp::Int32(userId));

    // Send email if SMTP is configured
    const char* smtpUrl  = std::getenv("SMTP_URL");
    const char* smtpUser = std::getenv("SMTP_USER");
    const char* smtpPass = std::getenv("SMTP_PASS");
    // Recipient is the logged-in user's email (from JWT), not a fixed env var
    const std::string& notifyTo = userEmail;

    std::string emailErr;
    if (smtpUrl && smtpUser && smtpPass && !notifyTo.empty() &&
        std::string(smtpUrl).size() > 0) {

      std::string ticker = pos->ticker ? std::string(*pos->ticker) : "?";
      std::string name   = pos->name   ? std::string(*pos->name)   : "?";
      double currentPrice = body->current_price ? *body->current_price : 0.0;

      double qty      = pos->quantity      ? *pos->quantity      : 0.0;
      double pCost    = pos->purchase_cost ? *pos->purchase_cost : 0.0;
      double pFee     = pos->purchase_fee  ? *pos->purchase_fee  : 0.0;
      double sfFixed  = pos->sell_fee_fixed   ? *pos->sell_fee_fixed   : 0.0;
      double sfPct    = pos->sell_fee_percent ? *pos->sell_fee_percent : 0.0;
      double taxRate  = pos->tax_rate ? *pos->tax_rate : 26.375;

      double acq      = pCost + pFee;
      double sfpd     = sfPct / 100.0;
      double trd      = taxRate / 100.0;
      double sdenom   = qty * (1.0 - sfpd);
      double tsAct    = 0.0;
      if (sdenom > 0 && trd < 1.0) {
        tsAct = (acq * (1.0 + 0.01 - trd) / (1.0 - trd) + sfFixed) / sdenom;
      }

      char buf[512];
      snprintf(buf, sizeof(buf),
        "Hallo,\n\n"
        "der Trailing Stop fuer %s (%s) wurde erreicht!\n\n"
        "Aktueller Kurs:       %.2f EUR\n"
        "TS-Aktivierung ab:    %.2f EUR\n\n"
        "Empfohlene Stoppkurse (vom aktuellen Kurs):\n"
        "   8%%  Stopp: %.2f EUR\n"
        "  10%%  Stopp: %.2f EUR\n"
        "  12%%  Stopp: %.2f EUR\n\n"
        "Bitte Trailing Stop jetzt setzen!\n\n"
        "-- GiveMeTheMoney\n",
        ticker.c_str(), name.c_str(),
        currentPrice, tsAct,
        currentPrice * 0.92,
        currentPrice * 0.90,
        currentPrice * 0.88
      );

      std::string fromAddr = smtpUser;
      std::string subject  = "Trailing Stop erreicht: " + ticker + " bei " +
                             std::to_string((int)currentPrice) + " EUR";

      emailErr = EmailUtils::send(smtpUrl, smtpUser, smtpPass, fromAddr, notifyTo.c_str(), subject, std::string(buf));
    } else {
      emailErr = "SMTP not configured";
    }

    auto resp = ErrorResponseDto::createShared();
    resp->success = true;
    resp->message = emailErr.empty() ? "Notification sent" : ("Email error: " + emailErr);
    return createCorsDtoResponse(Status::CODE_200, resp);
  }

  ENDPOINT("OPTIONS", "/api/positions/{id}/notify-trailing-stop", optionsNotifyTS) {
    return createCorsPreflightResponse();
  }

private:
  template <class T>
  std::shared_ptr<OutgoingResponse> createCorsDtoResponse(const Status& status, const T& dto) {
    auto response = createDtoResponse(status, dto);
    CorsUtils::apply(response);
    return response;
  }

  std::shared_ptr<OutgoingResponse> createCorsPreflightResponse() {
    auto response = createResponse(Status::CODE_204, "");
    CorsUtils::apply(response);
    return response;
  }

  std::shared_ptr<OutgoingResponse> errorResponse(const Status& status, const std::string& message) {
    auto error = ErrorResponseDto::createShared();
    error->success = false;
    error->message = message;
    return createCorsDtoResponse(status, error);
  }

  std::shared_ptr<OutgoingResponse> authenticate(const std::shared_ptr<IncomingRequest>& request, int& userId, std::string& email) {
    auto authHeader = request->getHeader("Authorization");
    if (!authHeader) {
      return errorResponse(Status::CODE_401, "Missing Authorization header");
    }

    std::string headerValue = *authHeader;
    const std::string prefix = "Bearer ";
    if (headerValue.rfind(prefix, 0) != 0) {
      return errorResponse(Status::CODE_401, "Invalid Authorization header");
    }

    std::string token = headerValue.substr(prefix.length());
    if (!JwtUtils::verify(token, m_jwtSecret, userId, email)) {
      return errorResponse(Status::CODE_401, "Invalid or expired token");
    }

    return nullptr;
  }

  std::shared_ptr<Database> m_database;
  std::shared_ptr<PositionRepository> m_positionRepository;
  std::string m_jwtSecret;
};

#include OATPP_CODEGEN_END(ApiController)

#endif // POSITIONS_CONTROLLER_H
