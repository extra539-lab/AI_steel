from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.report import (
    SalesReportSummary,
    PurchasesReportSummary,
    ProfitReportSummary,
    InventoryReportSummary,
)
from app.services.report_service import ReportService

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/sales", response_model=SalesReportSummary)
def get_sales_report(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    customer_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    return ReportService.get_sales_report(db, start_date=start_date, end_date=end_date, customer_id=customer_id)


@router.get("/purchases", response_model=PurchasesReportSummary)
def get_purchases_report(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    supplier_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    return ReportService.get_purchases_report(db, start_date=start_date, end_date=end_date, supplier_id=supplier_id)


@router.get("/inventory", response_model=InventoryReportSummary)
def get_inventory_report(
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    return ReportService.get_inventory_report(db, category=category)


@router.get("/profit", response_model=ProfitReportSummary)
def get_profit_report(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
):
    return ReportService.get_profit_report(db, start_date=start_date, end_date=end_date)
