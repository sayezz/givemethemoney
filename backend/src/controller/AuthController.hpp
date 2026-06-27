#ifndef AUTH_CONTROLLER_H
#define AUTH_CONTROLLER_H

#include "oatpp/web/server/api/ApiController.hpp"
#include "oatpp/core/macro/codegen.hpp"
#include "oatpp/core/macro/component.hpp"
#include "../dto/DTOs.hpp"
#include "../database/Database.hpp"
#include "../repository/UserRepository.hpp"
#include "../utils/CorsUtils.hpp"
#include "../utils/PasswordUtils.hpp"
#include "../utils/JwtUtils.hpp"
#include <memory>
#include <cstdlib>

#include OATPP_CODEGEN_BEGIN(ApiController)

class AuthController : public oatpp::web::server::api::ApiController {
public:
  AuthController(const std::shared_ptr<ObjectMapper>& objectMapper,
                 std::shared_ptr<Database> database)
    : oatpp::web::server::api::ApiController(objectMapper),
      m_database(database),
      m_userRepository(std::make_shared<UserRepository>(database->getExecutor())) {
    const char* secret = std::getenv("JWT_SECRET");
    if (!secret || std::string(secret).empty()) {
      throw std::runtime_error("JWT_SECRET environment variable must be set");
    }
    m_jwtSecret = secret;
  }

  ENDPOINT_INFO(registerUser) {
    info->summary = "Register a new user";
    info->addConsumes<Object<AuthRequestDto>>("application/json");
    info->addResponse<Object<AuthResponseDto>>(Status::CODE_201, "application/json");
    info->addResponse<Object<ErrorResponseDto>>(Status::CODE_400, "application/json");
  }
  ENDPOINT("POST", "/api/auth/register", registerUser, BODY_DTO(Object<AuthRequestDto>, body)) {
    if (!body->email || body->email->empty() || !body->password || body->password->empty()) {
      return errorResponse(Status::CODE_400, "Email and password are required");
    }

    auto existingResult = m_userRepository->findByEmail(body->email);
    if (!existingResult->isSuccess()) {
      return errorResponse(Status::CODE_400, "Failed to check existing user");
    }
    auto existingRows = existingResult->fetch<oatpp::Vector<oatpp::Object<UserAuthRow>>>();
    if (existingRows->size() > 0) {
      return errorResponse(Status::CODE_400, "Email is already registered");
    }

    std::string passwordHash = PasswordUtils::hash(*body->password);

    auto createResult = m_userRepository->createUser(body->email, oatpp::String(passwordHash));
    if (!createResult->isSuccess()) {
      return errorResponse(Status::CODE_400, "Failed to create user");
    }
    auto createdRows = createResult->fetch<oatpp::Vector<oatpp::Object<UserDto>>>();
    if (createdRows->size() == 0) {
      return errorResponse(Status::CODE_400, "Failed to create user");
    }
    auto user = createdRows[0];

    std::string token = JwtUtils::encode(*user->id, *user->email, m_jwtSecret);

    auto response = AuthResponseDto::createShared();
    response->success = true;
    response->message = "Registration successful";
    response->token = token;
    response->user = user;

    return createCorsDtoResponse(Status::CODE_201, response);
  }

  ENDPOINT("OPTIONS", "/api/auth/register", optionsRegister) {
    return createCorsPreflightResponse();
  }

  ENDPOINT_INFO(login) {
    info->summary = "Login user";
    info->addConsumes<Object<AuthRequestDto>>("application/json");
    info->addResponse<Object<AuthResponseDto>>(Status::CODE_200, "application/json");
    info->addResponse<Object<ErrorResponseDto>>(Status::CODE_401, "application/json");
  }
  ENDPOINT("POST", "/api/auth/login", login, BODY_DTO(Object<AuthRequestDto>, body)) {
    if (!body->email || body->email->empty() || !body->password || body->password->empty()) {
      return errorResponse(Status::CODE_401, "Invalid email or password");
    }

    auto result = m_userRepository->findByEmail(body->email);
    if (!result->isSuccess()) {
      return errorResponse(Status::CODE_401, "Invalid email or password");
    }
    auto rows = result->fetch<oatpp::Vector<oatpp::Object<UserAuthRow>>>();
    if (rows->size() == 0) {
      return errorResponse(Status::CODE_401, "Invalid email or password");
    }

    auto userRow = rows[0];
    if (!PasswordUtils::verify(*body->password, *userRow->password_hash)) {
      return errorResponse(Status::CODE_401, "Invalid email or password");
    }

    std::string token = JwtUtils::encode(*userRow->id, *userRow->email, m_jwtSecret);

    auto user = UserDto::createShared();
    user->id = userRow->id;
    user->email = userRow->email;
    user->created_at = userRow->created_at;

    auto response = AuthResponseDto::createShared();
    response->success = true;
    response->message = "Login successful";
    response->token = token;
    response->user = user;

    return createCorsDtoResponse(Status::CODE_200, response);
  }

  ENDPOINT("OPTIONS", "/api/auth/login", optionsLogin) {
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

  std::shared_ptr<Database> m_database;
  std::shared_ptr<UserRepository> m_userRepository;
  std::string m_jwtSecret;
};

#include OATPP_CODEGEN_END(ApiController)

#endif // AUTH_CONTROLLER_H
