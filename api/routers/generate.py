import asyncio
import re
import uuid
from copy import deepcopy
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import get_db
from api.models import Config
from api.schemas import ConfigData, FilterConfig, MatchRule, SubscriptionConfig

router = APIRouter()


def _matches_rule(proxy_tag: str, proxy_type: str, rule: MatchRule) -> bool:
    """Return True if the proxy matches the given MatchRule."""
    if rule.proxy_type and proxy_type not in rule.proxy_type:
        return False
    if rule.pattern:
        pattern = rule.pattern
        flags = 0 if rule.match_case else re.IGNORECASE
        if not rule.regex:
            pattern = re.escape(pattern)
            if rule.match_whole_word:
                pattern = rf"\b{pattern}\b"
        if not re.search(pattern, proxy_tag, flags):
            return False
    return True


def _apply_filter(
    proxies: list[dict[str, Any]], f: FilterConfig
) -> list[dict[str, Any]]:
    result = proxies
    if f.include:
        result = [
            p
            for p in result
            if _matches_rule(p.get("tag", ""), p.get("type", ""), f.include)
        ]
    if f.exclude:
        result = [
            p
            for p in result
            if not _matches_rule(p.get("tag", ""), p.get("type", ""), f.exclude)
        ]
    return result


async def _fetch_subscription(
    name: str, sub: SubscriptionConfig
) -> tuple[str, list[dict[str, Any]]]:
    headers: dict[str, str] = {}
    if sub.user_agent:
        headers["User-Agent"] = sub.user_agent
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            sub.url, headers=headers, follow_redirects=True, timeout=30.0
        )
        resp.raise_for_status()
    data = resp.json()
    proxies = [o for o in data.get("outbounds", []) if "server" in o]
    return name, proxies


async def _run_generate(config: ConfigData) -> dict[str, Any]:
    sub_cfg = config.subscriber

    # Fetch all enabled subscriptions concurrently
    enabled_subs = [
        (name, s)
        for name, s in sub_cfg.subscriptions.items()
        if s.enabled
    ]
    fetch_results = await asyncio.gather(
        *[_fetch_subscription(name, s) for name, s in enabled_subs],
        return_exceptions=True,
    )
    proxy_map: dict[str, list[dict[str, Any]]] = {}
    for item in fetch_results:
        if isinstance(item, BaseException):
            continue
        name, proxies = item
        proxy_map[name] = proxies

    # Load the template
    template_src = config.config_template
    if isinstance(template_src, str):
        async with httpx.AsyncClient() as client:
            resp = await client.get(template_src, timeout=30.0)
            resp.raise_for_status()
        template: dict[str, Any] = resp.json()
    elif isinstance(template_src, dict):
        template = deepcopy(template_src)
    else:
        template = {}

    generated_outbounds: list[dict[str, Any]] = []

    # Subscription-level outbound groups (subscriptions that have a tag set)
    for name, s in sub_cfg.subscriptions.items():
        if s.tag and s.enabled:
            proxies = proxy_map.get(name, [])
            generated_outbounds.append(
                {"tag": s.tag, "type": "selector", "outbounds": proxies}
            )

    # Filter outbound groups
    for f in sub_cfg.filters:
        source_names = f.subscriptions if f.subscriptions else list(proxy_map.keys())
        proxies = [p for n in source_names for p in proxy_map.get(n, [])]
        proxies = _apply_filter(proxies, f)
        generated_outbounds.append(
            {"tag": f.tag, "type": f.type, "outbounds": proxies}
        )

    # Prepend generated groups to template outbounds
    existing_outbounds: list[Any] = template.get("outbounds", [])
    template["outbounds"] = generated_outbounds + existing_outbounds

    return template


@router.post("/generate")
async def generate_from_body(config: ConfigData):
    """Case 1: generate directly from a ConfigData body (no DB needed)."""
    result = await _run_generate(config)
    return JSONResponse(content=result)


@router.get("/generate")
async def generate_from_url(url: str):
    """Case 2: fetch ConfigData from a URL (Gist, S3, etc.) and generate (no DB needed)."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, follow_redirects=True, timeout=30.0)
            resp.raise_for_status()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch config URL: {e}")
    try:
        config = ConfigData.model_validate(resp.json())
    except Exception:
        raise HTTPException(
            status_code=422, detail="URL did not return a valid config document"
        )
    result = await _run_generate(config)
    return JSONResponse(content=result)


@router.get("/configs/{config_id}/generate")
async def generate_config(
    config_id: uuid.UUID, db: AsyncSession = Depends(get_db)
):
    """Load config from DB by ID and generate (requires DATABASE_URL)."""
    row = await db.get(Config, config_id)
    if not row:
        raise HTTPException(status_code=404, detail="Config not found")
    config = ConfigData.model_validate(row.data)
    result = await _run_generate(config)
    return JSONResponse(content=result)
