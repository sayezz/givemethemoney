#ifndef MIGRATION_REPOSITORY_H
#define MIGRATION_REPOSITORY_H

#include "oatpp-postgresql/orm.hpp"

#include OATPP_CODEGEN_BEGIN(DbClient)

// Idempotent schema migrations applied at startup so existing databases
// (created before a column was added) are upgraded without manual steps.
class MigrationRepository : public oatpp::orm::DbClient {
public:
  explicit MigrationRepository(const std::shared_ptr<oatpp::orm::Executor>& executor)
    : oatpp::orm::DbClient(executor)
  {}

  // Add the purchase_date column if it does not exist yet.
  QUERY(addPurchaseDate,
        "ALTER TABLE positions ADD COLUMN IF NOT EXISTS purchase_date DATE")

  // Backfill existing rows from the row-creation timestamp.
  // NOTE: use CAST(... AS date), not '::date' — oatpp's query template parser
  // treats ':' as a named-parameter prefix and misreads '::date'.
  QUERY(backfillPurchaseDate,
        "UPDATE positions SET purchase_date = CAST(created_at AS date) WHERE purchase_date IS NULL")

  // Enforce default + NOT NULL once data is backfilled.
  QUERY(defaultPurchaseDate,
        "ALTER TABLE positions ALTER COLUMN purchase_date SET DEFAULT CURRENT_DATE")

  QUERY(notNullPurchaseDate,
        "ALTER TABLE positions ALTER COLUMN purchase_date SET NOT NULL")

  // --- transactions table (dated cash flows) ---------------------------------
  QUERY(createTransactions,
        "CREATE TABLE IF NOT EXISTS transactions ("
        "id SERIAL PRIMARY KEY, "
        "position_id INTEGER NOT NULL REFERENCES positions(id) ON DELETE CASCADE, "
        "txn_type VARCHAR(10) NOT NULL DEFAULT 'buy', "
        "txn_date DATE NOT NULL DEFAULT CURRENT_DATE, "
        "quantity DECIMAL(18,6) NOT NULL DEFAULT 0, "
        "price DECIMAL(18,6) NOT NULL DEFAULT 0, "
        "fee DECIMAL(18,6) NOT NULL DEFAULT 0, "
        "amount DECIMAL(18,6) NOT NULL DEFAULT 0, "
        "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)")

  QUERY(indexTransactions,
        "CREATE INDEX IF NOT EXISTS idx_transactions_position_id ON transactions(position_id)")

  // Seed one BUY transaction per position that has no transactions yet,
  // derived from the position's stored purchase data (all in EUR).
  QUERY(backfillTransactions,
        "INSERT INTO transactions (position_id, txn_type, txn_date, quantity, price, fee, amount) "
        "SELECT p.id, 'buy', p.purchase_date, p.quantity, "
        "  CASE WHEN p.quantity > 0 THEN p.purchase_cost / p.quantity ELSE 0 END, "
        "  p.purchase_fee, p.purchase_cost + p.purchase_fee "
        "FROM positions p "
        "WHERE NOT EXISTS (SELECT 1 FROM transactions t WHERE t.position_id = p.id)")

  // --- brokers (fee presets) -------------------------------------------------
  QUERY(createBrokers,
        "CREATE TABLE IF NOT EXISTS brokers ("
        "id SERIAL PRIMARY KEY, "
        "user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, "
        "name VARCHAR(100) NOT NULL, "
        "buy_fee_fixed DECIMAL(10,2) NOT NULL DEFAULT 0, "
        "buy_fee_percent DECIMAL(8,4) NOT NULL DEFAULT 0, "
        "sell_fee_fixed DECIMAL(10,2) NOT NULL DEFAULT 0, "
        "sell_fee_percent DECIMAL(8,4) NOT NULL DEFAULT 0, "
        "tax_rate DECIMAL(5,2) NOT NULL DEFAULT 26.375, "
        "is_default BOOLEAN NOT NULL DEFAULT FALSE, "
        "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)")

  QUERY(indexBrokers,
        "CREATE INDEX IF NOT EXISTS idx_brokers_user_id ON brokers(user_id)")

  // Seed the three common German brokers for every user that has none yet.
  // Fee values are approximations and fully editable in the UI.
  QUERY(seedBrokers,
        "INSERT INTO brokers (user_id, name, buy_fee_fixed, buy_fee_percent, sell_fee_fixed, sell_fee_percent, tax_rate, is_default) "
        "SELECT u.id, v.name, v.bf, v.bp, v.sf, v.sp, 26.375, v.def "
        "FROM users u CROSS JOIN (VALUES "
        "  ('Trade Republic', 1.00, 0.0, 1.00, 0.0, TRUE), "
        "  ('Scalable Capital', 0.99, 0.0, 0.99, 0.0, FALSE), "
        "  ('DEGIRO', 2.00, 0.0, 2.00, 0.0, FALSE) "
        ") AS v(name, bf, bp, sf, sp, def) "
        "WHERE NOT EXISTS (SELECT 1 FROM brokers b WHERE b.user_id = u.id AND b.name = v.name)")
};

#include OATPP_CODEGEN_END(DbClient)

#endif // MIGRATION_REPOSITORY_H
