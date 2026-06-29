#ifndef TRANSACTION_REPOSITORY_H
#define TRANSACTION_REPOSITORY_H

#include "oatpp-postgresql/orm.hpp"
#include "../dto/DTOs.hpp"

#include OATPP_CODEGEN_BEGIN(DbClient)

class TransactionRepository : public oatpp::orm::DbClient {
public:
  explicit TransactionRepository(const std::shared_ptr<oatpp::orm::Executor>& executor)
    : oatpp::orm::DbClient(executor)
  {}

  // Ownership is enforced by joining positions on the caller's user_id.
  QUERY(findByPositionId,
        "SELECT t.id, t.position_id, t.txn_type, "
        "CAST(t.txn_date AS text) AS txn_date, "
        "CAST(t.quantity AS float8) AS quantity, "
        "CAST(t.price AS float8) AS price, "
        "CAST(t.fee AS float8) AS fee, "
        "CAST(t.amount AS float8) AS amount, "
        "CAST(t.created_at AS text) AS created_at "
        "FROM transactions t JOIN positions p ON p.id = t.position_id "
        "WHERE t.position_id = :positionId AND p.user_id = :userId "
        "ORDER BY t.txn_date ASC, t.id ASC",
        PARAM(oatpp::Int32, positionId),
        PARAM(oatpp::Int32, userId))

  // All positions' transactions for a user (for portfolio-level calculations).
  QUERY(findByUserId,
        "SELECT t.id, t.position_id, t.txn_type, "
        "CAST(t.txn_date AS text) AS txn_date, "
        "CAST(t.quantity AS float8) AS quantity, "
        "CAST(t.price AS float8) AS price, "
        "CAST(t.fee AS float8) AS fee, "
        "CAST(t.amount AS float8) AS amount, "
        "CAST(t.created_at AS text) AS created_at "
        "FROM transactions t JOIN positions p ON p.id = t.position_id "
        "WHERE p.user_id = :userId "
        "ORDER BY t.txn_date ASC, t.id ASC",
        PARAM(oatpp::Int32, userId))

  // Insert only if the position belongs to the user (conditional INSERT ... SELECT).
  QUERY(create,
        "INSERT INTO transactions (position_id, txn_type, txn_date, quantity, price, fee, amount) "
        "SELECT :positionId, :txnType, COALESCE(CAST(:txnDate AS date), CURRENT_DATE), "
        "CAST(:quantity AS numeric), CAST(:price AS numeric), CAST(:fee AS numeric), CAST(:amount AS numeric) "
        "WHERE EXISTS (SELECT 1 FROM positions WHERE id = :positionId AND user_id = :userId) "
        "RETURNING id, position_id, txn_type, "
        "CAST(txn_date AS text) AS txn_date, "
        "CAST(quantity AS float8) AS quantity, "
        "CAST(price AS float8) AS price, "
        "CAST(fee AS float8) AS fee, "
        "CAST(amount AS float8) AS amount, "
        "CAST(created_at AS text) AS created_at",
        PARAM(oatpp::Int32, positionId),
        PARAM(oatpp::Int32, userId),
        PARAM(oatpp::String, txnType),
        PARAM(oatpp::String, txnDate),
        PARAM(oatpp::Float64, quantity),
        PARAM(oatpp::Float64, price),
        PARAM(oatpp::Float64, fee),
        PARAM(oatpp::Float64, amount))

  QUERY(deleteById,
        "DELETE FROM transactions t USING positions p "
        "WHERE t.id = :id AND t.position_id = p.id AND p.user_id = :userId",
        PARAM(oatpp::Int32, id),
        PARAM(oatpp::Int32, userId))
};

#include OATPP_CODEGEN_END(DbClient)

#endif // TRANSACTION_REPOSITORY_H
