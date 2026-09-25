from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select

from database import create_tables, get_session
from models import NutritionResult, PantryItem, PantryItemCreate, PantryItemRead
from nutrition import search_foods


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/pantry")
def list_pantry(session: Session = Depends(get_session)) -> list[PantryItemRead]:
    return session.exec(select(PantryItem).order_by(PantryItem.id)).all()


@app.post("/pantry", status_code=201)
def add_pantry_item(
    item: PantryItemCreate, session: Session = Depends(get_session)
) -> PantryItemRead:
    db_item = PantryItem.model_validate(item)
    session.add(db_item)
    session.commit()
    session.refresh(db_item)
    return db_item


@app.delete("/pantry/{item_id}", status_code=204)
def delete_pantry_item(item_id: int, session: Session = Depends(get_session)):
    item = session.get(PantryItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    session.delete(item)
    session.commit()

@app.get("/nutrition")
async def get_nutrition(query: str = Query(min_length=1)) -> list[NutritionResult]:
    return await search_foods(query)