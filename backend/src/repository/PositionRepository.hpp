#ifndef POSITION_REPOSITORY_H
#define POSITION_REPOSITORY_H

#include "oatpp-postgresql/orm.hpp"
#include "../dto/DTOs.hpp"

#include OATPP_CODEGEN_BEGIN(DbClient)

class PositionRepository : public oatpp::orm::DbClient {
public:

  PositionRepository(const std::shared_ptr<oatpp::orm::Executor>& executor)
    : oatpp::orm::DbClient(executor)
  {}

  QUERY(findByUserId,
        "SELECT id, name, ticker, "
        "CAST(quantity AS float8) AS quantity, "
        "CAST(purchase_cost AS float8) AS purchase_cost, "
        "CAST(purchase_fee AS float8) AS purchase_fee, "
        "CAST(purchase_fee_fixed AS float8) AS purchase_fee_fixed, "
        "CAST(purchase_fee_percent AS float8) AS purchase_fee_percent, "
        "CAST(sell_fee AS float8) AS sell_fee, "
        "CAST(sell_fee_fixed AS float8) AS sell_fee_fixed, "
        "CAST(sell_fee_percent AS float8) AS sell_fee_percent, "
        "CAST(tax_rate AS float8) AS tax_rate, "
        "CAST(highest_price AS float8) AS highest_price, "
        "CAST(trailing_stop_percent AS float8) AS trailing_stop_percent, "
        "trailing_stop_active, "
        "ts_notification_sent, "
        "quote_provider, "
        "CAST(purchase_date AS text) AS purchase_date, "
        "CAST(created_at AS text) AS created_at "
        "FROM positions WHERE user_id = :userId ORDER BY purchase_date DESC, created_at DESC",
        PARAM(oatpp::Int32, userId))

  QUERY(create,
        "INSERT INTO positions "
        "(user_id, name, ticker, quantity, purchase_cost, purchase_fee, purchase_fee_fixed, purchase_fee_percent, sell_fee, sell_fee_fixed, sell_fee_percent, tax_rate, quote_provider, purchase_date) "
        "VALUES "
        "(:userId, :name, :ticker, CAST(:quantity AS numeric), CAST(:purchaseCost AS numeric), "
        "CAST(:purchaseFee AS numeric), CAST(:purchaseFeeFixed AS numeric), CAST(:purchaseFeePercent AS numeric), "
        "CAST(:sellFee AS numeric), CAST(:sellFeeFixed AS numeric), CAST(:sellFeePercent AS numeric), CAST(:taxRate AS numeric), :quoteProvider, "
        "COALESCE(CAST(:purchaseDate AS date), CURRENT_DATE)) "
        "RETURNING id, name, ticker, "
        "CAST(quantity AS float8) AS quantity, "
        "CAST(purchase_cost AS float8) AS purchase_cost, "
        "CAST(purchase_fee AS float8) AS purchase_fee, "
        "CAST(purchase_fee_fixed AS float8) AS purchase_fee_fixed, "
        "CAST(purchase_fee_percent AS float8) AS purchase_fee_percent, "
        "CAST(sell_fee AS float8) AS sell_fee, "
        "CAST(sell_fee_fixed AS float8) AS sell_fee_fixed, "
        "CAST(sell_fee_percent AS float8) AS sell_fee_percent, "
        "CAST(tax_rate AS float8) AS tax_rate, "
        "CAST(highest_price AS float8) AS highest_price, "
        "CAST(trailing_stop_percent AS float8) AS trailing_stop_percent, "
        "trailing_stop_active, "
        "ts_notification_sent, "
        "quote_provider, "
        "CAST(purchase_date AS text) AS purchase_date, "
        "CAST(created_at AS text) AS created_at",
        PARAM(oatpp::Int32, userId),
        PARAM(oatpp::String, name),
        PARAM(oatpp::String, ticker),
        PARAM(oatpp::Float64, quantity),
        PARAM(oatpp::Float64, purchaseCost),
        PARAM(oatpp::Float64, purchaseFee),
        PARAM(oatpp::Float64, purchaseFeeFixed),
        PARAM(oatpp::Float64, purchaseFeePercent),
        PARAM(oatpp::Float64, sellFee),
        PARAM(oatpp::Float64, sellFeeFixed),
        PARAM(oatpp::Float64, sellFeePercent),
        PARAM(oatpp::Float64, taxRate),
        PARAM(oatpp::String, quoteProvider),
        PARAM(oatpp::String, purchaseDate))

  QUERY(findById,
        "SELECT id, name, ticker, "
        "CAST(quantity AS float8) AS quantity, "
        "CAST(purchase_cost AS float8) AS purchase_cost, "
        "CAST(purchase_fee AS float8) AS purchase_fee, "
        "CAST(purchase_fee_fixed AS float8) AS purchase_fee_fixed, "
        "CAST(purchase_fee_percent AS float8) AS purchase_fee_percent, "
        "CAST(sell_fee AS float8) AS sell_fee, "
        "CAST(sell_fee_fixed AS float8) AS sell_fee_fixed, "
        "CAST(sell_fee_percent AS float8) AS sell_fee_percent, "
        "CAST(tax_rate AS float8) AS tax_rate, "
        "CAST(highest_price AS float8) AS highest_price, "
        "CAST(trailing_stop_percent AS float8) AS trailing_stop_percent, "
        "trailing_stop_active, ts_notification_sent, quote_provider, "
        "CAST(purchase_date AS text) AS purchase_date, "
        "CAST(created_at AS text) AS created_at "
        "FROM positions WHERE id = :id AND user_id = :userId",
        PARAM(oatpp::Int32, id),
        PARAM(oatpp::Int32, userId))

  QUERY(deleteById,
        "DELETE FROM positions WHERE id = :id AND user_id = :userId",
        PARAM(oatpp::Int32, id),
        PARAM(oatpp::Int32, userId))

  QUERY(setTrailingStop,
        "UPDATE positions SET trailing_stop_active = :active WHERE id = :id AND user_id = :userId",
        PARAM(oatpp::Int32, id),
        PARAM(oatpp::Int32, userId),
        PARAM(oatpp::Boolean, active))

  QUERY(setNotificationSent,
        "UPDATE positions SET ts_notification_sent = TRUE WHERE id = :id AND user_id = :userId",
        PARAM(oatpp::Int32, id),
        PARAM(oatpp::Int32, userId))

  QUERY(setQuoteProvider,
        "UPDATE positions SET quote_provider = :provider WHERE id = :id AND user_id = :userId",
        PARAM(oatpp::Int32, id),
        PARAM(oatpp::Int32, userId),
        PARAM(oatpp::String, provider))

};

#include OATPP_CODEGEN_END(DbClient)

#endif // POSITION_REPOSITORY_H
