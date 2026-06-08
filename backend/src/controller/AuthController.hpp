#ifndef AUTH_CONTROLLER_H
#define AUTH_CONTROLLER_H

#include "oatpp/web/server/api/ApiController.hpp"
#include "oatpp/core/macro/codegen.hpp"
#include "oatpp/core/macro/component.hpp"
#include "../dto/DTOs.hpp"
#include "../database/Database.hpp"
#include <memory>

#include OATPP_CODEGEN_BEGIN(ApiController)

class AuthController : public oatpp::web::server::api::ApiController {
public:
  AuthController(const std::shared_ptr<ObjectMapper>& objectMapper,
                 std::shared_ptr<Database> database)
    : oatpp::web::server::api::ApiController(objectMapper),
      m_database(database) {}

  ENDPOINT_INFO(registerUser) {
    info->summary = "Register a new user";
    info->addConsumes<Object<AuthRequestDto>>("application/json");
    info->addResponse<Object<AuthResponseDto>>(Status::CODE_201);
    info->addResponse<Object<ErrorResponseDto>>(Status::CODE_400);
  }
  ENDPOINT("POST", "/api/auth/register", registerUser, BODY_DTO(Object<AuthRequestDto>, body)) {
    // Implementation
    return createDtoResponse(Status::CODE_201, AuthResponseDto::createShared());
  }

  ENDPOINT_INFO(login) {
    info->summary = "Login user";
    info->addConsumes<Object<AuthRequestDto>>("application/json");
    info->addResponse<Object<AuthResponseDto>>(Status::CODE_200);
    info->addResponse<Object<ErrorResponseDto>>(Status::CODE_401);
  }
  ENDPOINT("POST", "/api/auth/login", login, BODY_DTO(Object<AuthRequestDto>, body)) {
    // Implementation
    return createDtoResponse(Status::CODE_200, AuthResponseDto::createShared());
  }

private:
  std::shared_ptr<Database> m_database;
};

#include OATPP_CODEGEN_END(ApiController)

#endif // AUTH_CONTROLLER_H
