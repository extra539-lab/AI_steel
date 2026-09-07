from typing import List
from fastapi import APIRouter, Depends, HTTPException, Body

from app.schemas.report import BackupInfo, BackupHealthInfo
from app.services.backup_service import BackupService

router = APIRouter(prefix="/backup", tags=["backup"])


@router.get("/health", response_model=BackupHealthInfo)
def get_backup_health():
    return BackupService.get_backup_health()


@router.get("/list", response_model=List[BackupInfo])
def list_backups():
    return BackupService.list_backups()


@router.post("/create", response_model=BackupInfo)
def create_backup():
    try:
        return BackupService.create_backup()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/restore")
def restore_backup(filename: str = Body(..., embed=True)):
    try:
        res = BackupService.restore_backup(filename)
        return res
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Backup file '{filename}' not found")
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
