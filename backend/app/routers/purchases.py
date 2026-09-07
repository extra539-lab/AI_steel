from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.models.purchase import Purchase
from app.schemas.purchase import PurchaseCreate, PurchaseResponse, PurchaseItemResponse, PurchaseVoidRequest
from app.services.purchase_service import PurchaseService

router = APIRouter(prefix="/purchases", tags=["purchases"])


@router.get("/", response_model=List[PurchaseResponse])
def list_purchases(
    supplier_id: Optional[int] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    search: Optional[str] = Query(None),
    include_voided: bool = False,
    limit: int = Query(100),
    db: Session = Depends(get_db),
):
    query = db.query(Purchase)
    if not include_voided:
        query = query.filter(Purchase.status == "ACTIVE")
    if supplier_id:
        query = query.filter(Purchase.supplier_id == supplier_id)
    if start_date:
        query = query.filter(Purchase.purchase_date >= start_date)
    if end_date:
        query = query.filter(Purchase.purchase_date <= end_date)
    if search:
        term = f"%{search}%"
        query = query.filter(Purchase.purchase_number.ilike(term))

    purchases = query.order_by(desc(Purchase.purchase_date), desc(Purchase.id)).limit(limit).all()

    results = []
    for p in purchases:
        item_responses = []
        for item in p.items:
            item_responses.append(PurchaseItemResponse(
                id=item.id,
                product_id=item.product_id,
                product_name=item.product.name if item.product else None,
                product_code=item.product.product_code if item.product else None,
                category=item.product.category if item.product else None,
                unit=item.product.unit if item.product else None,
                quantity=float(item.quantity),
                unit_price=float(item.unit_price),
                total=float(item.total),
            ))

        results.append(PurchaseResponse(
            id=p.id,
            purchase_number=p.purchase_number,
            supplier_id=p.supplier_id,
            supplier_name=p.supplier.name if p.supplier else "Unknown",
            supplier_code=p.supplier.supplier_code if p.supplier else "",
            purchase_date=p.purchase_date,
            subtotal=float(p.subtotal),
            discount=float(p.discount),
            total_amount=float(p.total_amount),
            paid_amount=float(p.paid_amount),
            remaining_amount=float(p.remaining_amount),
            payment_method=p.payment_method,
            notes=p.notes,
            status=p.status,
            void_reason=p.void_reason,
            voided_at=p.voided_at,
            items=item_responses,
            created_at=p.created_at,
        ))
    return results


@router.get("/{purchase_id}", response_model=PurchaseResponse)
def get_purchase(purchase_id: int, db: Session = Depends(get_db)):
    return PurchaseService.get_purchase_by_id(db, purchase_id)


@router.post("/", response_model=PurchaseResponse)
def create_purchase(payload: PurchaseCreate, db: Session = Depends(get_db)):
    return PurchaseService.create_purchase(db, payload)


@router.post("/{purchase_id}/void", response_model=PurchaseResponse)
def void_purchase(purchase_id: int, payload: PurchaseVoidRequest, db: Session = Depends(get_db)):
    return PurchaseService.void_purchase(db, purchase_id, payload)
