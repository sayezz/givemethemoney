#ifndef DOMAIN_MODEL_DTOs_H
#define DOMAIN_MODEL_DTOs_H

#include "oatpp/core/Types.hpp"
#include "oatpp/core/macro/codegen.hpp"

/* Forward declaration of DTOs */

#include OATPP_CODEGEN_BEGIN(DTO)

class UserDto : public oatpp::DTO {
  DTO_INIT(UserDto, DTO)

  DTO_FIELD(Int32, id);
  DTO_FIELD(String, email);
  DTO_FIELD(String, created_at);
};

class AuthRequestDto : public oatpp::DTO {
  DTO_INIT(AuthRequestDto, DTO)

  DTO_FIELD(String, email);
  DTO_FIELD(String, password);
};

class AuthResponseDto : public oatpp::DTO {
  DTO_INIT(AuthResponseDto, DTO)

  DTO_FIELD(Boolean, success);
  DTO_FIELD(String, message);
  DTO_FIELD(String, token);
  DTO_FIELD(Object<UserDto>, user);
};

class ErrorResponseDto : public oatpp::DTO {
  DTO_INIT(ErrorResponseDto, DTO)

  DTO_FIELD(Boolean, success);
  DTO_FIELD(String, message);
};

class PositionDto : public oatpp::DTO {
  DTO_INIT(PositionDto, DTO)

  DTO_FIELD(Int32, id);
  DTO_FIELD(String, name);
  DTO_FIELD(String, ticker);
  DTO_FIELD(Float64, quantity);
  DTO_FIELD(Float64, purchase_cost);
  DTO_FIELD(Float64, purchase_fee);
  DTO_FIELD(Float64, sell_fee);
  DTO_FIELD(Float64, tax_rate);
  DTO_FIELD(Float64, highest_price, "highest_price");
  DTO_FIELD(Float64, trailing_stop_percent, "trailing_stop_percent");
  DTO_FIELD(String, created_at);
};

class PositionsListResponseDto : public oatpp::DTO {
  DTO_INIT(PositionsListResponseDto, DTO)

  DTO_FIELD(Boolean, success);
  DTO_FIELD(Vector<Object<PositionDto>>, positions);
};

class PositionResponseDto : public oatpp::DTO {
  DTO_INIT(PositionResponseDto, DTO)

  DTO_FIELD(Boolean, success);
  DTO_FIELD(String, message);
  DTO_FIELD(Object<PositionDto>, position);
};

class HealthResponseDto : public oatpp::DTO {
  DTO_INIT(HealthResponseDto, DTO)

  DTO_FIELD(String, status);
};

#include OATPP_CODEGEN_END(DTO)

#endif // DOMAIN_MODEL_DTOs_H
