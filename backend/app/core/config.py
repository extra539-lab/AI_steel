import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]
APP_ENV = os.getenv("APP_ENV", "production").strip().lower()


def _default_user_app_data() -> Path:
    if os.name == "nt" and os.getenv("APPDATA"):
        return Path(os.environ["APPDATA"]) / "A1SteelCement"
    return Path.home() / ".local" / "share" / "A1SteelCement"


custom_app_data = os.getenv("APP_DATA_DIR")
base_app_data = Path(custom_app_data) if custom_app_data else _default_user_app_data()

DEV_DATABASE = Path(os.getenv("DEV_DATABASE") or (BASE_DIR.parent / "data" / "dev_a1_steel_cement.db"))
PRODUCTION_DATABASE = Path(
    os.getenv("PRODUCTION_DATABASE") or (base_app_data / "data" / "a1_steel_cement.db")
)

if APP_ENV == "development" and not custom_app_data:
    DATA_DIR = DEV_DATABASE.parent
    BACKUP_DIR = BASE_DIR.parent / "backups" / "dev"
    DATABASE_PATH = DEV_DATABASE
else:
    DATA_DIR = PRODUCTION_DATABASE.parent
    BACKUP_DIR = base_app_data / "backups"
    DATABASE_PATH = PRODUCTION_DATABASE

DATA_DIR.mkdir(parents=True, exist_ok=True)
BACKUP_DIR.mkdir(parents=True, exist_ok=True)
DATABASE_PATH = DATABASE_PATH.resolve()
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DATABASE_PATH}")


class Settings:
    APP_NAME: str = "A1 Steel & Cement Dealer Management System"
    API_V1_PREFIX: str = "/api"
    APP_ENV: str = APP_ENV
    DEV_DATABASE: Path = DEV_DATABASE
    PRODUCTION_DATABASE: Path = PRODUCTION_DATABASE
    DATABASE_PATH: Path = DATABASE_PATH
    DATA_DIR: Path = DATA_DIR
    BACKUP_DIR: Path = BACKUP_DIR
    DATABASE_URL: str = DATABASE_URL


settings = Settings()
