from typing import List
from sqlalchemy.orm import Session
from decimal import Decimal

from app.models import Product, Customer, Supplier


DEFAULT_PRODUCTS = {
    "Cement": [
        {"name": "Cherat Cement", "unit": "Bag"},
        {"name": "Lucky Cement", "unit": "Bag"},
        {"name": "Askari Cement", "unit": "Bag"},
        {"name": "kohat", "unit": "Bag"},
    ],
    "Steel": [
        {"name": "1/2 Steel", "unit": "KG"},
        {"name": "1/4 Steel", "unit": "KG"},
        {"name": "5/8 Steel", "unit": "KG"},
        {"name": "6/8 Steel", "unit": "KG"},
        {"name": "buidingwire", "unit": "KG"},
    ],
    "Other Materials": [
        {"name": "Wheelbarrow", "unit": "PCS"},
        {"name": "Tyre", "unit": "PCS"},
        {"name": "Tube", "unit": "PCS"},
        {"name": "Rim", "unit": "PCS"},
        {"name": "Plastic", "unit": "PCS"},
        {"name": "Paint", "unit": "PCS"},
        {"name": "Bucket", "unit": "PCS"},
    ],
}

DEFAULT_CUSTOMERS = [
    "Seed Customer One",
    "Seed Customer Two",
    "Seed Customer Three",
    "Seed Customer Four",
    "Seed Customer Five",
]

DEFAULT_SUPPLIERS = [
    "Seed Supplier One",
    "Seed Supplier Two",
    "Seed Supplier Three",
    "Seed Supplier Four",
    "Seed Supplier Five",
]


def _normalize_code(name: str) -> str:
    code = name.strip().lower().replace(" ", "_").replace("/", "_").replace("-", "_")
    return f"seed_{code}"


def ensure_default_products(db: Session) -> List[str]:
    """Insert default categories/products idempotently. Returns list of created product_codes."""
    created: List[str] = []
    updated = False

    for category, items in DEFAULT_PRODUCTS.items():
        for item in items:
            name = item.get("name")
            unit = item.get("unit", "PCS")
            product_code = _normalize_code(name)

            existing = db.query(Product).filter(Product.product_code == product_code).first()
            if existing:
                if existing.category != category or existing.unit != unit:
                    existing.category = category
                    existing.unit = unit
                    db.add(existing)
                    updated = True
                continue

            p = Product(
                product_code=product_code,
                name=name,
                category=category,
                unit=unit,
                purchase_price=Decimal("0.00"),
                sale_price=Decimal("0.00"),
                current_stock=Decimal("0.000"),
                minimum_stock=Decimal("0.000"),
                is_active=True,
            )
            db.add(p)
            created.append(product_code)

    if created:
        db.commit()

    if updated and not created:
        db.commit()

    return created


def ensure_default_customers(db: Session) -> List[str]:
    created: List[str] = []
    for idx, name in enumerate(DEFAULT_CUSTOMERS, start=1):
        code = f"CUST-{idx:03d}"
        existing = db.query(Customer).filter(Customer.customer_code == code).first()
        if existing:
            continue
        db.add(
            Customer(
                customer_code=code,
                name=name,
                phone=f"0300-000-{idx:04d}",
                address=f"Customer Base Address {idx}",
                opening_balance=Decimal("0.00"),
                is_active=True,
            )
        )
        created.append(code)
    if created:
        db.commit()
    return created


def ensure_default_suppliers(db: Session) -> List[str]:
    created: List[str] = []
    for idx, name in enumerate(DEFAULT_SUPPLIERS, start=1):
        code = f"SUP-{idx:03d}"
        existing = db.query(Supplier).filter(Supplier.supplier_code == code).first()
        if existing:
            continue
        db.add(
            Supplier(
                supplier_code=code,
                name=name,
                phone=f"0310-000-{idx:04d}",
                address=f"Supplier Base Address {idx}",
                opening_balance=Decimal("0.00"),
                is_active=True,
            )
        )
        created.append(code)
    if created:
        db.commit()
    return created


def ensure_baseline_application_data(db: Session) -> dict:
    """Initialize the minimal baseline dataset required by CI/regression tests."""
    result = {
        "products": ensure_default_products(db),
        "customers": ensure_default_customers(db),
        "suppliers": ensure_default_suppliers(db),
    }
    return result
