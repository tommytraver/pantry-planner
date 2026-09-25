import os
import secrets
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select

from auth import create_access_token, get_current_user, hash_password, verify_password
from database import create_tables, get_session
from models import (
    MealSuggestion,
    NutritionResult,
    PantryItem,
    PantryItemCreate,
    PantryItemRead,
    PantryItemUpdate,
    Token,
    User,
    UserCreate,
    UserLogin,
    UserRead,
)
from nutrition import search_foods
from rate_limits import check_and_record_suggestion
from suggestions import suggest_meals

# Comma-separated list of frontend URLs allowed to call this API
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

# What every demo account starts with
DEMO_PANTRY = [
    ("chicken breast", 3, "lb"),
    ("eggs", 24, "count"),
    ("greek yogurt", 32, "oz"),
    ("jasmine rice", 2, "lb"),
    ("broccoli", 1, "lb"),
    ("sweet potato", 2, "lb"),
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


# ---------- Auth ----------

@app.post("/auth/signup", status_code=201)
def signup(data: UserCreate, session: Session = Depends(get_session)) -> UserRead:
    email = data.email.lower()
    if session.exec(select(User).where(User.email == email)).first():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(email=email, password_hash=hash_password(data.password))
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@app.post("/auth/login")
def login(data: UserLogin, session: Session = Depends(get_session)) -> Token:
    user = session.exec(select(User).where(User.email == data.email.lower())).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return Token(access_token=create_access_token(user.id))


@app.post("/auth/demo")
def demo_login(session: Session = Depends(get_session)) -> Token:
    # Each visitor gets their own throwaway account, so demo users never collide
    user = User(
        email=f"demo-{secrets.token_hex(6)}@demo.pantryplanner",
        password_hash=hash_password(secrets.token_urlsafe(32)),
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    for name, quantity, unit in DEMO_PANTRY:
        session.add(PantryItem(user_id=user.id, name=name, quantity=quantity, unit=unit))
    session.commit()

    return Token(access_token=create_access_token(user.id))


@app.get("/auth/me")
def me(user: User = Depends(get_current_user)) -> UserRead:
    return user


# ---------- Pantry ----------

def get_owned_item(session: Session, item_id: int, user: User) -> PantryItem:
    item = session.get(PantryItem, item_id)
    if not item or item.user_id != user.id:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@app.get("/pantry")
def list_pantry(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[PantryItemRead]:
    statement = (
        select(PantryItem)
        .where(PantryItem.user_id == user.id)
        .order_by(PantryItem.id)
    )
    return session.exec(statement).all()


@app.post("/pantry", status_code=201)
def add_pantry_item(
    item: PantryItemCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> PantryItemRead:
    db_item = PantryItem.model_validate(item, update={"user_id": user.id})
    session.add(db_item)
    session.commit()
    session.refresh(db_item)
    return db_item


@app.patch("/pantry/{item_id}")
def update_pantry_item(
    item_id: int,
    changes: PantryItemUpdate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> PantryItemRead:
    item = get_owned_item(session, item_id, user)
    item.sqlmodel_update(changes.model_dump(exclude_unset=True, exclude_none=True))
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


@app.delete("/pantry/{item_id}", status_code=204)
def delete_pantry_item(
    item_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    item = get_owned_item(session, item_id, user)
    session.delete(item)
    session.commit()


@app.put("/pantry/{item_id}/food")
def set_item_food(
    item_id: int,
    food: NutritionResult,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> PantryItemRead:
    item = get_owned_item(session, item_id, user)
    item.fdc_id = food.fdc_id
    item.food_description = food.description
    item.calories_100g = food.calories
    item.protein_100g = food.protein_g
    item.fat_100g = food.fat_g
    item.carbs_100g = food.carbs_g
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


# ---------- Nutrition + AI ----------

@app.get("/nutrition", dependencies=[Depends(get_current_user)])
async def get_nutrition(query: str = Query(min_length=1)) -> list[NutritionResult]:
    return await search_foods(query)


@app.post("/meals/suggest")
async def suggest(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[MealSuggestion]:
    items = session.exec(select(PantryItem).where(PantryItem.user_id == user.id)).all()
    if not items:
        raise HTTPException(status_code=400, detail="Add pantry items first")
    check_and_record_suggestion(session, user.id)
    return await suggest_meals(items)