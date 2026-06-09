#ifndef CORS_UTILS_H
#define CORS_UTILS_H

#include "oatpp/web/protocol/http/outgoing/Response.hpp"

#include <memory>

namespace CorsUtils {

inline void apply(const std::shared_ptr<oatpp::web::protocol::http::outgoing::Response>& response) {
  response->putHeader("Access-Control-Allow-Origin", "*");
  response->putHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  response->putHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

} // namespace CorsUtils

#endif // CORS_UTILS_H