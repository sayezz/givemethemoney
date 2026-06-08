#ifndef POSITIONS_CONTROLLER_H
#define POSITIONS_CONTROLLER_H

#include "oatpp/web/server/api/ApiController.hpp"
#include "oatpp/core/macro/codegen.hpp"
#include "oatpp/core/macro/component.hpp"
#include "../dto/DTOs.hpp"
#include "../database/Database.hpp"
#include <memory>

#include OATPP_CODEGEN_BEGIN(ApiController)

class PositionsController : public oatpp::web::server::api::ApiController {
public:
  PositionsController(const std::shared_ptr<ObjectMapper>& objectMapper,
                      std::shared_ptr<Database> database)
    : oatpp::web::server::api::ApiController(objectMapper),
      m_database(database) {}

  ENDPOINT_INFO(getPositions) {
    info->summary = "Get all positions for user";
    info->addResponse<Object<PositionsListResponseDto>>(Status::CODE_200);
  }
  ENDPOINT("GET", "/api/positions", getPositions) {
    auto response = PositionsListResponseDto::createShared();
    response->success = true;
    response->positions = {};
    return createDtoResponse(Status::CODE_200, response);
  }

  ENDPOINT_INFO(createPosition) {
    info->summary = "Create new position";
    info->addConsumes<Object<PositionDto>>("application/json");
    info->addResponse<Object<PositionResponseDto>>(Status::CODE_201);
  }
  ENDPOINT("POST", "/api/positions", createPosition, BODY_DTO(Object<PositionDto>, body)) {
    auto response = PositionResponseDto::createShared();
    response->success = true;
    response->message = "Position created";
    return createDtoResponse(Status::CODE_201, response);
  }

private:
  std::shared_ptr<Database> m_database;
};

#include OATPP_CODEGEN_END(ApiController)

#endif // POSITIONS_CONTROLLER_H
