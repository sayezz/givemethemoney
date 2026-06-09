#ifndef DATABASE_H
#define DATABASE_H

#include "oatpp-postgresql/orm.hpp"
#include <memory>
#include <string>

class Database {
private:
  std::shared_ptr<oatpp::postgresql::ConnectionProvider> m_connectionProvider;
  std::shared_ptr<oatpp::postgresql::Executor> m_executor;

public:
  Database(const std::string& host, int port, const std::string& user,
           const std::string& password, const std::string& database);

  std::shared_ptr<oatpp::orm::Executor> getExecutor();
};

#endif // DATABASE_H
