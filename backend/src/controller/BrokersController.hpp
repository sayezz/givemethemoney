#ifndef BROKERS_CONTROLLER_H
#define BROKERS_CONTROLLER_H

#include "oatpp/web/server/api/ApiController.hpp"
#include "oatpp/core/macro/codegen.hpp"
#include "../dto/DTOs.hpp"
#include "../database/Database.hpp"
#include "../repository/BrokerRepository.hpp"
#include "../utils/CorsUtils.hpp"
#include "../utils/JwtUtils.hpp"
#include <memory>
#include <cstdlib>
#include <string>

#include OATPP_CODEGEN_BEGIN(ApiController)

class BrokersController : public oatpp::web::server::api::ApiController {
public:
  BrokersController(const std::shared_ptr<ObjectMapper>& objectMapper,
                    std::shared_ptr<Database> database)
    : oatpp::web::server::api::ApiController(objectMapper),
      m_brokerRepository(std::make_shared<BrokerRepository>(database->getExecutor())) {
    const char* secret = std::getenv("JWT_SECRET");
    if (!secret || std::string(secret).empty()) {
      throw std::runtime_error("JWT_SECRET environment variable must be set");
    }
    m_jwtSecret = secret;
  }

  ENDPOINT("GET", "/api/brokers", getBrokers,
           REQUEST(std::shared_ptr<IncomingRequest>, request)) {
    int userId = 0;
    auto authError = authenticate(request, userId);
    if (authError) return authError;
    auto result = m_brokerRepository->findByUserId(oatpp::Int32(userId));
    if (!result->isSuccess()) return errorResponse(Status::CODE_400, "Failed to load brokers");
    auto response = BrokersListResponseDto::createShared();
    response->success = true;
    response->brokers = result->fetch<oatpp::Vector<oatpp::Object<BrokerDto>>>();
    return createCorsDtoResponse(Status::CODE_200, response);
  }

  ENDPOINT("POST", "/api/brokers", createBroker,
           REQUEST(std::shared_ptr<IncomingRequest>, request),
           BODY_DTO(Object<BrokerRequestDto>, body)) {
    int userId = 0;
    auto authError = authenticate(request, userId);
    if (authError) return authError;
    if (!body->name || body->name->empty()) return errorResponse(Status::CODE_400, "Name is required");

    bool isDefault = body->is_default ? *body->is_default : false;
    if (isDefault) m_brokerRepository->clearDefault(oatpp::Int32(userId));

    auto result = m_brokerRepository->create(
      oatpp::Int32(userId), body->name,
      body->buy_fee_fixed ? body->buy_fee_fixed : oatpp::Float64(0.0),
      body->buy_fee_percent ? body->buy_fee_percent : oatpp::Float64(0.0),
      body->sell_fee_fixed ? body->sell_fee_fixed : oatpp::Float64(0.0),
      body->sell_fee_percent ? body->sell_fee_percent : oatpp::Float64(0.0),
      body->tax_rate ? body->tax_rate : oatpp::Float64(26.375),
      oatpp::Boolean(isDefault));
    if (!result->isSuccess()) return errorResponse(Status::CODE_400, "Failed to create broker");
    auto rows = result->fetch<oatpp::Vector<oatpp::Object<BrokerDto>>>();
    if (rows->size() == 0) return errorResponse(Status::CODE_400, "Failed to create broker");
    auto response = BrokerResponseDto::createShared();
    response->success = true; response->message = "Broker created"; response->broker = rows[0];
    return createCorsDtoResponse(Status::CODE_201, response);
  }

  ENDPOINT("PUT", "/api/brokers/{id}", updateBroker,
           REQUEST(std::shared_ptr<IncomingRequest>, request),
           PATH(Int32, id),
           BODY_DTO(Object<BrokerRequestDto>, body)) {
    int userId = 0;
    auto authError = authenticate(request, userId);
    if (authError) return authError;
    if (!body->name || body->name->empty()) return errorResponse(Status::CODE_400, "Name is required");

    bool isDefault = body->is_default ? *body->is_default : false;
    if (isDefault) m_brokerRepository->clearDefault(oatpp::Int32(userId));

    auto result = m_brokerRepository->update(
      id, oatpp::Int32(userId), body->name,
      body->buy_fee_fixed ? body->buy_fee_fixed : oatpp::Float64(0.0),
      body->buy_fee_percent ? body->buy_fee_percent : oatpp::Float64(0.0),
      body->sell_fee_fixed ? body->sell_fee_fixed : oatpp::Float64(0.0),
      body->sell_fee_percent ? body->sell_fee_percent : oatpp::Float64(0.0),
      body->tax_rate ? body->tax_rate : oatpp::Float64(26.375),
      oatpp::Boolean(isDefault));
    if (!result->isSuccess()) return errorResponse(Status::CODE_400, "Failed to update broker");
    auto rows = result->fetch<oatpp::Vector<oatpp::Object<BrokerDto>>>();
    if (rows->size() == 0) return errorResponse(Status::CODE_404, "Broker not found");
    auto response = BrokerResponseDto::createShared();
    response->success = true; response->message = "Broker updated"; response->broker = rows[0];
    return createCorsDtoResponse(Status::CODE_200, response);
  }

  ENDPOINT("DELETE", "/api/brokers/{id}", deleteBroker,
           REQUEST(std::shared_ptr<IncomingRequest>, request),
           PATH(Int32, id)) {
    int userId = 0;
    auto authError = authenticate(request, userId);
    if (authError) return authError;
    auto result = m_brokerRepository->deleteById(id, oatpp::Int32(userId));
    if (!result->isSuccess()) return errorResponse(Status::CODE_400, "Failed to delete broker");
    auto response = ErrorResponseDto::createShared();
    response->success = true; response->message = "Broker deleted";
    return createCorsDtoResponse(Status::CODE_200, response);
  }

  ENDPOINT("OPTIONS", "/api/brokers", optionsBrokers) { return createCorsPreflightResponse(); }
  ENDPOINT("OPTIONS", "/api/brokers/{id}", optionsBrokerById) { return createCorsPreflightResponse(); }

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
    error->success = false; error->message = message;
    return createCorsDtoResponse(status, error);
  }
  std::shared_ptr<OutgoingResponse> authenticate(const std::shared_ptr<IncomingRequest>& request, int& userId) {
    auto authHeader = request->getHeader("Authorization");
    if (!authHeader) return errorResponse(Status::CODE_401, "Missing Authorization header");
    std::string headerValue = *authHeader;
    const std::string prefix = "Bearer ";
    if (headerValue.rfind(prefix, 0) != 0) return errorResponse(Status::CODE_401, "Invalid Authorization header");
    std::string token = headerValue.substr(prefix.length());
    std::string email;
    if (!JwtUtils::verify(token, m_jwtSecret, userId, email)) return errorResponse(Status::CODE_401, "Invalid or expired token");
    return nullptr;
  }

  std::shared_ptr<BrokerRepository> m_brokerRepository;
  std::string m_jwtSecret;
};

#include OATPP_CODEGEN_END(ApiController)

#endif // BROKERS_CONTROLLER_H
