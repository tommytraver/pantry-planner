from typing import Annotated, Literal

from pydantic import EmailStr, StringConstraints
from pydantic import Field as PydanticField
from sqlmodel import Field, SQLModel

# ---------- Reusable validated types ----------

Unit = Literal["g", "kg", "oz", "lb", "ml", "l", "cup", "tbsp", "tsp", "count"]
ItemName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)
]
Quantity = Annotated[float, PydanticField(gt=0, le=100_000)]


# ---------- Users ----------

class User(SQLModel, table=True):
    __tablename__ = "users"
    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    password_hash: str


class UserCreate(SQLModel):
    email: EmailStr
    password: str = Field(min_length=8)


class UserLogin(SQLModel):
    email: EmailStr
    password: str


class UserRead(SQLModel):
    id: int
    email: str


class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"


# ---------- Pantry ----------

class PantryItem(SQLModel, table=True):
    __tablename__ = "pantry_items"
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    name: str
    quantity: float
    unit: str


class PantryItemCreate(SQLModel):
    name: ItemName
    quantity: Quantity
    unit: Unit


# Every field optional: the client sends only what it wants to change
class PantryItemUpdate(SQLModel):
    name: ItemName | None = None
    quantity: Quantity | None = None
    unit: Unit | None = None


class PantryItemRead(SQLModel):
    id: int
    name: str
    quantity: float
    unit: str


# ---------- External data ----------

class NutritionResult(SQLModel):
    fdc_id: int
    description: str
    calories: float | None
    protein_g: float | None
    fat_g: float | None
    carbs_g: float | None


class MealSuggestion(SQLModel):
    name: str
    ingredients: list[str]
    steps: list[str]
    protein_g: int
    calories: int
    dishes: int