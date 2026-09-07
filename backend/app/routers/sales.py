from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.models.sale import Sale
from app.schemas.sale import SaleCreate, SaleResponse, SaleItemResponse, SaleVoidRequest
from app.services.billing_service import BillingService

router = APIRouter(prefix="/sales", tags=["sales"])


@router.get("/", response_model=List[SaleResponse])
def list_sales(
    customer_id: Optional[int] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    search: Optional[str] = Query(None),
    include_voided: bool = False,
    limit: int = Query(100),
    db: Session = Depends(get_db),
):
    query = db.query(Sale)
    if not include_voided:
        query = query.filter(Sale.status == "ACTIVE")
    if customer_id:
        query = query.filter(Sale.customer_id == customer_id)
    if start_date:
        query = query.filter(Sale.sale_date >= start_date)
    if end_date:
        query = query.filter(Sale.sale_date <= end_date)
    if search:
        term = f"%{search}%"
        query = query.filter(Sale.invoice_number.ilike(term))

    sales = query.order_by(desc(Sale.sale_date), desc(Sale.id)).limit(limit).all()

    results = []
    for s in sales:
        item_responses = []
        for item in s.items:
            item_responses.append(SaleItemResponse(
                id=item.id,
                product_id=item.product_id,
                product_name=item.product.name if item.product else None,
                product_code=item.product.product_code if item.product else None,
                category=item.product.category if item.product else None,
                unit=item.product.unit if item.product else None,
                quantity=float(item.quantity),
                unit_price=float(item.unit_price),
                total=float(item.total),
                unit_cost=float(item.unit_cost) if item.unit_cost is not None else None,
                cost_total=float(item.cost_total) if item.cost_total is not None else None,
            ))

        results.append(SaleResponse(
            id=s.id,
            invoice_number=s.invoice_number,
            customer_id=s.customer_id,
            customer_name=s.customer.name if s.customer else "Unknown",
            customer_code=s.customer.customer_code if s.customer else "",
            customer_phone=s.customer.phone if s.customer else "",
            customer_address=s.customer.address if s.customer else "",
            sale_date=s.sale_date,
            subtotal=float(s.subtotal),
            discount=float(s.discount),
            total_amount=float(s.total_amount),
            paid_amount=float(s.paid_amount),
            remaining_amount=float(s.remaining_amount),
            payment_method=s.payment_method,
            notes=s.notes,
            status=s.status,
            void_reason=s.void_reason,
            voided_at=s.voided_at,
            items=item_responses,
            customer_previous_balance=0.0,
            customer_total_balance=0.0,
            created_at=s.created_at,
        ))
    return results


@router.get("/{sale_id}", response_model=SaleResponse)
def get_sale(sale_id: int, db: Session = Depends(get_db)):
    return BillingService.get_sale_by_id(db, sale_id)


@router.post("/", response_model=SaleResponse)
def create_sale(payload: SaleCreate, db: Session = Depends(get_db)):
    return BillingService.create_sale(db, payload)


@router.post("/{sale_id}/void", response_model=SaleResponse)
def void_sale(sale_id: int, payload: SaleVoidRequest, db: Session = Depends(get_db)):
    return BillingService.void_sale(db, sale_id, payload)
