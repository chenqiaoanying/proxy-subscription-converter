import asyncio
import json
import re
import uuid
from collections import defaultdict
from copy import deepcopy
from dataclasses import dataclass, field
from typing import Any

import httpx
import yaml
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.database import get_db
from src.app.formats import (
    EMITTERS,
    SUPPORTED_TARGETS,
    ParseError,
    Proxy,
    ProxyGroup,
    UnsupportedFormatError,
    UrlTestOpts,
    detect_source_format,
)
from src.app.models import Config
from src.app.schemas import (
    AutoRegionGroupConfig,
    ConfigData,
    GroupConfig,
    InlineTemplate,
    MatchRule,
    ObjectTemplate,
    ProxyPreview,
    SubscriptionConfig,
    SubscriptionPreviewRequest,
    SubscriptionPreviewResponse,
    SubscriptionUserInfo,
    TargetFormat,
    TemplateSource,
    UrlTemplate,
    UrlTestOptions,
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


def _matches_rule(proxy_name: str, proxy_type: str, rule: MatchRule) -> bool:
    if rule.proxy_type and proxy_type not in rule.proxy_type:
        return False
    if rule.pattern:
        pattern = rule.pattern
        flags = 0 if rule.match_case else re.IGNORECASE
        if not rule.regex:
            pattern = re.escape(pattern)
            if rule.match_whole_word:
                pattern = rf"\b{pattern}\b"
        if not re.search(pattern, proxy_name, flags):
            return False
    return True


def _apply_filter_rules(
    proxies: list[Proxy],
    include: MatchRule | None,
    exclude: MatchRule | None,
) -> list[Proxy]:
    result = proxies
    if include:
        result = [p for p in result if _matches_rule(p.name, p.type, include)]
    if exclude:
        result = [p for p in result if not _matches_rule(p.name, p.type, exclude)]
    return result


def _detect_region(proxy_name: str, region_map: dict[str, str]) -> str | None:
    name_lower = proxy_name.lower()
    for keyword, region in region_map.items():
        if keyword.lower() in name_lower:
            return region
    for region_code, keywords in REGION_KEYWORD_MAP.items():
        for keyword in keywords:
            if keyword.lower() in name_lower:
                return region_code
    return None


def _region_label(region: str, use_emoji: bool) -> str:
    if use_emoji and region in REGION_EMOJI:
        return f"{REGION_EMOJI[region]} {region}"
    return region


def _urltest_opts(opts: UrlTestOptions | None) -> UrlTestOpts | None:
    if opts is None:
        return None
    return UrlTestOpts(
        url=opts.url,
        interval=opts.interval,
        tolerance=opts.tolerance,
        idle_timeout=opts.idle_timeout,
        interrupt_exist_connections=opts.interrupt_exist_connections,
    )


async def _fetch_subscription(
    name: str, sub: SubscriptionConfig
) -> tuple[str, list[Proxy], str | None]:
    headers: dict[str, str] = {}
    if sub.user_agent:
        headers["User-Agent"] = sub.user_agent
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            sub.url, headers=headers, follow_redirects=True, timeout=30.0
        )
        resp.raise_for_status()
    content_type = resp.headers.get("content-type", "")
    parser_cls = detect_source_format(sub.url, content_type, resp.text)
    proxies = parser_cls.parse(resp.text)
    proxies = [p for p in proxies if p.server]
    userinfo = resp.headers.get("subscription-userinfo")
    return name, proxies, userinfo


def _parse_subscription_userinfo(header: str) -> dict[str, int]:
    result: dict[str, int] = {}
    for part in header.split(";"):
        key, _, val = part.strip().partition("=")
        if key and val:
            try:
                result[key.strip()] = int(val.strip())
            except ValueError:
                pass
    return result


def _aggregate_subscription_userinfo(infos: list[str]) -> str | None:
    total_upload = 0
    total_download = 0
    total_total = 0
    min_expire: int | None = None
    has_any = False
    for info in infos:
        parsed = _parse_subscription_userinfo(info)
        if not parsed:
            continue
        has_any = True
        total_upload += parsed.get("upload", 0)
        total_download += parsed.get("download", 0)
        total_total += parsed.get("total", 0)
        if "expire" in parsed:
            expire = parsed["expire"]
            if min_expire is None or expire < min_expire:
                min_expire = expire
    if not has_any:
        return None
    parts = [f"upload={total_upload}", f"download={total_download}", f"total={total_total}"]
    if min_expire is not None:
        parts.append(f"expire={min_expire}")
    return "; ".join(parts)


