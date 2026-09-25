from pydantic import EmailStr
from sqlmodel import Field, SQLModel


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

class PantryItemBase(SQLModel):
    name: str = Field(min_length=1)
    quantity: float = Field(gt=0)
    unit: str = Field(min_length=1)


class PantryItem(PantryItemBase, table=True):
    __tablename__ = "pantry_items"
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)


class PantryItemCreate(PantryItemBase):
    pass


class PantryItemRead(PantryItemBase):
    id: int


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