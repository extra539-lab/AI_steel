# A1 Steel & Cement Release Checklist

This checklist is required before sending any new installer to a customer.

## 1. Version & schema review
- Increase the application version in the Electron and backend metadata as needed.
- Review all database schema changes since the last customer release.
- Confirm whether the old customer database must be migrated or remains compatible.
- If a schema change is required, add or update a versioned migration.

## 2. Data safety checks
- Confirm the production database path remains in a persistent Windows user-data folder, not under the application install directory.
- Confirm the same database path is used for Version 1 and Version 2.
- Confirm no startup path can create a fresh database over an existing customer database.
- Create a verified backup before any migration or restore action.

## 3. Migration testing
- Test the current database against the next schema version.
- Confirm migration order is deterministic and only runs required steps.
- Verify the database still opens and passes SQLite integrity checks.
- Check default values for any new column or table.
- Verify that no customer records are deleted or lost.

## 4. Backup / restore verification
- Create at least one backup using the app and verify it is readable.
- Open the backup file and validate integrity.
- Test restoring the backup to a separate test copy.
- Confirm the application recovers cleanly if restore fails.

## 5. Upgrade simulation
- Install Version 1 in a clean environment.
- Add realistic sample data for customers, suppliers, products, purchases, sales, invoices, payments, expenses, and inventory.
- Create a backup.
- Close the app.
- Install Version 2 over Version 1.
- Start Version 2.
- Verify all records remain present and accessible.
- Repeat with the next planned version.

## 6. Installer validation
- Build the Windows installer from a clean developer environment.
- Test installation on a clean Windows machine.
- Test installation over an existing installation with prior customer data.
- Ensure uninstall/update behavior does not silently delete the user database.
- Confirm the backup folder remains untouched by the installer update process.

## 7. Customer-safe release gate
- Only release after the migration, backup, restore, and database integrity checks all pass.
- Confirm logs show the app is using the correct persistent database path.
- Confirm the final build excludes development-only directories and test artifacts.
- Keep the last verified backup available for rollback.

## 8. Final sign-off
- Review all test results.
- Confirm the installer is safe for real customer deployment.
- Deliver the installer only after the release checklist is complete.
