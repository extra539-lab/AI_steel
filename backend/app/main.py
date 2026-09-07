from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine, SessionLocal
from app.core.migration import run_database_migration
from app.models import Setting
from app.routers import (
    products_router,
    suppliers_router,
    customers_router,
    purchases_router,
    sales_router,
    payments_router,
    inventory_router,
    dashboard_router,
    reports_router,
    settings_router,
    backup_router,
)

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="A1 Steel & Cement Dealer Desktop Application Management Backend",
)

# CORS middleware for Electron & Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    # 1. Non-destructive migration and sequence sync
    run_database_migration()

    # 2. Ensure default settings exist
    db = SessionLocal()
    try:
        setting = db.query(Setting).first()
        if not setting:
            # Create a neutral, empty settings record on first-run so that
            # no demo or sample business/contact text appears for new customers.
            db.add(Setting())
            db.commit()
    finally:
        db.close()


# Mount routers
app.include_router(dashboard_router, prefix=settings.API_V1_PREFIX)
app.include_router(products_router, prefix=settings.API_V1_PREFIX)
app.include_router(suppliers_router, prefix=settings.API_V1_PREFIX)
app.include_router(customers_router, prefix=settings.API_V1_PREFIX)
app.include_router(purchases_router, prefix=settings.API_V1_PREFIX)
app.include_router(sales_router, prefix=settings.API_V1_PREFIX)
app.include_router(payments_router, prefix=settings.API_V1_PREFIX)
app.include_router(inventory_router, prefix=settings.API_V1_PREFIX)
app.include_router(reports_router, prefix=settings.API_V1_PREFIX)
app.include_router(settings_router, prefix=settings.API_V1_PREFIX)
app.include_router(backup_router, prefix=settings.API_V1_PREFIX)


@app.get("/")
def root():
    return {
        "app": settings.APP_NAME,
        "status": "online",
        "api_docs": "/docs",
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "database": "connected",
    }