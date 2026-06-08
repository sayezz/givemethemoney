#ifndef DATABASE_H
#define DATABASE_H

#include "oatpp-postgresql/orm.hpp"
#include <memory>

class Database {
private:
  std::shared_ptr<oatpp::orm::Connection> connection;

public:
  Database(const std::string& host, int port, const std::string& user, 
           const std::string& password, const std::string& database);
  
  std::shared_ptr<oatpp::orm::Connection> getConnection();
  void initialize();
};

#endif // DATABASE_H
