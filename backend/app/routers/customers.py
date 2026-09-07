from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.customer import Customer
from app.schemas.customer import (
    CustomerCreate,
    CustomerResponse,
    CustomerUpdate,
    CustomerLedgerResponse,
)
from app.services.ledger_service import LedgerService
from app.utils.numbering import get_next_customer_code

router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("/", response_model=List[CustomerResponse])
def list_customers(
    search: Optional[str] = Query(None, description="Search by name, code, or phone"),
    active_only: bool = True,
    db: Session = Depends(get_db),
):
    query = db.query(Customer)
    if active_only:
        query = query.filter(Customer.is_active == True)
    if search:
        term = f"%{search}%"
        query = query.filter(
            Customer.name.ilike(term) | Customer.customer_code.ilike(term) | Customer.phone.ilike(term)
        )

    customers = query.order_by(Customer.name).all()
    results = []
    for c in customers:
        summary = LedgerService.get_customer_summary(db, c.id)
        results.append(CustomerResponse(
            id=c.id,
            customer_code=c.customer_code,
            name=c.name,
            phone=c.phone,
            address=c.address,
            opening_balance=c.opening_balance,
            is_active=c.is_active,
            current_balance=summary["current_balance"],
            total_sales=summary["total_sales"],
            total_paid=summary["total_paid"],
            created_at=c.created_at,
            updated_at=c.updated_at,
        ))
    return results


@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")

    summary = LedgerService.get_customer_summary(db, c.id)
    return CustomerResponse(
        id=c.id,
        customer_code=c.customer_code,
        name=c.name,
        phone=c.phone,
        address=c.address,
        opening_balance=c.opening_balance,
        is_active=c.is_active,
        current_balance=summary["current_balance"],
        total_sales=summary["total_sales"],
        total_paid=summary["total_paid"],
        created_at=c.created_at,
        updated_at=c.updated_at,
    )


@router.post("/", response_model=CustomerResponse)
def create_customer(payload: CustomerCreate, db: Session = Depends(get_db)):
    code = payload.customer_code or get_next_customer_code(db)

    if db.query(Customer).filter(Customer.customer_code == code).first():
        raise HTTPException(status_code=400, detail=f"Customer code '{code}' already exists")

    customer = Customer(
        customer_code=code,
        name=payload.name,
        phone=payload.phone,
        address=payload.address,
        opening_balance=payload.opening_balance,
        is_active=payload.is_active,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)

    return CustomerResponse(
        id=customer.id,
        customer_code=customer.customer_code,
        name=customer.name,
        phone=customer.phone,
        address=customer.address,
        opening_balance=customer.opening_balance,
        is_active=customer.is_active,
        current_balance=customer.opening_balance or 0.0,
        total_sales=0.0,
        total_paid=0.0,
        created_at=customer.created_at,
        updated_at=customer.updated_at,
    )


@router.put("/{customer_id}", response_model=CustomerResponse)
def update_customer(customer_id: int, payload: CustomerUpdate, db: Session = Depends(get_db)):
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(c, field, value)

    db.commit()
    db.refresh(c)

    summary = LedgerService.get_customer_summary(db, c.id)
    return CustomerResponse(
        id=c.id,
        customer_code=c.customer_code,
        name=c.name,
        phone=c.phone,
        address=c.address,
        opening_balance=c.opening_balance,
        is_active=c.is_active,
        current_balance=summary["current_balance"],
        total_sales=summary["total_sales"],
        total_paid=summary["total_paid"],
        created_at=c.created_at,
        updated_at=c.updated_at,
    )


@router.delete("/{customer_id}")
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")

    c.is_active = False
    db.commit()
    return {"message": f"Customer '{c.name}' archived successfully"}


@router.get("/{customer_id}/ledger", response_model=CustomerLedgerResponse)
def get_customer_ledger(customer_id: int, db: Session = Depends(get_db)):
    return LedgerService.get_customer_ledger(db, customer_id)
