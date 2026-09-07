from app.routers.products import router as products_router
from app.routers.suppliers import router as suppliers_router
from app.routers.customers import router as customers_router
from app.routers.purchases import router as purchases_router
from app.routers.sales import router as sales_router
from app.routers.payments import router as payments_router
from app.routers.inventory import router as inventory_router
from app.routers.dashboard import router as dashboard_router
from app.routers.reports import router as reports_router
from app.routers.settings import router as settings_router
from app.routers.backup import router as backup_router

__all__ = [
    "products_router",
    "suppliers_router",
    "customers_router",
    "purchases_router",
    "sales_router",
    "payments_router",
    "inventory_router",
    "dashboard_router",
    "reports_router",
    "settings_router",
    "backup_router",
]
