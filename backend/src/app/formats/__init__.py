"""Multi-format proxy subscription / config support.

Exposes parser & emitter registries so new formats (quantumult, v2ray, ...) can
be added by implementing SubscriptionParser / TargetEmitter and appending to
PARSERS / EMITTERS.
"""
from __future__ import annotations

from src.app.formats.base import (
    ParseError,
    SubscriptionParser,
    TargetEmitter,
    UnsupportedFormatError,
)
from src.app.formats.clash import ClashEmitter, ClashParser
from src.app.formats.detect import detect_source_format
from src.app.formats.model import (
    BaseProxy,
    Proxy,
    ProxyGroup,
    TlsConfig,
    TransportConfig,
    UnknownProxy,
    UrlTestOpts,
)
from src.app.formats.sing_box import SingBoxEmitter, SingBoxParser


PARSERS: list[type[SubscriptionParser]] = [SingBoxParser, ClashParser]

EMITTERS: dict[str, type[TargetEmitter]] = {
    SingBoxEmitter.format_name: SingBoxEmitter,
    ClashEmitter.format_name: ClashEmitter,
}

SUPPORTED_TARGETS: tuple[str, ...] = tuple(EMITTERS.keys())


__all__ = [
    "BaseProxy",
    "ClashEmitter",
    "ClashParser",
    "EMITTERS",
    "ParseError",
    "PARSERS",
    "Proxy",
    "ProxyGroup",
    "SUPPORTED_TARGETS",
    "SingBoxEmitter",
    "SingBoxParser",
    "SubscriptionParser",
    "TargetEmitter",
    "TlsConfig",
    "TransportConfig",
    "UnknownProxy",
    "UnsupportedFormatError",
    "UrlTestOpts",
    "detect_source_format",
]
