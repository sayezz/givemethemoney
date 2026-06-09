#ifndef USER_REPOSITORY_H
#define USER_REPOSITORY_H

#include "oatpp-postgresql/orm.hpp"
#include "../dto/DTOs.hpp"

#include OATPP_CODEGEN_BEGIN(DbClient)

class UserRepository : public oatpp::orm::DbClient {
public:

  UserRepository(const std::shared_ptr<oatpp::orm::Executor>& executor)
    : oatpp::orm::DbClient(executor)
  {}

  QUERY(findByEmail,
        "SELECT id, email, password_hash, CAST(created_at AS text) AS created_at "
        "FROM users WHERE email = :email",
        PARAM(oatpp::String, email))

  QUERY(createUser,
        "INSERT INTO users (email, password_hash) VALUES (:email, :passwordHash) "
        "RETURNING id, email, CAST(created_at AS text) AS created_at",
        PARAM(oatpp::String, email),
        PARAM(oatpp::String, passwordHash))

};

#include OATPP_CODEGEN_END(DbClient)

#endif // USER_REPOSITORY_H
