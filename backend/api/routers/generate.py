import asyncio
import re
import uuid
from collections import defaultdict
from copy import deepcopy
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import get_db
from api.models import Config
from api.schemas import (
    AutoRegionGroupConfig,
    ConfigData,
    GroupConfig,
    MatchRule,
    ProxyPreview,
    SubscriptionConfig,
    SubscriptionPreviewRequest,
    SubscriptionPreviewResponse,
)

router = APIRouter()

REGION_KEYWORD_MAP: dict[str, list[str]] = {
    "HK": ["HK", "Hong Kong", "香港", "港"],
    "TW": ["TW", "Taiwan", "台湾", "台灣", "台北"],
    "JP": ["JP", "Japan", "日本", "东京", "大阪", "Tokyo", "Osaka"],
    "KR": ["KR", "Korea", "韩国", "韓國", "首尔", "Seoul"],
    "SG": ["SG", "Singapore", "新加坡", "狮城"],
    "US": ["US", "USA", "United States", "美国", "纽约", "洛杉矶", "New York", "Los Angeles", "Seattle", "Chicago"],
    "GB": ["GB", "UK", "United Kingdom", "英国", "英國", "伦敦", "London"],
    "DE": ["DE", "Germany", "德国", "德國", "法兰克福", "Frankfurt"],
    "FR": ["FR", "France", "法国", "法國", "巴黎", "Paris"],
    "NL": ["NL", "Netherlands", "荷兰", "荷蘭", "阿姆斯特丹"],
    "CA": ["CA", "Canada", "加拿大", "多伦多", "Toronto"],
    "AU": ["AU", "Australia", "澳大利亚", "澳洲", "Sydney"],
    "IN": ["IN", "India", "印度", "Mumbai"],
    "BR": ["BR", "Brazil", "巴西"],
    "RU": ["RU", "Russia", "俄罗斯", "Moscow"],
    "TR": ["TR", "Turkey", "土耳其"],
    "AR": ["AR", "Argentina", "阿根廷"],
    "PH": ["PH", "Philippines", "菲律宾"],
    "ID": ["ID", "Indonesia", "印尼", "印度尼西亚"],
    "MY": ["MY", "Malaysia", "马来西亚"],
    "TH": ["TH", "Thailand", "泰国"],
    "VN": ["VN", "Vietnam", "越南"],
}

REGION_EMOJI: dict[str, str] = {
    "HK": "🇭🇰", "TW": "🇹🇼", "JP": "🇯🇵", "KR": "🇰🇷",
    "SG": "🇸🇬", "US": "🇺🇸", "GB": "🇬🇧", "DE": "🇩🇪",
    "FR": "🇫🇷", "NL": "🇳🇱", "CA": "🇨🇦", "AU": "🇦🇺",
    "IN": "🇮🇳", "BR": "🇧🇷", "RU": "🇷🇺", "TR": "🇹🇷",
    "AR": "🇦🇷", "PH": "🇵🇭", "ID": "🇮🇩", "MY": "🇲🇾",
    "TH": "🇹🇭", "VN": "🇻🇳",
}


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


def _apply_filter_rules(
    proxies: list[dict[str, Any]],
    include: MatchRule | None,
    exclude: MatchRule | None,
) -> list[dict[str, Any]]:
    result = proxies
    if include:
        result = [
            p for p in result
            if _matches_rule(p.get("tag", ""), p.get("type", ""), include)
        ]
    if exclude:
        result = [
            p for p in result
            if not _matches_rule(p.get("tag", ""), p.get("type", ""), exclude)
        ]
    return result


def _detect_region(proxy_tag: str, region_map: dict[str, str]) -> str | None:
    """Detect region code from proxy tag. User region_map overrides built-in map."""
    tag_lower = proxy_tag.lower()
    for keyword, region in region_map.items():
        if keyword.lower() in tag_lower:
            return region
    for region_code, keywords in REGION_KEYWORD_MAP.items():
        for keyword in keywords:
            if keyword.lower() in tag_lower:
                return region_code
    return None


def _region_label(region: str, use_emoji: bool) -> str:
    if use_emoji and region in REGION_EMOJI:
        return f"{REGION_EMOJI[region]} {region}"
    return region


def _emit_group(
    tag: str,
    group_type: str,
    proxies: list[dict[str, Any]],
    generated_groups: list[dict[str, Any]],
    all_proxy_outbounds: dict[str, dict[str, Any]],
) -> None:
    proxy_tags = [p["tag"] for p in proxies if "tag" in p]
    generated_groups.append({"tag": tag, "type": group_type, "outbounds": proxy_tags})
    for p in proxies:
        if "tag" in p:
            all_proxy_outbounds[p["tag"]] = p


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


