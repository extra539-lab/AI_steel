from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.payment import (
    CustomerPaymentCreate,
    CustomerPaymentResponse,
    CustomerPaymentVoidRequest,
    SupplierPaymentCreate,
    SupplierPaymentResponse,
    SupplierPaymentVoidRequest,
)
from app.services.payment_service import PaymentService

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("/customers", response_model=List[CustomerPaymentResponse])
def list_customer_payments(
    customer_id: Optional[int] = Query(None),
    limit: int = Query(200),
    db: Session = Depends(get_db),
):
    return PaymentService.list_customer_payments(db, customer_id=customer_id, limit=limit)


@router.post("/customers", response_model=CustomerPaymentResponse)
def create_customer_payment(payload: CustomerPaymentCreate, db: Session = Depends(get_db)):
    return PaymentService.create_customer_payment(db, payload)


@router.post("/customers/{payment_id}/void", response_model=CustomerPaymentResponse)
def void_customer_payment(payment_id: int, payload: CustomerPaymentVoidRequest, db: Session = Depends(get_db)):
    return PaymentService.void_customer_payment(db, payment_id, payload)


@router.get("/suppliers", response_model=List[SupplierPaymentResponse])
def list_supplier_payments(
    supplier_id: Optional[int] = Query(None),
    limit: int = Query(200),
    db: Session = Depends(get_db),
):
    return PaymentService.list_supplier_payments(db, supplier_id=supplier_id, limit=limit)


@router.post("/suppliers", response_model=SupplierPaymentResponse)
def create_supplier_payment(payload: SupplierPaymentCreate, db: Session = Depends(get_db)):
    return PaymentService.create_supplier_payment(db, payload)


@router.post("/suppliers/{payment_id}/void", response_model=SupplierPaymentResponse)
def void_supplier_payment(payment_id: int, payload: SupplierPaymentVoidRequest, db: Session = Depends(get_db)):
    return PaymentService.void_supplier_payment(db, payment_id, payload)
