import os
import logging
import re

import httpx
from fastapi import HTTPException

USDA_URL = "https://api.nal.usda.gov/fdc/v1/foods/search"
logger = logging.getLogger("uvicorn.error")

# USDA identifies nutrients by number
PROTEIN, FAT, CARBS = "203", "204", "205"
# Calories are stored under different numbers depending on the food's data source
CALORIE_NUMBERS = ["208", "958", "957"]


def get_nutrient(food: dict, number: str) -> float | None:
    for nutrient in food.get("foodNutrients", []):
        if nutrient.get("nutrientNumber") == number:
            return nutrient.get("value")
    return None


def get_calories(food: dict) -> float | None:
    for number in CALORIE_NUMBERS:
        value = get_nutrient(food, number)
        if value is not None:
            return value
    return None

def clean_query(query: str) -> str:
    # USDA's search treats characters like / and quotes as query syntax,
    # so replace anything unusual with a space
    return re.sub(r"[^\w\s%,\-]", " ", query).strip()

async def search_foods(query: str, limit: int = 8) -> list[dict]:
    query = clean_query(query)
    if not query:
        return []
    api_key = os.environ.get("USDA_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="USDA_API_KEY is not set")

    async with httpx.AsyncClient(timeout=10) as client:
        try:
            res = await client.post(
                USDA_URL,
                params={"api_key": api_key},
                json={
                    "query": query,
                    "dataType": ["Foundation", "SR Legacy"],
                    "pageSize": limit,
                },
            )
            res.raise_for_status()
        except httpx.HTTPError as e:
            logger.error("USDA request failed: %r", e)
            raise HTTPException(status_code=502, detail="USDA API request failed")

    return [
        {
            "fdc_id": food["fdcId"],
            "description": food["description"],
            "calories": get_calories(food),
            "protein_g": get_nutrient(food, PROTEIN),
            "fat_g": get_nutrient(food, FAT),
            "carbs_g": get_nutrient(food, CARBS),
        }
        for food in res.json().get("foods", [])
    ]