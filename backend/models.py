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