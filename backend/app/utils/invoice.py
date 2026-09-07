def generate_invoice_number(prefix: str = "INV") -> str:
    import uuid

    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"
