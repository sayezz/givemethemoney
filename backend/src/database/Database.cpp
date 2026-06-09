#include "Database.hpp"
#include <iostream>
#include <thread>
#include <chrono>

Database::Database(const std::string& host, int port, const std::string& user,
                   const std::string& password, const std::string& database) {
  std::string connectionString =
    "postgresql://" + user + ":" + password + "@" + host + ":" + std::to_string(port) + "/" + database;

  m_connectionProvider = std::make_shared<oatpp::postgresql::ConnectionProvider>(connectionString);
  m_executor = std::make_shared<oatpp::postgresql::Executor>(m_connectionProvider);

  const int maxAttempts = 30;
  for (int attempt = 1;; ++attempt) {
    try {
      m_executor->getConnection();
      return;
    } catch (const std::exception& e) {
      if (attempt >= maxAttempts) {
        throw;
      }
      std::cout << "Database not ready yet (attempt " << attempt << "/" << maxAttempts
                << "): " << e.what() << ". Retrying in 2s..." << std::endl;
      std::this_thread::sleep_for(std::chrono::seconds(2));
    }
  }
}

std::shared_ptr<oatpp::orm::Executor> Database::getExecutor() {
  return m_executor;
}
