from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class SettingBase(BaseModel):
    business_name: str = "A1 STEEL & CEMENT DEALER"
    tagline: str = "Wholesale & Retail Cement & Steel Suppliers"
    phone: str = "0300-0000000 / 0312-0000000"
    address: str = "Main G.T. Road, Pakistan"
    invoice_footer: str = "Thank you for your business! Items once sold cannot be returned without receipt."
    printer_type: str = "80mm"  # "80mm" or "58mm"
    currency_symbol: str = "Rs."


class SettingUpdate(BaseModel):
    business_name: Optional[str] = None
    tagline: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    invoice_footer: Optional[str] = None
    printer_type: Optional[str] = None
    currency_symbol: Optional[str] = None


class SettingResponse(SettingBase):
    id: int
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
