import json
import logging
import os

from anthropic import APIError, AsyncAnthropic
from fastapi import HTTPException
from pydantic import ValidationError

from models import MealSuggestion, PantryItem

logger = logging.getLogger("uvicorn.error")

MODEL = "claude-haiku-4-5-20251001"

SYSTEM_PROMPT = """You are a meal planner for someone who lifts weights and wants high-protein meals.
Suggest meals that mainly use the pantry items provided. Prefer meals that dirty as few dishes as possible.
Assume basic staples (salt, pepper, oil, common spices) are available.

Respond with ONLY a JSON array. No markdown, no commentary. Each element must be:
{"name": string, "ingredients": [string], "steps": [string], "protein_g": integer, "calories": integer, "dishes": integer}

protein_g and calories are per-serving estimates. dishes is the number of pots, pans, and dishes to wash.
When per-100g nutrition data is provided for an ingredient, use it to estimate protein_g and calories."""


def format_item(item: PantryItem) -> str:
    line = f"- {item.name} ({item.quantity} {item.unit})"
    if item.protein_100g is not None and item.calories_100g is not None:
        line += f", per 100g: {item.protein_100g:g}g protein, {item.calories_100g:g} kcal"
    return line


def format_pantry(items: list[PantryItem]) -> str:
    return "\n".join(format_item(item) for item in items)


def parse_meals(text: str) -> list[MealSuggestion]:
    # Strip markdown code fences in case the model adds them anyway
    cleaned = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        raw = json.loads(cleaned)
        return [MealSuggestion.model_validate(meal) for meal in raw]
    except (json.JSONDecodeError, ValidationError, TypeError):
        logger.error("Unparseable AI output: %.500s", text)
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
    except APIError as e:
        logger.error("Anthropic request failed: %r", e)
        raise HTTPException(status_code=502, detail="AI request failed")

    text = "".join(block.text for block in message.content if block.type == "text")
    meals = parse_meals(text)

    # Rank in our own code: most protein first, then fewest dishes
    return sorted(meals, key=lambda m: (-m.protein_g, m.dishes))