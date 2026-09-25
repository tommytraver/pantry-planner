import os

# Test settings, set before the app is imported,
# so tests never touch your real database or keys
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("JWT_SECRET", "test-secret-that-is-long-enough-for-hs256")

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from database import get_session
from main import app


@pytest.fixture(name="session")
def session_fixture():
    # A brand-new in-memory database for every test
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


@pytest.fixture(name="client")
def client_fixture(session: Session):
    # Make every endpoint use the test database instead of Postgres
    app.dependency_overrides[get_session] = lambda: session
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def make_user(client: TestClient):
    # Sign up + log in, return headers for authenticated requests
    def _make_user(email: str = "a@test.com", password: str = "password123") -> dict:
        client.post("/auth/signup", json={"email": email, "password": password})
        res = client.post("/auth/login", json={"email": email, "password": password})
        return {"Authorization": f"Bearer {res.json()['access_token']}"}

    return _make_user