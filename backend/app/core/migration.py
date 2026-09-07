import sqlite3
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, List

from app.core.config import settings

CURRENT_SCHEMA_VERSION = 3


def _table_exists(conn: sqlite3.Connection, table_name: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?;",
        (table_name,),
    ).fetchone()
    return row is not None


def _get_existing_columns(conn: sqlite3.Connection, table_name: str) -> List[str]:
    rows = conn.execute(f"PRAGMA table_info({table_name});").fetchall()
    return [row[1] for row in rows]


def _ensure_schema_version_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_version (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            version INTEGER NOT NULL,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        """
    )


def _get_schema_version(conn: sqlite3.Connection) -> int:
    try:
        row = conn.execute(
            "SELECT version FROM schema_version WHERE id = 1 ORDER BY updated_at DESC LIMIT 1;"
        ).fetchone()
        return int(row[0]) if row else 0
    except sqlite3.DatabaseError:
        return 0


def _set_schema_version(conn: sqlite3.Connection, version: int) -> None:
    _ensure_schema_version_table(conn)
    conn.execute(
        """
        INSERT INTO schema_version (id, version, updated_at)
        VALUES (1, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET version = excluded.version, updated_at = CURRENT_TIMESTAMP;
        """,
        (version,),
    )


def _verify_database_file(db_path: Path) -> Dict[str, Any]:
    if not db_path.exists():
        return {"ok": False, "error": "Database file not found", "tables": []}

    try:
        conn = sqlite3.connect(str(db_path), timeout=30)
        try:
            integrity = conn.execute("PRAGMA integrity_check;").fetchone()
            foreign_key_issues = conn.execute("PRAGMA foreign_key_check;").fetchall()
            tables = [
                row[0]
                for row in conn.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"
                ).fetchall()
            ]
            required = ["customers", "suppliers", "products", "sales", "purchases", "settings"]
            missing_required = [name for name in required if name not in tables]
            result = {
                "ok": bool(integrity) and integrity[0].lower() == "ok" and not foreign_key_issues and not missing_required,
                "error": None if not missing_required and not foreign_key_issues else "Database integrity check failed",
                "integrity": integrity[0] if integrity else "UNKNOWN",
                "foreign_key_issues": len(foreign_key_issues),
                "tables": tables,
                "missing_required": missing_required,
            }
            return result
        finally:
            conn.close()
    except Exception as exc:
        return {"ok": False, "error": str(exc), "tables": []}


def _create_verified_backup(db_path: Path, prefix: str = "pre_migration") -> Path:
    settings.BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y-%m-%d-%H-%M")
    backup_path = settings.BACKUP_DIR / f"A1-Steel-Cement-{prefix}-{timestamp}.db"

    src_conn = sqlite3.connect(str(db_path), timeout=30)
    dst_conn = sqlite3.connect(str(backup_path), timeout=30)
    try:
        src_conn.backup(dst_conn, pages=100)
        dst_conn.commit()
    finally:
        dst_conn.close()
        src_conn.close()

    verification = _verify_database_file(backup_path)
    if not verification["ok"]:
        if backup_path.exists():
            backup_path.unlink()
        raise RuntimeError(f"Backup verification failed: {verification.get('error', 'Integrity check failed')}")

    return backup_path


def _restore_from_backup(backup_path: Path, target_path: Path) -> None:
    src_conn = sqlite3.connect(str(backup_path), timeout=30)
    dst_conn = sqlite3.connect(str(target_path), timeout=30)
    try:
        src_conn.backup(dst_conn, pages=100)
        dst_conn.commit()
    finally:
        dst_conn.close()
        src_conn.close()


def _apply_legacy_migrations(conn: sqlite3.Connection) -> List[str]:
    changes: List[str] = []
    cursor = conn.cursor()
    cursor.execute("PRAGMA foreign_keys=OFF;")

    def ensure_table(table_name: str, ddl: str):
        if not _table_exists(conn, table_name):
            cursor.execute(ddl)
            changes.append(f"Created table {table_name}")

    ensure_table(
        "document_sequences",
        """
        CREATE TABLE document_sequences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sequence_type VARCHAR UNIQUE NOT NULL,
            prefix VARCHAR NOT NULL DEFAULT '',
            last_number INTEGER NOT NULL DEFAULT 0,
            padding INTEGER NOT NULL DEFAULT 5,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        """,
    )

    ensure_table(
        "audit_logs",
        """
        CREATE TABLE audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_type VARCHAR NOT NULL,
            entity_id VARCHAR,
            action VARCHAR NOT NULL,
            user VARCHAR NOT NULL DEFAULT 'owner',
            details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        """,
    )
    cursor.execute("CREATE INDEX IF NOT EXISTS ix_audit_logs_entity_type ON audit_logs(entity_type);")
    cursor.execute("CREATE INDEX IF NOT EXISTS ix_audit_logs_created_at ON audit_logs(created_at);")

    for table_name, fallback_columns in {
        "sale_items": ["unit_cost", "cost_total"],
        "sales": ["status", "void_reason", "voided_at", "idempotency_key", "mazdori"],
        "purchases": ["status", "void_reason", "voided_at", "idempotency_key"],
        "customer_payments": ["status", "void_reason", "voided_at", "idempotency_key"],
        "supplier_payments": ["status", "void_reason", "voided_at", "idempotency_key"],
    }.items():
        if not _table_exists(conn, table_name):
            continue
        existing = _get_existing_columns(conn, table_name)
        for column_name in fallback_columns:
            if column_name not in existing:
                if column_name in {"unit_cost", "cost_total", "mazdori"}:
                    cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} NUMERIC(15, 2);")
                elif column_name == "status":
                    cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} VARCHAR DEFAULT 'ACTIVE';")
                else:
                    cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} TEXT;")
                changes.append(f"Added {column_name} to {table_name}")

    if _table_exists(conn, "sale_items"):
        missing = conn.execute(
            "SELECT id, product_id, quantity FROM sale_items WHERE unit_cost IS NULL OR cost_total IS NULL;"
        ).fetchall()
        for item_id, product_id, qty in missing:
            row = conn.execute("SELECT purchase_price FROM products WHERE id=?;", (product_id,)).fetchone()
            purchase_price = Decimal(str(row[0])) if row and row[0] is not None else Decimal("0.00")
            item_cost_total = (Decimal(str(qty)) * purchase_price).quantize(Decimal("0.01"))
            conn.execute(
                "UPDATE sale_items SET unit_cost=?, cost_total=? WHERE id=?;",
                (float(purchase_price), float(item_cost_total), item_id),
            )
        if missing:
            changes.append(f"Reconstructed missing historical costs for {len(missing)} sale items")

    conn.execute("PRAGMA foreign_keys=ON;")
    return changes


def run_database_migration() -> Dict[str, Any]:
    db_path = settings.DATABASE_PATH
    db_path.parent.mkdir(parents=True, exist_ok=True)

    if not db_path.exists():
        from app.core.database import Base, engine

        conn = sqlite3.connect(str(db_path), timeout=30)
        try:
            conn.execute("PRAGMA foreign_keys=ON;")
            Base.metadata.create_all(bind=engine)
            _ensure_schema_version_table(conn)
            _set_schema_version(conn, CURRENT_SCHEMA_VERSION)
            conn.commit()
        finally:
            conn.close()

        return {
            "status": "created_fresh",
            "message": "Initialized a new database at the persistent application-data location.",
            "database_path": str(db_path),
            "schema_version": CURRENT_SCHEMA_VERSION,
            "changes": ["created_new_database"],
        }

    print(f"[*] Starting safe migration for {db_path} (required schema version {CURRENT_SCHEMA_VERSION})")
    backup_path = None
    conn = sqlite3.connect(str(db_path), timeout=30)
    try:
        backup_path = _create_verified_backup(db_path, "pre_migration")
        print(f"[✓] Safety backup created and verified: {backup_path}")

        _ensure_schema_version_table(conn)
        current_version = _get_schema_version(conn)
        changes: List[str] = []

        if current_version == 0:
            changes.extend(_apply_legacy_migrations(conn))

        if current_version < CURRENT_SCHEMA_VERSION:
            for version in range(current_version + 1, CURRENT_SCHEMA_VERSION + 1):
                if version == 1:
                    changes.extend(_apply_legacy_migrations(conn))
                elif version == 3:
                    # Add mazdori column to sales if missing
                    existing = _get_existing_columns(conn, 'sales') if _table_exists(conn, 'sales') else []
                    if 'mazdori' not in existing:
                        conn.execute("ALTER TABLE sales ADD COLUMN mazdori NUMERIC(15, 2) DEFAULT 0.00;")
                        changes.append('Added mazdori to sales')
                else:
                    changes.append(f"Schema already compatible at version {version}")

        _set_schema_version(conn, CURRENT_SCHEMA_VERSION)
        conn.commit()

        integrity = _verify_database_file(db_path)
        if not integrity["ok"]:
            raise RuntimeError(f"Post-migration integrity check failed: {integrity.get('error', 'Integrity check failed')}")

        print(f"[✓] Database migration completed successfully. Integrity: {integrity['integrity']}")
        return {
            "status": "success",
            "message": "Database migration completed successfully.",
            "database_path": str(db_path),
            "schema_version": CURRENT_SCHEMA_VERSION,
            "changes": changes,
        }
    except Exception as exc:
        print(f"[ERROR] Migration failed for {db_path}: {exc}")
        if backup_path and backup_path.exists():
            try:
                _restore_from_backup(backup_path, db_path)
                restored_check = _verify_database_file(db_path)
                if restored_check["ok"]:
                    print(f"[✓] Original database restored from backup after migration failure: {backup_path}")
                else:
                    print("[WARN] Original database could not be validated after restore attempt.")
            except Exception as restore_error:
                print(f"[ERROR] Automatic restore failed: {restore_error}")
        raise RuntimeError(
            "Your existing data could not be loaded safely. "
            "The original database has not been deleted and a verified backup is preserved. "
            "Please contact support or restore a verified backup."
        ) from exc
    finally:
        conn.close()


if __name__ == "__main__":
    result = run_database_migration()
    print("Migration Result:", result)

