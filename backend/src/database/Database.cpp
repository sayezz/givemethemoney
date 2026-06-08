#include "Database.hpp"
#include <iostream>

Database::Database(const std::string& host, int port, const std::string& user,
                   const std::string& password, const std::string& database) {
  std::string connectionString = 
    "postgresql://" + user + ":" + password + "@" + host + ":" + std::to_string(port) + "/" + database;
  
  auto connectionProvider = std::make_shared<oatpp::postgresql::ConnectionProvider>(connectionString);
  connection = connectionProvider->getConnection();
}

std::shared_ptr<oatpp::orm::Connection> Database::getConnection() {
  return connection;
}

void Database::initialize() {
  std::cout << "Database initialized" << std::endl;
}
