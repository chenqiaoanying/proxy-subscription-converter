"""Source-format detection for subscription responses."""
from __future__ import annotations

import json

import yaml

from src.app.formats.base import SubscriptionParser, UnsupportedFormatError
from src.app.formats.clash import ClashParser
from src.app.formats.sing_box import SingBoxParser


def detect_source_format(
    url: str, content_type: str, text: str
) -> type[SubscriptionParser]:
    """Pick the best parser for a subscription response."""
    ct = content_type.lower()
    url_no_query = url.lower().split("?")[0]

    if url_no_query.endswith((".yaml", ".yml")) or "yaml" in ct:
        return ClashParser
    if "json" in ct:
        return SingBoxParser

    # Content sniff — try JSON first (stricter)
    stripped = text.lstrip()
    if stripped.startswith("{") or stripped.startswith("["):
        try:
            data = json.loads(text)
        except ValueError:
            data = None
        if isinstance(data, dict) and "outbounds" in data:
            return SingBoxParser

    try:
        data = yaml.safe_load(text)
    except yaml.YAMLError:
        data = None
    if isinstance(data, dict) and ("proxies" in data or "proxy-groups" in data):
        return ClashParser

    raise UnsupportedFormatError(
        f"could not determine subscription format for {url}"
    )
