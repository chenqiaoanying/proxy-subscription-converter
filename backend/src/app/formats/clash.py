"""Clash (Mihomo) YAML subscription parser + config emitter."""
from __future__ import annotations

from typing import Any, ClassVar

import yaml

from src.app.formats.base import ParseError
from src.app.formats.common import (
    clash_tls_from,
    clash_tls_to,
    clash_transport_from,
    clash_transport_to,
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
    VlessProxy,
    VmessProxy,
    WireguardProxy,
)


FORMAT_NAME = "clash"
RESPONSE_MEDIA_TYPE = "application/yaml"

# Clash type name <-> unified type name
_CLASH_TO_UNIFIED: dict[str, str] = {
    "ss": "shadowsocks",
    "vmess": "vmess",
    "vless": "vless",
    "trojan": "trojan",
    "hysteria2": "hysteria2",
    "hy2": "hysteria2",
    "tuic": "tuic",
    "wireguard": "wireguard",
    "http": "http",
    "socks5": "socks",
    "socks": "socks",
}

_UNIFIED_TO_CLASH: dict[str, str] = {
    "shadowsocks": "ss",
    "vmess": "vmess",
    "vless": "vless",
    "trojan": "trojan",
    "hysteria2": "hysteria2",
    "tuic": "tuic",
    "wireguard": "wireguard",
    "http": "http",
    "socks": "socks5",
}

_CLASH_GROUP_TYPE_FROM: dict[str, str] = {
    "select": "selector",
    "url-test": "urltest",
}

_CLASH_GROUP_TYPE_TO: dict[str, str] = {
    "selector": "select",
    "urltest": "url-test",
}


def _proxy_from_entry(entry: dict[str, Any]) -> Proxy | None:
    raw_type = entry.get("type")
    name = entry.get("name")
    server = entry.get("server")
    port = entry.get("port")
    if not (isinstance(raw_type, str) and isinstance(name, str) and server and isinstance(port, int)):
        return None

    unified_type = _CLASH_TO_UNIFIED.get(raw_type)
    tls = clash_tls_from(entry)
    transport = clash_transport_from(entry)
    common: dict[str, Any] = {
        "name": name,
        "server": server,
        "port": port,
        "tls": tls,
        "transport": transport,
    }

    try:
        if unified_type == "shadowsocks":
            return ShadowsocksProxy(
                **common,
                method=entry.get("cipher", ""),
                password=entry.get("password", ""),
                plugin=entry.get("plugin"),
                plugin_opts=entry.get("plugin-opts"),
            )
        if unified_type == "vmess":
            return VmessProxy(
                **common,
                uuid=entry.get("uuid", ""),
                alter_id=entry.get("alterId", entry.get("alter-id", 0)),
                security=entry.get("cipher", "auto"),
            )
        if unified_type == "vless":
            return VlessProxy(
                **common,
                uuid=entry.get("uuid", ""),
                flow=entry.get("flow"),
            )
        if unified_type == "trojan":
            return TrojanProxy(**common, password=entry.get("password", ""))
        if unified_type == "hysteria2":
            return Hysteria2Proxy(
                **common,
                password=entry.get("password", ""),
                obfs=entry.get("obfs"),
                obfs_password=entry.get("obfs-password"),
                up_mbps=_coerce_int(entry.get("up")),
                down_mbps=_coerce_int(entry.get("down")),
            )
        if unified_type == "tuic":
            return TuicProxy(
                **common,
                uuid=entry.get("uuid", ""),
                password=entry.get("password", ""),
                congestion_control=entry.get("congestion-controller"),
                udp_relay_mode=entry.get("udp-relay-mode"),
            )
        if unified_type == "wireguard":
            return WireguardProxy(
                **common,
                private_key=entry.get("private-key", ""),
                peer_public_key=entry.get("public-key"),
                pre_shared_key=entry.get("preshared-key"),
                local_address=_wg_local_addresses(entry),
                mtu=entry.get("mtu"),
                reserved=entry.get("reserved"),
            )
        if unified_type == "http":
            return HttpProxy(
                **common,
                username=entry.get("username"),
                password=entry.get("password"),
            )
        if unified_type == "socks":
            return SocksProxy(
                **common,
                username=entry.get("username"),
                password=entry.get("password"),
                version="5",
            )
    except Exception:
        pass

    return UnknownProxy(
        name=name,
        server=server,
        port=port,
        type=unified_type or raw_type,
        raw=dict(entry),
        source_format="clash",
    )


def _coerce_int(v: Any) -> int | None:
    if v is None:
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def _wg_local_addresses(entry: dict[str, Any]) -> list[str] | None:
    addrs: list[str] = []
    if entry.get("ip"):
        addrs.append(str(entry["ip"]))
    if entry.get("ipv6"):
        addrs.append(str(entry["ipv6"]))
    return addrs or None


class ClashParser:
    format_name: ClassVar[str] = FORMAT_NAME

    @classmethod
    def can_parse(cls, text: str, content_type: str, url: str) -> bool:
        ct = content_type.lower()
        if "yaml" in ct:
            return True
        lower = url.lower().split("?")[0]
        if lower.endswith((".yaml", ".yml")):
            return True
        return "proxies:" in text or "proxy-groups:" in text

    @classmethod
    def parse(cls, text: str) -> list[Proxy]:
        try:
            data = yaml.safe_load(text)
        except yaml.YAMLError as e:
            raise ParseError(f"invalid clash YAML: {e}") from e
        if not isinstance(data, dict):
            raise ParseError("clash subscription must be a YAML mapping")
        raw_proxies = data.get("proxies", [])
        if not isinstance(raw_proxies, list):
            raise ParseError("clash `proxies` must be a list")
        result: list[Proxy] = []
        for entry in raw_proxies:
            if not isinstance(entry, dict):
                continue
            p = _proxy_from_entry(entry)
            if p is not None:
                result.append(p)
        return result


