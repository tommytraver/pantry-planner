import json
import os

from anthropic import APIError, AsyncAnthropic
from fastapi import HTTPException
from pydantic import ValidationError

from models import MealSuggestion, PantryItem

MODEL = "claude-haiku-4-5-20251001"

SYSTEM_PROMPT = """You are a meal planner for someone who lifts weights and wants high-protein meals.
Suggest meals that mainly use the pantry items provided. Prefer meals that dirty as few dishes as possible.
Assume basic staples (salt, pepper, oil, common spices) are available.

Respond with ONLY a JSON array. No markdown, no commentary. Each element must be:
{"name": string, "ingredients": [string], "steps": [string], "protein_g": integer, "calories": integer, "dishes": integer}

protein_g and calories are per-serving estimates. dishes is the number of pots, pans, and dishes to wash."""


def format_pantry(items: list[PantryItem]) -> str:
    return "\n".join(f"- {item.name} ({item.quantity} {item.unit})" for item in items)


def parse_meals(text: str) -> list[MealSuggestion]:
    # Strip markdown code fences in case the model adds them anyway
    cleaned = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        raw = json.loads(cleaned)
        return [MealSuggestion.model_validate(meal) for meal in raw]
    except (json.JSONDecodeError, ValidationError, TypeError):
        raise HTTPException(status_code=502, detail="AI returned an unexpected format")


async def suggest_meals(items: list[PantryItem], count: int = 3) -> list[MealSuggestion]:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not set")

    client = AsyncAnthropic()  # reads ANTHROPIC_API_KEY from the environment

    try:
        message = await client.messages.create(
            model=MODEL,
            max_tokens=2000,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": f"My pantry:\n{format_pantry(items)}\n\nSuggest {count} high-protein meals.",
                }
            ],
        )
    except APIError:
        raise HTTPException(status_code=502, detail="AI request failed")

    text = "".join(block.text for block in message.content if block.type == "text")
    meals = parse_meals(text)

    # Rank in our own code: most protein first, then fewest dishes
    return sorted(meals, key=lambda m: (-m.protein_g, m.dishes))