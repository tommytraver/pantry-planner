from sqlmodel import Field, SQLModel


class PantryItemBase(SQLModel):
    name: str = Field(min_length=1)
    quantity: float = Field(gt=0)
    unit: str = Field(min_length=1)


# The actual database table
class PantryItem(PantryItemBase, table=True):
    __tablename__ = "pantry_items"
    id: int | None = Field(default=None, primary_key=True)


# What the client sends
class PantryItemCreate(PantryItemBase):
    pass


# What the API returns
class PantryItemRead(PantryItemBase):
    id: int

# Nutrition per 100g, simplified from the USDA response
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