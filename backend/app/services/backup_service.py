import os
import sqlite3
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional, Dict, Any

from app.core.config import settings
from app.core.database import maintenance_context, engine
from app.models.audit import AuditLog
from app.schemas.report import BackupInfo, BackupHealthInfo


class BackupService:
    @staticmethod
    def _verify_backup_file(backup_path: Path) -> Dict[str, Any]:
        """Verifies backup file readability, table schemas, and SQLite integrity."""
        if not backup_path.exists():
            return {"is_valid": False, "error": "File does not exist", "tables_count": 0}

        try:
            conn = sqlite3.connect(str(backup_path))
            cursor = conn.cursor()
            cursor.execute("PRAGMA integrity_check;")
            integrity_res = cursor.fetchall()
            is_ok = len(integrity_res) > 0 and integrity_res[0][0].lower() == "ok"

            cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
            tables = [r[0] for r in cursor.fetchall() if not r[0].startswith("sqlite_")]
            conn.close()

            required_tables = ["products", "customers", "suppliers", "sales", "purchases"]
            has_required = all(t in tables for t in required_tables)

            return {
                "is_valid": is_ok and has_required,
                "tables_count": len(tables),
                "tables": tables,
                "integrity": integrity_res,
            }
        except Exception as e:
            return {"is_valid": False, "error": str(e), "tables_count": 0}

    @staticmethod
    def create_backup(is_safety: bool = False, custom_name: Optional[str] = None) -> BackupInfo:
        """Creates a verified online backup using SQLite native backup API."""
        if not settings.DATABASE_PATH.exists():
            raise FileNotFoundError("Active database file not found")

        timestamp = datetime.now().strftime("%Y-%m-%d-%H-%M")
        prefix = "A1-Steel-Cement-PreRestore-Safety-" if is_safety else "A1-Steel-Cement-Backup-"
        backup_filename = custom_name or f"{prefix}{timestamp}.db"
        dest_path = settings.BACKUP_DIR / backup_filename
        settings.BACKUP_DIR.mkdir(parents=True, exist_ok=True)

        # 1. Native SQLite Online Backup
        src_conn = sqlite3.connect(str(settings.DATABASE_PATH))
        dst_conn = sqlite3.connect(str(dest_path))
        src_conn.backup(dst_conn, pages=100)
        dst_conn.close()
        src_conn.close()

        # 2. Verify Backup
        verification = BackupService._verify_backup_file(dest_path)
        if not verification["is_valid"]:
            if dest_path.exists():
                dest_path.unlink()
            raise RuntimeError(f"Backup verification failed: {verification.get('error', 'Integrity check failed')}")

        size_kb = os.path.getsize(dest_path) / 1024.0

        # 3. Off-Site / Secondary Destination Copy
        offsite_dir = os.getenv("OFFSITE_BACKUP_DIR")
        if offsite_dir:
            try:
                offsite_path = Path(offsite_dir)
                offsite_path.mkdir(parents=True, exist_ok=True)
                offsite_dest = offsite_path / backup_filename
                dst_offsite = sqlite3.connect(str(offsite_dest))
                src_backup = sqlite3.connect(str(dest_path))
                src_backup.backup(dst_offsite)
                dst_offsite.close()
                src_backup.close()
            except Exception as e:
                print(f"[!] Warning: Failed to copy backup to offsite destination: {e}")

        # 4. Prune old backups per retention policy
        BackupService.apply_retention_policy()
        if not dest_path.exists() or os.path.getsize(dest_path) <= 0:
            raise RuntimeError("Backup file was created but is empty or missing.")
        return BackupInfo(
            filename=backup_filename,
            file_size_kb=round(size_kb, 2),
            created_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            is_verified=True,
            tables_count=verification["tables_count"],
        )

    @staticmethod
    def list_backups() -> List[BackupInfo]:
        backups = []
        if not settings.BACKUP_DIR.exists():
            return []

        for file in sorted(settings.BACKUP_DIR.glob("*.db"), key=os.path.getmtime, reverse=True):
            size_kb = os.path.getsize(file) / 1024.0
            mtime = datetime.fromtimestamp(os.path.getmtime(file)).strftime("%Y-%m-%d %H:%M:%S")
            # Verify file
            ver = BackupService._verify_backup_file(file)
            backups.append(BackupInfo(
                filename=file.name,
                file_size_kb=round(size_kb, 2),
                created_at=mtime,
                is_verified=ver["is_valid"],
                tables_count=ver["tables_count"],
            ))
        return backups

    @staticmethod
    def restore_backup(filename: str) -> Dict[str, Any]:
        """Performs atomic safe restore with pre-validation, safety snapshot, and auto-rollback."""
        src_path = settings.BACKUP_DIR / filename
        if not src_path.exists():
            raise FileNotFoundError(f"Backup file {filename} not found")

        # Step 1: Pre-validate candidate backup file before touching live database
        candidate_ver = BackupService._verify_backup_file(src_path)
        if not candidate_ver["is_valid"]:
            raise ValueError(f"Selected backup {filename} failed integrity check and cannot be restored.")

        safety_file = None

        # Step 2: Acquire maintenance mode lock & dispose DB connections
        with maintenance_context():
            # Step 3: Create pre-restore safety copy of current live database
            safety_time = datetime.now().strftime("%Y-%m-%d_%H%M%S")
            safety_filename = f"pre_restore_safety_{safety_time}.db"
            safety_dest = settings.BACKUP_DIR / safety_filename

            if settings.DATABASE_PATH.exists():
                live_conn = sqlite3.connect(str(settings.DATABASE_PATH))
                safety_conn = sqlite3.connect(str(safety_dest))
                live_conn.backup(safety_conn)
                safety_conn.close()
                live_conn.close()
                safety_file = safety_dest

            try:
                # Step 4: Perform online restore from backup to live database
                src_conn = sqlite3.connect(str(src_path))
                dst_conn = sqlite3.connect(str(settings.DATABASE_PATH))
                src_conn.backup(dst_conn)
                dst_conn.close()
                src_conn.close()

                # Step 5: Run post-restore integrity check on live DB
                live_ver = BackupService._verify_backup_file(settings.DATABASE_PATH)
                if not live_ver["is_valid"]:
                    raise RuntimeError("Post-restore integrity check failed on live database.")

            except Exception as e:
                # Step 6: Automatic Rollback from safety backup
                if safety_file and safety_file.exists():
                    rb_src = sqlite3.connect(str(safety_file))
                    rb_dst = sqlite3.connect(str(settings.DATABASE_PATH))
                    rb_src.backup(rb_dst)
                    rb_dst.close()
                    rb_src.close()
                raise RuntimeError(f"Restore failed and was automatically rolled back: {e}")

        return {
            "status": "success",
            "message": f"Database successfully restored from {filename}",
            "safety_backup": safety_filename if safety_file else None,
            "tables_count": candidate_ver["tables_count"],
        }

    @staticmethod
    def apply_retention_policy():
        """Keeps the newest 7 verified backups and prunes older non-critical copies."""
        if not settings.BACKUP_DIR.exists():
            return

        all_backups = sorted(settings.BACKUP_DIR.glob("*.db"), key=os.path.getmtime, reverse=True)
        if len(all_backups) <= 7:
            return

        now = datetime.now()
        thirty_days_ago = now - timedelta(days=30)

        for file in all_backups[7:]:
            mtime = datetime.fromtimestamp(os.path.getmtime(file))
            if "Safety" in file.name or "safety" in file.name.lower():
                if mtime < thirty_days_ago:
                    try:
                        file.unlink()
                    except OSError:
                        pass
                continue

            try:
                file.unlink()
            except OSError:
                pass

    @staticmethod
    def get_backup_health() -> BackupHealthInfo:
        backups = BackupService.list_backups()
        valid_backups = [b for b in backups if b.is_verified]

        destinations = [str(settings.BACKUP_DIR)]
        offsite = os.getenv("OFFSITE_BACKUP_DIR")
        if offsite:
            destinations.append(offsite)

        if not valid_backups:
            return BackupHealthInfo(
                status="WARNING" if backups else "ERROR",
                last_successful_backup=None,
                last_verified_backup=None,
                last_backup_timestamp=None,
                destinations=destinations,
                total_backups_count=len(backups),
                is_verified=False,
            )

        latest = valid_backups[0]
        return BackupHealthInfo(
            status="HEALTHY",
            last_successful_backup=latest.filename,
            last_verified_backup=latest.filename,
            last_backup_timestamp=latest.created_at,
            destinations=destinations,
            total_backups_count=len(backups),
            is_verified=True,
        )
