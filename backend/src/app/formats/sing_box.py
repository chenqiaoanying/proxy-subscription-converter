"""Sing-box JSON subscription parser + config emitter."""
from __future__ import annotations

import json
from typing import Any, ClassVar

from src.app.formats.base import ParseError
from src.app.formats.common import (
    sing_box_tls_from,
    sing_box_tls_to,
    sing_box_transport_from,
    sing_box_transport_to,
)
from src.app.formats.model import (
    BaseProxy,
    Hysteria2Proxy,
    HttpProxy,
    KNOWN_PROXY_TYPES,
    Proxy,
    ProxyGroup,
    ShadowsocksProxy,
    SocksProxy,
    TrojanProxy,
    TuicProxy,
    UnknownProxy,
    UrlTestOpts,
    VlessProxy,
    VmessProxy,
    WireguardProxy,
)


FORMAT_NAME = "sing-box"
RESPONSE_MEDIA_TYPE = "application/json"


_URLTEST_FIELDS_SB = (
    "url",
    "interval",
    "tolerance",
    "idle_timeout",
    "interrupt_exist_connections",
)


def _proxy_from_entry(entry: dict[str, Any]) -> Proxy | None:
    """Return a unified Proxy for a sing-box outbound entry, or None for non-proxy."""
    kind = entry.get("type")
    tag = entry.get("tag")
    server = entry.get("server")
    port = entry.get("server_port")
    if not (isinstance(kind, str) and isinstance(tag, str) and server and isinstance(port, int)):
        return None
    if kind in {"selector", "urltest", "direct", "block", "dns"}:
        # Not a real proxy — skip; groups come from template / generation logic.
        return None

    tls = sing_box_tls_from(entry)
    transport = sing_box_transport_from(entry)
    common: dict[str, Any] = {
        "name": tag,
        "server": server,
        "port": port,
        "tls": tls,
        "transport": transport,
    }

    try:
        if kind == "shadowsocks":
            return ShadowsocksProxy(
                **common,
                method=entry.get("method", ""),
                password=entry.get("password", ""),
                plugin=entry.get("plugin"),
                plugin_opts=entry.get("plugin_opts"),
            )
        if kind == "vmess":
            return VmessProxy(
                **common,
                uuid=entry.get("uuid", ""),
                alter_id=entry.get("alter_id", 0),
                security=entry.get("security", "auto"),
            )
        if kind == "vless":
            return VlessProxy(
                **common,
                uuid=entry.get("uuid", ""),
                flow=entry.get("flow"),
            )
        if kind == "trojan":
            return TrojanProxy(**common, password=entry.get("password", ""))
        if kind == "hysteria2":
            obfs = entry.get("obfs")
            obfs_name: str | None = None
            obfs_password: str | None = None
            if isinstance(obfs, dict):
                obfs_name = obfs.get("type")
                obfs_password = obfs.get("password")
            return Hysteria2Proxy(
                **common,
                password=entry.get("password", ""),
                obfs=obfs_name,
                obfs_password=obfs_password,
                up_mbps=entry.get("up_mbps"),
                down_mbps=entry.get("down_mbps"),
            )
        if kind == "tuic":
            return TuicProxy(
                **common,
                uuid=entry.get("uuid", ""),
                password=entry.get("password", ""),
                congestion_control=entry.get("congestion_control"),
                udp_relay_mode=entry.get("udp_relay_mode"),
            )
        if kind == "wireguard":
            return WireguardProxy(
                **common,
                private_key=entry.get("private_key", ""),
                peer_public_key=entry.get("peer_public_key"),
                pre_shared_key=entry.get("pre_shared_key"),
                local_address=entry.get("local_address"),
                mtu=entry.get("mtu"),
                reserved=entry.get("reserved"),
            )
        if kind == "http":
            return HttpProxy(
                **common,
                username=entry.get("username"),
                password=entry.get("password"),
            )
        if kind == "socks":
            return SocksProxy(
                **common,
                username=entry.get("username"),
                password=entry.get("password"),
                version=str(entry.get("version", "5")),
            )
    except Exception:
        pass

    return UnknownProxy(
        name=tag,
        server=server,
        port=port,
        type=kind,
        raw=dict(entry),
        source_format="sing-box",
    )


