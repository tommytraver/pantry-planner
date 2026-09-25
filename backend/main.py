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
from suggestions import suggest_meals


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


@app.get("/auth/me")
def me(user: User = Depends(get_current_user)) -> UserRead:
    return user


# ---------- Pantry ----------

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
    item = session.get(PantryItem, item_id)
    if not item or item.user_id != user.id:
        raise HTTPException(status_code=404, detail="Item not found")

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
    item = session.get(PantryItem, item_id)
    if not item or item.user_id != user.id:
        raise HTTPException(status_code=404, detail="Item not found")
    session.delete(item)
    session.commit()


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
    return await suggest_meals(items)