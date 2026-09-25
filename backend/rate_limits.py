from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlmodel import Session, func, select

from models import SuggestionRequest

PER_USER_PER_HOUR = 10
GLOBAL_PER_DAY = 200


def count_requests_since(session: Session, since: datetime, user_id: int | None = None) -> int:
    statement = (
        select(func.count())
        .select_from(SuggestionRequest)
        .where(SuggestionRequest.created_at > since)
    )
    if user_id is not None:
        statement = statement.where(SuggestionRequest.user_id == user_id)
    return session.exec(statement).one()


def check_and_record_suggestion(session: Session, user_id: int) -> None:
    now = datetime.now(timezone.utc)

    if count_requests_since(session, now - timedelta(hours=1), user_id) >= PER_USER_PER_HOUR:
        raise HTTPException(
            status_code=429,
            detail=f"You've hit the limit of {PER_USER_PER_HOUR} suggestions per hour. Try again later.",
        )

    if count_requests_since(session, now - timedelta(days=1)) >= GLOBAL_PER_DAY:
        raise HTTPException(
            status_code=429,
            detail="The app has hit its daily suggestion limit. Try again tomorrow.",
        )

    session.add(SuggestionRequest(user_id=user_id))
    session.commit()