class SingBoxParser:
    format_name: ClassVar[str] = FORMAT_NAME

    @classmethod
    def can_parse(cls, text: str, content_type: str, url: str) -> bool:
        ct = content_type.lower()
        if "json" in ct:
            return True
        stripped = text.lstrip()
        return stripped.startswith("{") or stripped.startswith("[")

    @classmethod
    def parse(cls, text: str) -> list[Proxy]:
        try:
            data = json.loads(text)
        except json.JSONDecodeError as e:
            raise ParseError(f"invalid sing-box JSON: {e}") from e
        if not isinstance(data, dict):
            raise ParseError("sing-box subscription must be a JSON object")
        outbounds = data.get("outbounds", [])
        if not isinstance(outbounds, list):
            raise ParseError("sing-box outbounds must be a list")
        proxies: list[Proxy] = []
        for entry in outbounds:
            if not isinstance(entry, dict):
                continue
            p = _proxy_from_entry(entry)
            if p is not None:
                proxies.append(p)
        return proxies


def _proxy_to_entry(p: Proxy) -> dict[str, Any] | None:
    """Convert unified Proxy -> sing-box outbound dict. None means drop."""
    if isinstance(p, UnknownProxy):
        if p.source_format == "sing-box" and p.raw:
            return dict(p.raw)
        return None

    base: dict[str, Any] = {
        "type": p.type,
        "tag": p.name,
        "server": p.server,
        "server_port": p.port,
    }
    base.update(sing_box_tls_to(p.tls))
    base.update(sing_box_transport_to(p.transport))

    if isinstance(p, ShadowsocksProxy):
        base["method"] = p.method
        base["password"] = p.password
        if p.plugin:
            base["plugin"] = p.plugin
        if p.plugin_opts:
            base["plugin_opts"] = dict(p.plugin_opts)
    elif isinstance(p, VmessProxy):
        base["uuid"] = p.uuid
        base["alter_id"] = p.alter_id
        base["security"] = p.security
    elif isinstance(p, VlessProxy):
        base["uuid"] = p.uuid
        if p.flow:
            base["flow"] = p.flow
    elif isinstance(p, TrojanProxy):
        base["password"] = p.password
    elif isinstance(p, Hysteria2Proxy):
        base["password"] = p.password
        if p.obfs:
            obfs_obj: dict[str, Any] = {"type": p.obfs}
            if p.obfs_password:
                obfs_obj["password"] = p.obfs_password
            base["obfs"] = obfs_obj
        if p.up_mbps is not None:
            base["up_mbps"] = p.up_mbps
        if p.down_mbps is not None:
            base["down_mbps"] = p.down_mbps
    elif isinstance(p, TuicProxy):
        base["uuid"] = p.uuid
        base["password"] = p.password
        if p.congestion_control:
            base["congestion_control"] = p.congestion_control
        if p.udp_relay_mode:
            base["udp_relay_mode"] = p.udp_relay_mode
    elif isinstance(p, WireguardProxy):
        base["private_key"] = p.private_key
        if p.peer_public_key:
            base["peer_public_key"] = p.peer_public_key
        if p.pre_shared_key:
            base["pre_shared_key"] = p.pre_shared_key
        if p.local_address:
            base["local_address"] = list(p.local_address)
        if p.mtu is not None:
            base["mtu"] = p.mtu
        if p.reserved:
            base["reserved"] = list(p.reserved)
    elif isinstance(p, HttpProxy):
        if p.username:
            base["username"] = p.username
        if p.password:
            base["password"] = p.password
    elif isinstance(p, SocksProxy):
        if p.username:
            base["username"] = p.username
        if p.password:
            base["password"] = p.password
        base["version"] = p.version
    elif p.type not in KNOWN_PROXY_TYPES:
        return None

    if isinstance(p, BaseProxy) and p.extra_sing_box:
        for k, v in p.extra_sing_box.items():
            base.setdefault(k, v)

    return base


def _group_to_entry(g: ProxyGroup) -> dict[str, Any]:
    entry: dict[str, Any] = {
        "type": g.type,
        "tag": g.name,
        "outbounds": list(g.proxies),
    }
    if g.type == "urltest" and g.urltest is not None:
        for field in _URLTEST_FIELDS_SB:
            val = getattr(g.urltest, field)
            if val is not None:
                entry[field] = val
    return entry


class SingBoxEmitter:
    format_name: ClassVar[str] = FORMAT_NAME
    response_media_type: ClassVar[str] = RESPONSE_MEDIA_TYPE

    @classmethod
    def emit(
        cls,
        template: dict[str, Any],
        proxies: list[Proxy],
        groups: list[ProxyGroup],
    ) -> tuple[bytes, int]:
        existing = template.get("outbounds", [])
        if not isinstance(existing, list):
            existing = []
        group_entries = [_group_to_entry(g) for g in groups]
        proxy_entries: list[dict[str, Any]] = []
        dropped = 0
        for p in proxies:
            entry = _proxy_to_entry(p)
            if entry is None:
                dropped += 1
                continue
            proxy_entries.append(entry)
        template["outbounds"] = group_entries + proxy_entries + list(existing)
        body = json.dumps(template, ensure_ascii=False).encode("utf-8")
        return body, dropped