def _proxy_to_entry(p: Proxy) -> dict[str, Any] | None:
    if isinstance(p, UnknownProxy):
        if p.source_format == "clash" and p.raw:
            return dict(p.raw)
        return None

    clash_type = _UNIFIED_TO_CLASH.get(p.type)
    if clash_type is None:
        return None

    entry: dict[str, Any] = {
        "name": p.name,
        "type": clash_type,
        "server": p.server,
        "port": p.port,
    }
    entry.update(clash_tls_to(p.tls))
    entry.update(clash_transport_to(p.transport))

    if isinstance(p, ShadowsocksProxy):
        entry["cipher"] = p.method
        entry["password"] = p.password
        if p.plugin:
            entry["plugin"] = p.plugin
        if p.plugin_opts:
            entry["plugin-opts"] = dict(p.plugin_opts)
    elif isinstance(p, VmessProxy):
        entry["uuid"] = p.uuid
        entry["alterId"] = p.alter_id
        entry["cipher"] = p.security
    elif isinstance(p, VlessProxy):
        entry["uuid"] = p.uuid
        if p.flow:
            entry["flow"] = p.flow
    elif isinstance(p, TrojanProxy):
        entry["password"] = p.password
    elif isinstance(p, Hysteria2Proxy):
        entry["password"] = p.password
        if p.obfs:
            entry["obfs"] = p.obfs
        if p.obfs_password:
            entry["obfs-password"] = p.obfs_password
        if p.up_mbps is not None:
            entry["up"] = p.up_mbps
        if p.down_mbps is not None:
            entry["down"] = p.down_mbps
    elif isinstance(p, TuicProxy):
        entry["uuid"] = p.uuid
        entry["password"] = p.password
        if p.congestion_control:
            entry["congestion-controller"] = p.congestion_control
        if p.udp_relay_mode:
            entry["udp-relay-mode"] = p.udp_relay_mode
    elif isinstance(p, WireguardProxy):
        entry["private-key"] = p.private_key
        if p.peer_public_key:
            entry["public-key"] = p.peer_public_key
        if p.pre_shared_key:
            entry["preshared-key"] = p.pre_shared_key
        if p.local_address:
            for addr in p.local_address:
                if ":" in addr:
                    entry["ipv6"] = addr
                else:
                    entry["ip"] = addr
        if p.mtu is not None:
            entry["mtu"] = p.mtu
        if p.reserved:
            entry["reserved"] = list(p.reserved)
    elif isinstance(p, HttpProxy):
        if p.username:
            entry["username"] = p.username
        if p.password:
            entry["password"] = p.password
    elif isinstance(p, SocksProxy):
        if p.username:
            entry["username"] = p.username
        if p.password:
            entry["password"] = p.password
    elif p.type not in KNOWN_PROXY_TYPES:
        return None

    if isinstance(p, BaseProxy) and p.extra_clash:
        for k, v in p.extra_clash.items():
            entry.setdefault(k, v)

    return entry


def _group_to_entry(g: ProxyGroup) -> dict[str, Any]:
    entry: dict[str, Any] = {
        "name": g.name,
        "type": _CLASH_GROUP_TYPE_TO.get(g.type, g.type),
        "proxies": list(g.proxies),
    }
    if g.type == "urltest" and g.urltest is not None:
        if g.urltest.url:
            entry["url"] = g.urltest.url
        if g.urltest.interval is not None:
            entry["interval"] = _interval_to_seconds(g.urltest.interval)
        if g.urltest.tolerance is not None:
            entry["tolerance"] = g.urltest.tolerance
    return entry


def _interval_to_seconds(val: str | int) -> int | str:
    """Convert sing-box interval (e.g. '3m') to Clash seconds. Keep string if unclear."""
    if isinstance(val, int):
        return val
    s = val.strip()
    if s.endswith("s"):
        try:
            return int(s[:-1])
        except ValueError:
            return val
    if s.endswith("m"):
        try:
            return int(s[:-1]) * 60
        except ValueError:
            return val
    if s.endswith("h"):
        try:
            return int(s[:-1]) * 3600
        except ValueError:
            return val
    try:
        return int(s)
    except ValueError:
        return val


class ClashEmitter:
    format_name: ClassVar[str] = FORMAT_NAME
    response_media_type: ClassVar[str] = RESPONSE_MEDIA_TYPE

    @classmethod
    def emit(
        cls,
        template: dict[str, Any],
        proxies: list[Proxy],
        groups: list[ProxyGroup],
    ) -> tuple[bytes, list[Proxy]]:
        existing_proxies = template.get("proxies") or []
        existing_groups = template.get("proxy-groups") or []
        if not isinstance(existing_proxies, list):
            existing_proxies = []
        if not isinstance(existing_groups, list):
            existing_groups = []

        dropped: list[Proxy] = []
        proxy_entries: list[dict[str, Any]] = []
        for p in proxies:
            entry = _proxy_to_entry(p)
            if entry is None:
                dropped.append(p)
                continue
            proxy_entries.append(entry)

        group_entries = [_group_to_entry(g) for g in groups]

        template["proxies"] = proxy_entries + list(existing_proxies)
        template["proxy-groups"] = group_entries + list(existing_groups)

        body = yaml.safe_dump(
            template,
            allow_unicode=True,
            sort_keys=False,
            default_flow_style=False,
        ).encode("utf-8")
        return body, dropped
