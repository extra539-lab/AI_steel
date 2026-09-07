from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.models.inventory import InventoryTransaction
from app.schemas.inventory import (
    InventoryTransactionResponse,
    StockSummaryItem,
    InventoryReconciliationReport,
)
from app.services.inventory_service import InventoryService
from app.services.report_service import ReportService

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.get("/transactions", response_model=List[InventoryTransactionResponse])
def list_transactions(
    product_id: Optional[int] = Query(None),
    transaction_type: Optional[str] = Query(None),
    limit: int = Query(100),
    db: Session = Depends(get_db),
):
    query = db.query(InventoryTransaction)
    if product_id:
        query = query.filter(InventoryTransaction.product_id == product_id)
    if transaction_type:
        query = query.filter(InventoryTransaction.transaction_type == transaction_type)

    txns = query.order_by(desc(InventoryTransaction.transaction_date), desc(InventoryTransaction.id)).limit(limit).all()

    results = []
    for t in txns:
        product = t.product
        results.append(InventoryTransactionResponse(
            id=t.id,
            product_id=t.product_id,
            product_name=product.name if product else None,
            product_code=product.product_code if product else None,
            category=product.category if product else None,
            unit=product.unit if product else None,
            transaction_type=t.transaction_type,
            reference_id=t.reference_id,
            quantity=float(t.quantity),
            stock_before=float(t.stock_before),
            stock_after=float(t.stock_after),
            unit_price=float(t.unit_price),
            transaction_date=t.transaction_date,
            notes=t.notes,
            created_at=t.created_at,
        ))
    return results


@router.get("/summary", response_model=List[StockSummaryItem])
def get_stock_summary(
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    report = ReportService.get_inventory_report(db, category=category)
    return report.items


@router.get("/reconciliation", response_model=InventoryReconciliationReport)
def get_inventory_reconciliation(db: Session = Depends(get_db)):
    return InventoryService.reconcile_inventory(db)


@router.get("/product/{product_id}/history", response_model=List[InventoryTransactionResponse])
def get_product_history(product_id: int, limit: int = Query(100), db: Session = Depends(get_db)):
    txns = InventoryService.get_product_history(db, product_id, limit=limit)
    results = []
    for t in txns:
        product = t.product
        results.append(InventoryTransactionResponse(
            id=t.id,
            product_id=t.product_id,
            product_name=product.name if product else None,
            product_code=product.product_code if product else None,
            category=product.category if product else None,
            unit=product.unit if product else None,
            transaction_type=t.transaction_type,
            reference_id=t.reference_id,
            quantity=float(t.quantity),
            stock_before=float(t.stock_before),
            stock_after=float(t.stock_after),
            unit_price=float(t.unit_price),
            transaction_date=t.transaction_date,
            notes=t.notes,
            created_at=t.created_at,
        ))
    return results
