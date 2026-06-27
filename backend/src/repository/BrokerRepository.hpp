#ifndef BROKER_REPOSITORY_H
#define BROKER_REPOSITORY_H

#include "oatpp-postgresql/orm.hpp"
#include "../dto/DTOs.hpp"

#include OATPP_CODEGEN_BEGIN(DbClient)

class BrokerRepository : public oatpp::orm::DbClient {
public:
  explicit BrokerRepository(const std::shared_ptr<oatpp::orm::Executor>& executor)
    : oatpp::orm::DbClient(executor)
  {}

  QUERY(findByUserId,
        "SELECT id, name, "
        "CAST(buy_fee_fixed AS float8) AS buy_fee_fixed, "
        "CAST(buy_fee_percent AS float8) AS buy_fee_percent, "
        "CAST(sell_fee_fixed AS float8) AS sell_fee_fixed, "
        "CAST(sell_fee_percent AS float8) AS sell_fee_percent, "
        "CAST(tax_rate AS float8) AS tax_rate, is_default "
        "FROM brokers WHERE user_id = :userId ORDER BY is_default DESC, name ASC",
        PARAM(oatpp::Int32, userId))

  // Clear the default flag for a user (used before setting a new default).
  QUERY(clearDefault,
        "UPDATE brokers SET is_default = FALSE WHERE user_id = :userId",
        PARAM(oatpp::Int32, userId))

  QUERY(create,
        "INSERT INTO brokers (user_id, name, buy_fee_fixed, buy_fee_percent, sell_fee_fixed, sell_fee_percent, tax_rate, is_default) "
        "VALUES (:userId, :name, CAST(:buyFeeFixed AS numeric), CAST(:buyFeePercent AS numeric), "
        "CAST(:sellFeeFixed AS numeric), CAST(:sellFeePercent AS numeric), CAST(:taxRate AS numeric), :isDefault) "
        "RETURNING id, name, "
        "CAST(buy_fee_fixed AS float8) AS buy_fee_fixed, "
        "CAST(buy_fee_percent AS float8) AS buy_fee_percent, "
        "CAST(sell_fee_fixed AS float8) AS sell_fee_fixed, "
        "CAST(sell_fee_percent AS float8) AS sell_fee_percent, "
        "CAST(tax_rate AS float8) AS tax_rate, is_default",
        PARAM(oatpp::Int32, userId),
        PARAM(oatpp::String, name),
        PARAM(oatpp::Float64, buyFeeFixed),
        PARAM(oatpp::Float64, buyFeePercent),
        PARAM(oatpp::Float64, sellFeeFixed),
        PARAM(oatpp::Float64, sellFeePercent),
        PARAM(oatpp::Float64, taxRate),
        PARAM(oatpp::Boolean, isDefault))

  QUERY(update,
        "UPDATE brokers SET name = :name, "
        "buy_fee_fixed = CAST(:buyFeeFixed AS numeric), buy_fee_percent = CAST(:buyFeePercent AS numeric), "
        "sell_fee_fixed = CAST(:sellFeeFixed AS numeric), sell_fee_percent = CAST(:sellFeePercent AS numeric), "
        "tax_rate = CAST(:taxRate AS numeric), is_default = :isDefault "
        "WHERE id = :id AND user_id = :userId "
        "RETURNING id, name, "
        "CAST(buy_fee_fixed AS float8) AS buy_fee_fixed, "
        "CAST(buy_fee_percent AS float8) AS buy_fee_percent, "
        "CAST(sell_fee_fixed AS float8) AS sell_fee_fixed, "
        "CAST(sell_fee_percent AS float8) AS sell_fee_percent, "
        "CAST(tax_rate AS float8) AS tax_rate, is_default",
        PARAM(oatpp::Int32, id),
        PARAM(oatpp::Int32, userId),
        PARAM(oatpp::String, name),
        PARAM(oatpp::Float64, buyFeeFixed),
        PARAM(oatpp::Float64, buyFeePercent),
        PARAM(oatpp::Float64, sellFeeFixed),
        PARAM(oatpp::Float64, sellFeePercent),
        PARAM(oatpp::Float64, taxRate),
        PARAM(oatpp::Boolean, isDefault))

  QUERY(deleteById,
        "DELETE FROM brokers WHERE id = :id AND user_id = :userId",
        PARAM(oatpp::Int32, id),
        PARAM(oatpp::Int32, userId))

  // Seed the standard presets for a single (new) user.
  QUERY(seedForUser,
        "INSERT INTO brokers (user_id, name, buy_fee_fixed, buy_fee_percent, sell_fee_fixed, sell_fee_percent, tax_rate, is_default) "
        "SELECT :userId, v.name, v.bf, v.bp, v.sf, v.sp, 26.375, v.def "
        "FROM (VALUES "
        "  ('Trade Republic', 1.00, 0.0, 1.00, 0.0, TRUE), "
        "  ('Scalable Capital', 0.99, 0.0, 0.99, 0.0, FALSE), "
        "  ('DEGIRO', 2.00, 0.0, 2.00, 0.0, FALSE) "
        ") AS v(name, bf, bp, sf, sp, def) "
        "WHERE NOT EXISTS (SELECT 1 FROM brokers b WHERE b.user_id = :userId AND b.name = v.name)",
        PARAM(oatpp::Int32, userId))
};

#include OATPP_CODEGEN_END(DbClient)

#endif // BROKER_REPOSITORY_H