@router.post("/subscriptions/preview", response_model=SubscriptionPreviewResponse)
async def preview_subscription(req: SubscriptionPreviewRequest) -> SubscriptionPreviewResponse:
    """Fetch proxies from a single subscription URL (no DB, no template)."""
    try:
        _, proxies, userinfo_str = await _fetch_subscription(
            "_", SubscriptionConfig(url=req.url, enabled=True, user_agent=req.user_agent)
        )
    except (UnsupportedFormatError, ParseError) as e:
        raise HTTPException(status_code=400, detail=f"Unrecognised subscription format: {e}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch subscription: {e}")
    userinfo: SubscriptionUserInfo | None = None
    if userinfo_str:
        parsed = _parse_subscription_userinfo(userinfo_str)
        if parsed:
            userinfo = SubscriptionUserInfo(
                upload=parsed.get("upload", 0),
                download=parsed.get("download", 0),
                total=parsed.get("total", 0),
                expire=parsed.get("expire"),
            )
    return SubscriptionPreviewResponse(
        proxies=[ProxyPreview(tag=p.name, type=p.type) for p in proxies],
        userinfo=userinfo,
    )


def _topological_sort(groups: list[GroupConfig]) -> list[int]:
    """Return group indices in dependency order (dependencies before dependents)."""
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


@dataclass
class GenerateResult:
    body: bytes
    media_type: str
    headers: dict[str, str] = field(default_factory=dict)


def _resolve_target(config: ConfigData, requested: str | None) -> str:
    if requested:
        if requested not in EMITTERS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported target format '{requested}'. Valid: {list(SUPPORTED_TARGETS)}",
            )
        return requested
    keys = list(config.config_template.keys())
    if "sing-box" in keys:
        return "sing-box"
    if len(keys) == 1:
        return keys[0]
    return "sing-box"


def _is_yaml_response(url: str, content_type: str) -> bool:
    url_lower = url.lower().split("?")[0]
    if url_lower.endswith((".yaml", ".yml")):
        return True
    return "yaml" in content_type


async def _load_template(
    template_src: TemplateSource | None,
) -> dict[str, Any]:
    if template_src is None:
        return {}
    if isinstance(template_src, ObjectTemplate):
        return deepcopy(template_src.value)
    if isinstance(template_src, InlineTemplate):
        text = template_src.value.strip()
        if not text:
            return {}
        try:
            data = yaml.safe_load(text)
        except yaml.YAMLError as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid inline template: {e}",
            ) from e
        return data if isinstance(data, dict) else {}
    if isinstance(template_src, UrlTemplate):
        url = template_src.value
        if not url:
            return {}
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, timeout=30.0)
            resp.raise_for_status()
        if _is_yaml_response(url, resp.headers.get("content-type", "")):
            data = yaml.safe_load(resp.text)
        else:
            try:
                data = json.loads(resp.text)
            except json.JSONDecodeError:
                data = yaml.safe_load(resp.text)
        return data if isinstance(data, dict) else {}
    return {}


def _build_groups(
    group_configs: list[GroupConfig],
    proxy_map: dict[str, list[Proxy]],
) -> tuple[list[ProxyGroup], list[Proxy]]:
    """Run topological sort + filter + auto-region expansion.

    Returns (generated groups, unique list of referenced proxies preserving order).
    """
    generated: list[ProxyGroup] = []
    group_outputs: dict[str, list[Proxy]] = {}
    all_proxies: dict[str, Proxy] = {}

    proc_order = _topological_sort(group_configs)
    for idx in proc_order:
        group = group_configs[idx]
        group_tag = group.group_tag if isinstance(group, AutoRegionGroupConfig) else group.tag

        if group.imports:
            pool: list[Proxy] = []
            for name in group.imports:
                if name in proxy_map:
                    pool.extend(proxy_map[name])
                elif name in group_outputs:
                    pool.extend(group_outputs[name])
        else:
            pool = [p for ps in proxy_map.values() for p in ps]

        pool = _apply_filter_rules(pool, group.include, group.exclude)
        group_outputs[group_tag] = pool

        if isinstance(group, AutoRegionGroupConfig):
            buckets: dict[str, list[Proxy]] = defaultdict(list)
            unmatched: list[Proxy] = []
            for proxy in pool:
                region = _detect_region(proxy.name, group.region_map)
                if region:
                    buckets[region].append(proxy)
                else:
                    unmatched.append(proxy)

            if group.regions == "auto":
                ordered_regions = sorted(buckets, key=lambda r: -len(buckets[r]))
                others_proxies: list[Proxy] = unmatched
            else:
                specified_set = set(group.regions)
                ordered_regions = [r for r in group.regions if r in buckets]
                others_proxies = unmatched + [
                    p for r, ps in buckets.items() if r not in specified_set for p in ps
                ]

            sub_group_entries: list[tuple[str, list[Proxy]]] = []
            for region in ordered_regions:
                label = _region_label(region, group.use_emoji)
                sub_tag = group.sub_group_tag.replace("{region}", label)
                sub_group_entries.append((sub_tag, buckets[region]))
            if others_proxies:
                others_sub_tag = group.sub_group_tag.replace("{region}", group.others_tag)
                sub_group_entries.append((others_sub_tag, others_proxies))

            parent = ProxyGroup(
                name=group.group_tag,
                type=group.group_type,
                proxies=[tag for tag, _ in sub_group_entries],
                urltest=_urltest_opts(group.group_urltest_options)
                if group.group_type == "urltest" else None,
            )
            generated.append(parent)

            for sub_tag, sub_proxies in sub_group_entries:
                generated.append(
                    ProxyGroup(
                        name=sub_tag,
                        type=group.sub_group_type,
                        proxies=[p.name for p in sub_proxies],
                        urltest=_urltest_opts(group.sub_group_urltest_options)
                        if group.sub_group_type == "urltest" else None,
                    )
                )
                for p in sub_proxies:
                    all_proxies.setdefault(p.name, p)
        else:
            generated.append(
                ProxyGroup(
                    name=group.tag,
                    type=group.type,
                    proxies=[p.name for p in pool],
                    urltest=_urltest_opts(group.urltest_options)
                    if group.type == "urltest" else None,
                )
            )
            for p in pool:
                all_proxies.setdefault(p.name, p)

    return generated, list(all_proxies.values())


