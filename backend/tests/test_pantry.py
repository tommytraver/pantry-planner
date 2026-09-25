import pytest

ITEM = {"name": "chicken breast", "quantity": 2, "unit": "lb"}


def test_add_and_list_items(client, make_user):
    headers = make_user()
    assert client.post("/pantry", json=ITEM, headers=headers).status_code == 201

    items = client.get("/pantry", headers=headers).json()
    assert len(items) == 1
    assert items[0]["name"] == "chicken breast"


@pytest.mark.parametrize(
    "bad_item",
    [
        {**ITEM, "quantity": -1},
        {**ITEM, "quantity": 0},
        {**ITEM, "unit": "banana"},
        {**ITEM, "name": "   "},
    ],
)
def test_invalid_items_rejected(client, make_user, bad_item):
    assert client.post("/pantry", json=bad_item, headers=make_user()).status_code == 422


def test_name_is_trimmed(client, make_user):
    headers = make_user()
    res = client.post("/pantry", json={**ITEM, "name": "  eggs  "}, headers=headers)
    assert res.json()["name"] == "eggs"


def test_update_item(client, make_user):
    headers = make_user()
    item = client.post("/pantry", json=ITEM, headers=headers).json()

    res = client.patch(f"/pantry/{item['id']}", json={"quantity": 5}, headers=headers)
    assert res.status_code == 200
    assert res.json()["quantity"] == 5
    assert res.json()["unit"] == "lb"  # fields not sent stay unchanged


def test_delete_item(client, make_user):
    headers = make_user()
    item = client.post("/pantry", json=ITEM, headers=headers).json()

    assert client.delete(f"/pantry/{item['id']}", headers=headers).status_code == 204
    assert client.get("/pantry", headers=headers).json() == []


def test_users_cannot_see_or_touch_each_others_items(client, make_user):
    alice = make_user("alice@test.com")
    bob = make_user("bob@test.com")
    item = client.post("/pantry", json=ITEM, headers=alice).json()

    assert client.get("/pantry", headers=bob).json() == []
    assert client.patch(f"/pantry/{item['id']}", json={"quantity": 9}, headers=bob).status_code == 404
    assert client.delete(f"/pantry/{item['id']}", headers=bob).status_code == 404
    assert len(client.get("/pantry", headers=alice).json()) == 1


def test_set_food_match(client, make_user):
    headers = make_user()
    item = client.post("/pantry", json=ITEM, headers=headers).json()
    food = {
        "fdc_id": 123,
        "description": "Chicken, breast, raw",
        "calories": 120,
        "protein_g": 22.5,
        "fat_g": 2.6,
        "carbs_g": 0,
    }

    res = client.put(f"/pantry/{item['id']}/food", json=food, headers=headers)
    assert res.status_code == 200
    assert res.json()["protein_100g"] == 22.5
    assert res.json()["food_description"] == "Chicken, breast, raw"