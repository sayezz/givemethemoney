#include "oatpp/web/server/HttpConnectionHandler.hpp"
#include "oatpp/web/server/HttpRouter.hpp"
#include "oatpp/network/Server.hpp"
#include "oatpp/network/tcp/server/ConnectionProvider.hpp"
#include "oatpp/parser/json/mapping/ObjectMapper.hpp"
#include "oatpp/core/utils/ConversionUtils.hpp"
#include "oatpp/core/macro/component.hpp"

#include "controller/AuthController.hpp"
#include "controller/PositionsController.hpp"
#include "controller/StocksController.hpp"
#include "database/Database.hpp"
#include "repository/MigrationRepository.hpp"

#include <curl/curl.h>

#include <iostream>
#include <cstdlib>

class AppComponent {
public:

  OATPP_CREATE_COMPONENT(std::shared_ptr<oatpp::network::ServerConnectionProvider>, serverConnectionProvider)([] {
    return oatpp::network::tcp::server::ConnectionProvider::createShared({"0.0.0.0", 3001, oatpp::network::Address::IP_4});
  }());

  OATPP_CREATE_COMPONENT(std::shared_ptr<oatpp::web::server::HttpRouter>, httpRouter)([] {
    return oatpp::web::server::HttpRouter::createShared();
  }());

  OATPP_CREATE_COMPONENT(std::shared_ptr<oatpp::network::ConnectionHandler>, serverConnectionHandler)([] {
    OATPP_COMPONENT(std::shared_ptr<oatpp::web::server::HttpRouter>, router);
    return oatpp::web::server::HttpConnectionHandler::createShared(router);
  }());

  OATPP_CREATE_COMPONENT(std::shared_ptr<oatpp::data::mapping::ObjectMapper>, apiObjectMapper)([] {
    return oatpp::parser::json::mapping::ObjectMapper::createShared();
  }());

  OATPP_CREATE_COMPONENT(std::shared_ptr<Database>, database)([] {
    return std::make_shared<Database>(
      std::getenv("DB_HOST") ? std::getenv("DB_HOST") : "localhost",
      std::stoi(std::getenv("DB_PORT") ? std::getenv("DB_PORT") : "5432"),
      std::getenv("DB_USER") ? std::getenv("DB_USER") : "tracker_user",
      std::getenv("DB_PASSWORD") ? std::getenv("DB_PASSWORD") : "tracker_password",
      std::getenv("DB_NAME") ? std::getenv("DB_NAME") : "investment_tracker"
    );
  }());

};

int main() {
  curl_global_init(CURL_GLOBAL_DEFAULT);
  oatpp::base::Environment::init();

  AppComponent component;

  OATPP_COMPONENT(std::shared_ptr<oatpp::web::server::HttpRouter>, router);
  OATPP_COMPONENT(std::shared_ptr<oatpp::data::mapping::ObjectMapper>, objectMapper);
  OATPP_COMPONENT(std::shared_ptr<Database>, database);

  // Apply idempotent schema migrations (safe on both fresh and existing DBs).
  {
    auto migrations = std::make_shared<MigrationRepository>(database->getExecutor());
    migrations->addPurchaseDate();
    migrations->backfillPurchaseDate();
    migrations->defaultPurchaseDate();
    migrations->notNullPurchaseDate();
    std::cout << "Schema migrations applied." << std::endl;
  }

  auto authController = std::make_shared<AuthController>(objectMapper, database);
  auto positionsController = std::make_shared<PositionsController>(objectMapper, database);
  auto stocksController = std::make_shared<StocksController>(objectMapper);

  router->addController(authController);
  router->addController(positionsController);
  router->addController(stocksController);

  OATPP_COMPONENT(std::shared_ptr<oatpp::network::ServerConnectionProvider>, connectionProvider);
  OATPP_COMPONENT(std::shared_ptr<oatpp::network::ConnectionHandler>, connectionHandler);

  oatpp::network::Server server(connectionProvider, connectionHandler);

  std::cout << "Starting Investment Tracker Backend on port 3001..." << std::endl;

  server.run();

  oatpp::base::Environment::destroy();
  curl_global_cleanup();

  return 0;
}
