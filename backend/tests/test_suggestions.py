import pytest
from fastapi import HTTPException

import main
import rate_limits
from suggestions import parse_meals

MEAL = (
    '{"name": "Chicken rice bowl", "ingredients": ["chicken", "rice"], '
    '"steps": ["Cook"], "protein_g": 45, "calories": 600, "dishes": 2}'
)


def test_parse_meals_handles_code_fences():
    meals = parse_meals(f"```json\n[{MEAL}]\n```")
    assert meals[0].protein_g == 45


def test_parse_meals_rejects_bad_output():
    with pytest.raises(HTTPException) as exc:
        parse_meals("Sorry, I can't help with that.")
    assert exc.value.status_code == 502


def test_suggestions_are_rate_limited(client, make_user, monkeypatch):
    # Replace the real AI call with a fake: no network, no cost
    async def fake_suggest_meals(items):
        return []

    monkeypatch.setattr(main, "suggest_meals", fake_suggest_meals)
    monkeypatch.setattr(rate_limits, "PER_USER_PER_HOUR", 2)

    headers = make_user()
    client.post("/pantry", json={"name": "eggs", "quantity": 12, "unit": "count"}, headers=headers)

    assert client.post("/meals/suggest", headers=headers).status_code == 200
    assert client.post("/meals/suggest", headers=headers).status_code == 200
    assert client.post("/meals/suggest", headers=headers).status_code == 429

def test_parse_meals_accepts_decimal_numbers():
    meal = MEAL.replace('"protein_g": 45', '"protein_g": 45.5')
    assert parse_meals(f"[{meal}]")[0].protein_g == 45.5