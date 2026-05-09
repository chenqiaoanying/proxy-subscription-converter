import logging
import secrets
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Cookie, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.auth import (
    OAUTH_STATE_COOKIE_NAME,
    OAUTH_STATE_MAX_AGE_SECONDS,
    SESSION_COOKIE_NAME,
    SESSION_MAX_AGE_SECONDS,
    get_current_user,
    sign_oauth_state,
    sign_session,
    verify_oauth_state,
)
from src.app.database import get_db, settings
from src.app.models import User
from src.app.schemas import UserOut

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_USER_URL = "https://api.github.com/user"


def _require_github_config() -> tuple[str, str]:
    if not settings.github_client_id or not settings.github_client_secret:
        raise HTTPException(
            status_code=503,
            detail="GitHub OAuth not configured",
        )
    return settings.github_client_id, settings.github_client_secret


def _is_secure_cookie() -> bool:
    return settings.oauth_redirect_url.startswith("https://")


@router.get("/login")
async def login() -> RedirectResponse:
    client_id, _ = _require_github_config()
    nonce = secrets.token_urlsafe(24)
    state = sign_oauth_state(nonce)
    params = {
        "client_id": client_id,
        "redirect_uri": settings.oauth_redirect_url,
        "scope": "read:user",
        "state": state,
        "allow_signup": "true",
    }
    url = f"{GITHUB_AUTHORIZE_URL}?{urlencode(params)}"
    response = RedirectResponse(url=url, status_code=302)
    response.set_cookie(
        key=OAUTH_STATE_COOKIE_NAME,
        value=state,
        max_age=OAUTH_STATE_MAX_AGE_SECONDS,
        httponly=True,
        secure=_is_secure_cookie(),
        samesite="lax",
        path="/",
    )
    return response


@router.get("/callback")
async def callback(
    code: str = Query(...),
    state: str = Query(...),
    oauth_state_cookie: str | None = Cookie(default=None, alias=OAUTH_STATE_COOKIE_NAME),
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    client_id, client_secret = _require_github_config()
    if not oauth_state_cookie or oauth_state_cookie != state:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")
    if verify_oauth_state(state) is None:
        raise HTTPException(status_code=400, detail="Expired OAuth state")

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            token_resp = await client.post(
                GITHUB_TOKEN_URL,
                headers={"Accept": "application/json"},
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "code": code,
                    "redirect_uri": settings.oauth_redirect_url,
                },
            )
            token_resp.raise_for_status()
            token_payload = token_resp.json()
            access_token = token_payload.get("access_token")
            if not access_token:
                logger.warning("GitHub token exchange returned no access_token")
                raise HTTPException(status_code=400, detail="OAuth exchange failed")

            user_resp = await client.get(
                GITHUB_USER_URL,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/vnd.github+json",
                },
            )
            user_resp.raise_for_status()
            gh_user = user_resp.json()
    except httpx.HTTPError as e:
        logger.exception("GitHub OAuth HTTP error")
        raise HTTPException(status_code=502, detail="Failed to contact GitHub") from e

    github_id = gh_user.get("id")
    login_name = gh_user.get("login")
    if not github_id or not login_name:
        raise HTTPException(status_code=502, detail="Invalid GitHub user payload")

    result = await db.execute(select(User).where(User.github_id == github_id))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(
            github_id=github_id,
            login=login_name,
            name=gh_user.get("name"),
            avatar_url=gh_user.get("avatar_url"),
        )
        db.add(user)
    else:
        user.login = login_name
        user.name = gh_user.get("name")
        user.avatar_url = gh_user.get("avatar_url")
    await db.commit()
    await db.refresh(user)

    session_token = sign_session(user.id)
    response = RedirectResponse(url=settings.frontend_url, status_code=302)
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_token,
        max_age=SESSION_MAX_AGE_SECONDS,
        httponly=True,
        secure=_is_secure_cookie(),
        samesite="lax",
        path="/",
    )
    response.delete_cookie(OAUTH_STATE_COOKIE_NAME, path="/")
    return response


@router.post("/logout")
async def logout() -> Response:
    response = Response(status_code=204)
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")
    return response


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)) -> User:
    return user
