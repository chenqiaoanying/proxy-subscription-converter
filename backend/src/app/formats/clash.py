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
    AnyTlsProxy,
    BaseProxy,
    Hysteria1Proxy,
    Hysteria2Proxy,
    HttpProxy,
    KNOWN_PROXY_TYPES,
    MieruProxy,
    Proxy,
    ProxyGroup,
    ShadowsocksProxy,
    ShadowsocksRProxy,
    SshProxy,
    SnellProxy,
    SocksProxy,
    TlsConfig,
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
    "ssr": "shadowsocksr",
    "ssh": "ssh",
    "snell": "snell",
    "hysteria": "hysteria",
    "anytls": "anytls",
    "mieru": "mieru",
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
    "shadowsocksr": "ssr",
    "ssh": "ssh",
    "snell": "snell",
    "hysteria": "hysteria",
    "anytls": "anytls",
    "mieru": "mieru",
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
    # mieru may omit port in favour of port-range
    port_ok = isinstance(port, int) or (raw_type == "mieru" and entry.get("port-range"))
    if not (isinstance(raw_type, str) and isinstance(name, str) and server and port_ok):
        return None
    port = port if isinstance(port, int) else 0

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
        if unified_type == "shadowsocksr":
            return ShadowsocksRProxy(
                **common,
                cipher=entry.get("cipher", ""),
                password=entry.get("password", ""),
                obfs=entry.get("obfs", ""),
                protocol=entry.get("protocol", ""),
                obfs_param=entry.get("obfs-param"),
                protocol_param=entry.get("protocol-param"),
                udp=bool(entry.get("udp", False)),
            )
        if unified_type == "ssh":
            return SshProxy(
                **common,
                username=entry.get("username"),
                password=entry.get("password"),
                private_key=entry.get("private-key"),
                private_key_passphrase=entry.get("private-key-passphrase"),
                host_key=entry.get("host-key"),
                host_key_algorithms=entry.get("host-key-algorithms"),
            )
        if unified_type == "snell":
            obfs_opts: dict[str, Any] = entry.get("obfs-opts") or {}
            return SnellProxy(
                **common,
                psk=entry.get("psk", ""),
                version=entry.get("version"),
                obfs_mode=obfs_opts.get("mode"),
                obfs_host=obfs_opts.get("host"),
                udp=bool(entry.get("udp", False)),
            )
        if unified_type == "hysteria":
            tls_fields = ("sni", "skip-cert-verify", "alpn", "fingerprint")
            hy_tls = TlsConfig(
                enabled=True,
                server_name=entry.get("sni"),
                insecure=bool(entry.get("skip-cert-verify", False)),
                alpn=entry.get("alpn"),
                utls_fingerprint=entry.get("fingerprint"),
            ) if any(entry.get(k) for k in tls_fields) else None
            return Hysteria1Proxy(
                name=name,
                server=server,
                port=port,
                tls=hy_tls,
                transport=None,
                auth_str=entry.get("auth-str"),
                obfs=entry.get("obfs"),
                alpn=entry.get("alpn"),
                protocol=entry.get("protocol"),
                up_mbps=_coerce_int(entry.get("up")),
                down_mbps=_coerce_int(entry.get("down")),
                fast_open=bool(entry.get("fast-open", False)),
            )
        if unified_type == "anytls":
            tls_fields = ("sni", "skip-cert-verify", "alpn", "client-fingerprint")
            at_tls = TlsConfig(
                enabled=True,
                server_name=entry.get("sni"),
                insecure=bool(entry.get("skip-cert-verify", False)),
                alpn=entry.get("alpn"),
                utls_fingerprint=entry.get("client-fingerprint"),
            ) if any(entry.get(k) for k in tls_fields) else None
            return AnyTlsProxy(
                name=name,
                server=server,
                port=port,
                tls=at_tls,
                transport=None,
                password=entry.get("password", ""),
                udp=bool(entry.get("udp", False)),
                idle_session_check_interval=entry.get("idle-session-check-interval"),
                idle_session_timeout=entry.get("idle-session-timeout"),
                min_idle_session=entry.get("min-idle-session"),
            )
        if unified_type == "mieru":
            return MieruProxy(
                name=name,
                server=server,
                port=port,
                tls=None,
                transport=None,
                port_range=entry.get("port-range"),
                mieru_transport=entry.get("transport", "TCP"),
                username=entry.get("username", ""),
                password=entry.get("password", ""),
                multiplexing=entry.get("multiplexing"),
                traffic_pattern=entry.get("traffic-pattern"),
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
    if not isinstance(p, (Hysteria1Proxy, AnyTlsProxy, MieruProxy)):
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
    elif isinstance(p, ShadowsocksRProxy):
        entry["cipher"] = p.cipher
        entry["password"] = p.password
        entry["obfs"] = p.obfs
        entry["protocol"] = p.protocol
        if p.obfs_param:
            entry["obfs-param"] = p.obfs_param
        if p.protocol_param:
            entry["protocol-param"] = p.protocol_param
        if p.udp:
            entry["udp"] = True
    elif isinstance(p, SshProxy):
        if p.username:
            entry["username"] = p.username
        if p.password:
            entry["password"] = p.password
        if p.private_key:
            entry["private-key"] = p.private_key
        if p.private_key_passphrase:
            entry["private-key-passphrase"] = p.private_key_passphrase
        if p.host_key:
            entry["host-key"] = list(p.host_key)
        if p.host_key_algorithms:
            entry["host-key-algorithms"] = list(p.host_key_algorithms)
    elif isinstance(p, SnellProxy):
        entry["psk"] = p.psk
        if p.version is not None:
            entry["version"] = p.version
        snell_obfs: dict[str, Any] = {}
        if p.obfs_mode:
            snell_obfs["mode"] = p.obfs_mode
        if p.obfs_host:
            snell_obfs["host"] = p.obfs_host
        if snell_obfs:
            entry["obfs-opts"] = snell_obfs
        if p.udp:
            entry["udp"] = True
    elif isinstance(p, Hysteria1Proxy):
        if p.tls:
            if p.tls.server_name:
                entry["sni"] = p.tls.server_name
            if p.tls.insecure:
                entry["skip-cert-verify"] = True
            if p.tls.utls_fingerprint:
                entry["fingerprint"] = p.tls.utls_fingerprint
        if p.auth_str:
            entry["auth-str"] = p.auth_str
        if p.obfs:
            entry["obfs"] = p.obfs
        if p.alpn:
            entry["alpn"] = list(p.alpn)
        if p.protocol:
            entry["protocol"] = p.protocol
        if p.up_mbps is not None:
            entry["up"] = p.up_mbps
        if p.down_mbps is not None:
            entry["down"] = p.down_mbps
        if p.fast_open:
            entry["fast-open"] = True
    elif isinstance(p, AnyTlsProxy):
        entry["password"] = p.password
        if p.tls:
            if p.tls.server_name:
                entry["sni"] = p.tls.server_name
            if p.tls.insecure:
                entry["skip-cert-verify"] = True
            if p.tls.alpn:
                entry["alpn"] = list(p.tls.alpn)
            if p.tls.utls_fingerprint:
                entry["client-fingerprint"] = p.tls.utls_fingerprint
        if p.udp:
            entry["udp"] = True
        if p.idle_session_check_interval is not None:
            entry["idle-session-check-interval"] = p.idle_session_check_interval
        if p.idle_session_timeout is not None:
            entry["idle-session-timeout"] = p.idle_session_timeout
        if p.min_idle_session is not None:
            entry["min-idle-session"] = p.min_idle_session
    elif isinstance(p, MieruProxy):
        if p.port:
            entry["port"] = p.port
        if p.port_range:
            entry["port-range"] = p.port_range
        entry["transport"] = p.mieru_transport
        entry["username"] = p.username
        entry["password"] = p.password
        if p.multiplexing:
            entry["multiplexing"] = p.multiplexing
        if p.traffic_pattern is not None:
            entry["traffic-pattern"] = p.traffic_pattern
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