@router.post("/subscriptions/preview", response_model=SubscriptionPreviewResponse)
async def preview_subscription(req: SubscriptionPreviewRequest) -> SubscriptionPreviewResponse:
    """Fetch proxies from a single subscription URL (no DB, no template)."""
    try:
        _, proxies = await _fetch_subscription(
            "_", SubscriptionConfig(url=req.url, enabled=True, user_agent=req.user_agent)
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch subscription: {e}")
    return SubscriptionPreviewResponse(
        proxies=[ProxyPreview(tag=p.get("tag", ""), type=p.get("type", "")) for p in proxies]
    )


def _topological_sort(groups: list[GroupConfig]) -> list[int]:
    """Return group indices in dependency order (dependencies before dependents).
    Falls back to original order if a cycle is detected."""
    tag_to_idx: dict[str, int] = {}
    for i, group in enumerate(groups):
        tag = group.group_tag if isinstance(group, AutoRegionGroupConfig) else group.tag
        tag_to_idx[tag] = i

    deps: list[list[int]] = [[] for _ in range(len(groups))]
    for i, group in enumerate(groups):
        for imp in group.imports:
            if imp in tag_to_idx:
                deps[i].append(tag_to_idx[imp])

    visited = [False] * len(groups)
    in_stack = [False] * len(groups)
    order: list[int] = []
    has_cycle = False

    def dfs(idx: int) -> None:
        nonlocal has_cycle
        if has_cycle or visited[idx]:
            return
        if in_stack[idx]:
            has_cycle = True
            return
        in_stack[idx] = True
        for dep in deps[idx]:
            dfs(dep)
        in_stack[idx] = False
        visited[idx] = True
        order.append(idx)

    for i in range(len(groups)):
        if not visited[i]:
            dfs(i)

    return list(range(len(groups))) if has_cycle else order


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

    generated_groups: list[dict[str, Any]] = []
    all_proxy_outbounds: dict[str, dict[str, Any]] = {}
    group_proxy_outputs: dict[str, list[dict[str, Any]]] = {}

    proc_order = _topological_sort(sub_cfg.groups)
    for idx in proc_order:
        group = sub_cfg.groups[idx]
        group_tag = group.group_tag if isinstance(group, AutoRegionGroupConfig) else group.tag

        if group.imports:
            proxies: list[dict[str, Any]] = []
            for name in group.imports:
                if name in proxy_map:
                    proxies.extend(proxy_map[name])
                elif name in group_proxy_outputs:
                    proxies.extend(group_proxy_outputs[name])
        else:
            proxies = [p for ps in proxy_map.values() for p in ps]

        proxies = _apply_filter_rules(proxies, group.include, group.exclude)
        group_proxy_outputs[group_tag] = proxies

        if isinstance(group, AutoRegionGroupConfig):
            buckets: dict[str, list[dict[str, Any]]] = defaultdict(list)
            unmatched: list[dict[str, Any]] = []
            for proxy in proxies:
                region = _detect_region(proxy.get("tag", ""), group.region_map)
                if region:
                    buckets[region].append(proxy)
                else:
                    unmatched.append(proxy)

            if group.regions == "auto":
                ordered_regions = sorted(buckets, key=lambda r: -len(buckets[r]))
                others_proxies: list[dict[str, Any]] = unmatched
            else:
                specified_set = set(group.regions)
                ordered_regions = [r for r in group.regions if r in buckets]
                others_proxies = unmatched + [
                    p for r, ps in buckets.items() if r not in specified_set for p in ps
                ]

            # Collect sub-group entries first (needed for parent outbounds list)
            sub_group_entries: list[tuple[str, list[dict[str, Any]]]] = []
            for region in ordered_regions:
                label = _region_label(region, group.use_emoji)
                sub_tag = group.sub_group_tag.replace("{region}", label)
                sub_group_entries.append((sub_tag, buckets[region]))
            if others_proxies:
                others_sub_tag = group.sub_group_tag.replace("{region}", group.others_tag)
                sub_group_entries.append((others_sub_tag, others_proxies))

            # Insert parent group before sub-groups
            generated_groups.append({
                "tag": group.group_tag,
                "type": group.group_type,
                "outbounds": [tag for tag, _ in sub_group_entries],
            })

            for sub_tag, sub_proxies in sub_group_entries:
                _emit_group(sub_tag, group.sub_group_type, sub_proxies, generated_groups, all_proxy_outbounds)

        else:
            _emit_group(group.tag, group.type, proxies, generated_groups, all_proxy_outbounds)

    # Prepend generated groups + individual proxy entries to template outbounds
    existing_outbounds: list[Any] = template.get("outbounds", [])
    template["outbounds"] = generated_groups + list(all_proxy_outbounds.values()) + existing_outbounds

    return template


@router.post("/generate")
async def generate_from_body(config: ConfigData) -> JSONResponse:
    """Case 1: generate directly from a ConfigData body (no DB needed)."""
    result = await _run_generate(config)
    return JSONResponse(content=result)


@router.get("/generate")
async def generate_from_url(url: str) -> JSONResponse:
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
) -> JSONResponse:
    """Load config from DB by ID and generate (requires DATABASE_URL)."""
    row = await db.get(Config, config_id)
    if not row:
        raise HTTPException(status_code=404, detail="Config not found")
    config = ConfigData.model_validate(row.data)
    result = await _run_generate(config)
    return JSONResponse(content=result)
