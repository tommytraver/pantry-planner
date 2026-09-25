from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# What the client sends when adding an item
class PantryItemCreate(BaseModel):
    name: str = Field(min_length=1)
    quantity: float = Field(gt=0)
    unit: str = Field(min_length=1)


# What the API sends back (same fields plus an id)
class PantryItem(PantryItemCreate):
    id: int


pantry: list[PantryItem] = []
next_id = 1


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/pantry")
def list_pantry() -> list[PantryItem]:
    return pantry


@app.post("/pantry", status_code=201)
def add_pantry_item(item: PantryItemCreate) -> PantryItem:
    global next_id
    new_item = PantryItem(id=next_id, **item.model_dump())
    pantry.append(new_item)
    next_id += 1
    return new_item


@app.delete("/pantry/{item_id}", status_code=204)
def delete_pantry_item(item_id: int):
    for i, item in enumerate(pantry):
        if item.id == item_id:
            pantry.pop(i)
            return
    raise HTTPException(status_code=404, detail="Item not found")