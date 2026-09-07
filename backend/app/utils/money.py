from decimal import Decimal, ROUND_HALF_UP
from typing import Union, Optional

MONEY_PRECISION = Decimal("0.01")
QTY_PRECISION = Decimal("0.001")


def to_decimal(value: Optional[Union[float, int, str, Decimal]], default: str = "0.00") -> Decimal:
    """Converts a float, int, str, or Decimal to a precise Decimal object."""
    if value is None:
        return Decimal(default)
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def quantize_money(value: Optional[Union[float, int, str, Decimal]]) -> Decimal:
    """Rounds a monetary value to 2 decimal places using standard ROUND_HALF_UP."""
    d = to_decimal(value, "0.00")
    return d.quantize(MONEY_PRECISION, rounding=ROUND_HALF_UP)


def quantize_qty(value: Optional[Union[float, int, str, Decimal]]) -> Decimal:
    """Rounds a quantity to 3 decimal places (supporting precise KG / Bag quantities)."""
    d = to_decimal(value, "0.000")
    return d.quantize(QTY_PRECISION, rounding=ROUND_HALF_UP)


def money_to_float(value: Optional[Union[float, Decimal]]) -> float:
    """Converts a Decimal money value to float for API response serialization if needed."""
    if value is None:
        return 0.0
    return float(quantize_money(value))
