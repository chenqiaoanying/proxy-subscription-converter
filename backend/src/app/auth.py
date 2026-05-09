import logging
import uuid
from typing import Final

from fastapi import Cookie, Depends, HTTPException
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.database import get_db, settings
from src.app.models import User

logger = logging.getLogger(__name__)

SESSION_COOKIE_NAME: Final[str] = "session"
SESSION_MAX_AGE_SECONDS: Final[int] = 7 * 24 * 3600
OAUTH_STATE_COOKIE_NAME: Final[str] = "oauth_state"
OAUTH_STATE_MAX_AGE_SECONDS: Final[int] = 10 * 60


def _signer() -> URLSafeTimedSerializer:
    if not settings.session_secret:
        raise HTTPException(
            status_code=503,
            detail="Authentication not configured (SESSION_SECRET missing)",
        )
    return URLSafeTimedSerializer(settings.session_secret, salt="session-v1")


def sign_session(user_id: uuid.UUID) -> str:
    return _signer().dumps(str(user_id))


def verify_session(token: str) -> uuid.UUID | None:
    try:
        raw = _signer().loads(token, max_age=SESSION_MAX_AGE_SECONDS)
    except SignatureExpired:
        logger.info("Session cookie expired")
        return None
    except BadSignature:
        logger.warning("Invalid session cookie signature")
        return None
    try:
        return uuid.UUID(raw)
    except (TypeError, ValueError):
        return None


def sign_oauth_state(nonce: str) -> str:
    return _signer().dumps(nonce)


def verify_oauth_state(token: str) -> str | None:
    try:
        return _signer().loads(token, max_age=OAUTH_STATE_MAX_AGE_SECONDS)
    except (SignatureExpired, BadSignature):
        return None


async def get_current_user(
    session: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = verify_session(session)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid session")
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="User no longer exists")
    return user
