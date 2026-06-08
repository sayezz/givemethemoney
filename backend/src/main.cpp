#include "oatpp/web/server/HttpConnectionHandler.hpp"
#include "oatpp/web/server/HttpRouter.hpp"
#include "oatpp/web/mime/ContentMappers.hpp"
#include "oatpp/web/server/Server.hpp"
#include "oatpp/core/utils/ConversionUtils.hpp"
#include "oatpp/core/macro/component.hpp"

#include "controller/AuthController.hpp"
#include "controller/PositionsController.hpp"
#include "database/Database.hpp"

#include <iostream>
#include <cstdlib>

class AppComponent {
public:
  COMPONENT(std::shared_ptr<oatpp::web::mime::ContentMappers>, contentMappers) {
    auto mappers = std::make_shared<oatpp::web::mime::ContentMappers>();
    mappers->putMapper("application/json", std::make_shared<oatpp::web::mime::mapping::ObjectMapper>());
    return mappers;
  }

  COMPONENT(std::shared_ptr<oatpp::web::server::HttpRouter>, httpRouter) {
    return std::make_shared<oatpp::web::server::HttpRouter>();
  }

  COMPONENT(std::shared_ptr<oatpp::web::server::HttpConnectionHandler>, httpConnectionHandler) {
    OATPP_COMPONENT(std::shared_ptr<oatpp::web::server::HttpRouter>, router);
    OATPP_COMPONENT(std::shared_ptr<oatpp::web::mime::ContentMappers>, mappers);
    return std::make_shared<oatpp::web::server::HttpConnectionHandler>(router, mappers);
  }

  COMPONENT(std::shared_ptr<oatpp::network::Server>, server) {
    OATPP_COMPONENT(std::shared_ptr<oatpp::web::server::HttpConnectionHandler>, connectionHandler);
    auto server = std::make_shared<oatpp::network::Server>(
      std::make_shared<oatpp::network::tcp::server::AcceptorFactory>("0.0.0.0", 3001),
      connectionHandler
    );
    return server;
  }

  COMPONENT(std::shared_ptr<Database>, database) {
    auto db = std::make_shared<Database>(
      std::getenv("DB_HOST") ? std::getenv("DB_HOST") : "localhost",
      std::stoi(std::getenv("DB_PORT") ? std::getenv("DB_PORT") : "5432"),
      std::getenv("DB_USER") ? std::getenv("DB_USER") : "tracker_user",
      std::getenv("DB_PASSWORD") ? std::getenv("DB_PASSWORD") : "tracker_password",
      std::getenv("DB_NAME") ? std::getenv("DB_NAME") : "investment_tracker"
    );
    return db;
  }
};

int main() {
  oatpp::base::Environment::init();

  AppComponent component;

  OATPP_COMPONENT(std::shared_ptr<oatpp::web::server::HttpRouter>, router);
  OATPP_COMPONENT(std::shared_ptr<Database>, database);

  auto objectMapper = std::make_shared<oatpp::web::mime::mapping::ObjectMapper>();

  auto authController = std::make_shared<AuthController>(objectMapper, database);
  auto positionsController = std::make_shared<PositionsController>(objectMapper, database);

  router->addController(authController);
  router->addController(positionsController);

  OATPP_COMPONENT(std::shared_ptr<oatpp::network::Server>, server);

  std::cout << "Starting Investment Tracker Backend on port 3001..." << std::endl;

  server->run();

  oatpp::base::Environment::destroy();

  return 0;
}