async def _run_generate(config: ConfigData, target: str | None) -> GenerateResult:
    target_format = _resolve_target(config, target)
    emitter_cls = EMITTERS[target_format]

    sub_cfg = config.subscriber
    enabled_subs = [(name, s) for name, s in sub_cfg.subscriptions.items() if s.enabled]
    fetch_results = await asyncio.gather(
        *[_fetch_subscription(name, s) for name, s in enabled_subs],
        return_exceptions=True,
    )
    proxy_map: dict[str, list[Proxy]] = {}
    userinfo_headers: list[str] = []
    for item in fetch_results:
        if isinstance(item, BaseException):
            continue
        name, proxies, userinfo = item
        proxy_map[name] = proxies
        if userinfo:
            userinfo_headers.append(userinfo)

    template = await _load_template(config.config_template.get(target_format))
    groups, proxies_out = _build_groups(sub_cfg.groups, proxy_map)
    body, dropped = emitter_cls.emit(template, proxies_out, groups)

    response_headers: dict[str, str] = {}
    aggregated_userinfo = _aggregate_subscription_userinfo(userinfo_headers)
    if aggregated_userinfo:
        response_headers["subscription-userinfo"] = aggregated_userinfo
    if dropped:
        response_headers["X-Dropped-Proxies"] = str(dropped)

    return GenerateResult(body=body, media_type=emitter_cls.response_media_type, headers=response_headers)


@router.post("/generate")
async def generate_from_body(
    config: ConfigData,
    format: TargetFormat | None = None,
) -> Response:
    """Case 1: generate directly from a ConfigData body (no DB needed)."""
    result = await _run_generate(config, format)
    return Response(content=result.body, media_type=result.media_type, headers=result.headers)


def _parse_config_body(text: str, as_yaml: bool) -> Any:
    if as_yaml:
        return yaml.safe_load(text)
    return json.loads(text)


@router.get("/generate")
async def generate_from_url(
    url: str,
    format: TargetFormat | None = None,
) -> Response:
    """Case 2: fetch ConfigData from a URL and generate (no DB needed)."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, follow_redirects=True, timeout=30.0)
            resp.raise_for_status()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch config URL: {e}")
    try:
        as_yaml = _is_yaml_response(url, resp.headers.get("content-type", ""))
        raw = _parse_config_body(resp.text, as_yaml)
        config = ConfigData.model_validate(raw)
    except Exception:
        raise HTTPException(
            status_code=422, detail="URL did not return a valid config document"
        )
    result = await _run_generate(config, format)
    return Response(content=result.body, media_type=result.media_type, headers=result.headers)


@router.get("/configs/{config_id}/generate")
async def generate_config(
    config_id: uuid.UUID,
    format: TargetFormat | None = None,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Load config from DB by ID and generate (requires DATABASE_URL)."""
    row = await db.get(Config, config_id)
    if not row:
        raise HTTPException(status_code=404, detail="Config not found")
    config = ConfigData.model_validate(row.data)
    result = await _run_generate(config, format)
    return Response(content=result.body, media_type=result.media_type, headers=result.headers)
