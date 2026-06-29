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
};

#include OATPP_CODEGEN_END(DbClient)

#endif // MIGRATION_REPOSITORY_H
