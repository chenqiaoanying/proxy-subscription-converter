"""Parser and emitter protocols for subscription / config formats."""
from __future__ import annotations

from typing import Any, ClassVar, Protocol, runtime_checkable

from src.app.formats.model import Proxy, ProxyGroup


class ParseError(Exception):
    """Raised when a subscription body cannot be parsed."""


class UnsupportedFormatError(Exception):
    """Raised when neither parser recognises a subscription body."""


@runtime_checkable
class SubscriptionParser(Protocol):
    format_name: ClassVar[str]

    @classmethod
    def can_parse(cls, text: str, content_type: str, url: str) -> bool: ...

    @classmethod
    def parse(cls, text: str) -> list[Proxy]: ...


@runtime_checkable
class TargetEmitter(Protocol):
    format_name: ClassVar[str]
    response_media_type: ClassVar[str]

    @classmethod
    def emit(
        cls,
        template: dict[str, Any],
        proxies: list[Proxy],
        groups: list[ProxyGroup],
    ) -> tuple[bytes, int]:
        """Return (serialised body, count of proxies dropped due to incompat)."""
        ...
