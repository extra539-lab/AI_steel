from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.setting import Setting
from app.schemas.setting import SettingResponse, SettingUpdate
from app.schemas.report import DatabaseIntegrityReport
from app.services.report_service import ReportService

router = APIRouter(prefix="/settings", tags=["settings"])


def _get_or_create_setting(db: Session) -> Setting:
    setting = db.query(Setting).first()
    if not setting:
        # Create an empty/neutral settings row so a fresh install does not
        # contain demo contact or business text. Users should populate
        # the settings via the Settings UI after installation.
        setting = Setting()
        db.add(setting)
        db.commit()
        db.refresh(setting)
    return setting


@router.get("/", response_model=SettingResponse)
def get_settings(db: Session = Depends(get_db)):
    return _get_or_create_setting(db)


@router.put("/", response_model=SettingResponse)
def update_settings(payload: SettingUpdate, db: Session = Depends(get_db)):
    setting = _get_or_create_setting(db)
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(setting, field, value)

    db.commit()
    db.refresh(setting)
    return setting


@router.get("/integrity-check", response_model=DatabaseIntegrityReport)
def get_database_integrity(db: Session = Depends(get_db)):
    return ReportService.audit_database_integrity(db)
