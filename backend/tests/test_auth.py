def test_signup_and_login(client):
    body = {"email": "a@test.com", "password": "password123"}

    res = client.post("/auth/signup", json=body)
    assert res.status_code == 201
    assert set(res.json().keys()) == {"id", "email"}  # never leaks the password hash

    res = client.post("/auth/login", json=body)
    assert res.status_code == 200
    assert res.json()["access_token"]


def test_duplicate_signup_rejected(client):
    body = {"email": "a@test.com", "password": "password123"}
    client.post("/auth/signup", json=body)
    assert client.post("/auth/signup", json=body).status_code == 409


def test_email_is_case_insensitive(client):
    client.post("/auth/signup", json={"email": "A@Test.com", "password": "password123"})
    res = client.post("/auth/login", json={"email": "a@test.com", "password": "password123"})
    assert res.status_code == 200


def test_wrong_password_rejected(client, make_user):
    make_user()
    res = client.post("/auth/login", json={"email": "a@test.com", "password": "wrong-password"})
    assert res.status_code == 401


def test_short_password_rejected(client):
    res = client.post("/auth/signup", json={"email": "a@test.com", "password": "short"})
    assert res.status_code == 422


def test_pantry_requires_login(client):
    assert client.get("/pantry").status_code in (401, 403)


def test_garbage_token_rejected(client):
    res = client.get("/pantry", headers={"Authorization": "Bearer not-a-real-token"})
    assert res.status_code == 401