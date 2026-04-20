"""Shared helpers: Clash <-> unified TLS/transport conversion."""
from __future__ import annotations

from typing import Any

from src.app.formats.model import TlsConfig, TransportConfig


def clash_tls_from(entry: dict[str, Any]) -> TlsConfig | None:
    """Extract TLS info from a Clash proxy dict (flat fields)."""
    has_tls = bool(entry.get("tls")) or "servername" in entry or "reality-opts" in entry
    if not has_tls:
        return None
    reality = entry.get("reality-opts") or {}
    return TlsConfig(
        enabled=bool(entry.get("tls", False)),
        server_name=entry.get("servername") or entry.get("sni"),
        insecure=bool(entry.get("skip-cert-verify", False)),
        alpn=entry.get("alpn"),
        reality_public_key=reality.get("public-key") if reality else None,
        reality_short_id=reality.get("short-id") if reality else None,
        utls_fingerprint=entry.get("client-fingerprint"),
    )


def clash_tls_to(tls: TlsConfig | None) -> dict[str, Any]:
    """Emit Clash flat TLS fields from a unified TlsConfig."""
    if tls is None:
        return {}
    out: dict[str, Any] = {"tls": tls.enabled}
    if tls.server_name:
        out["servername"] = tls.server_name
    if tls.insecure:
        out["skip-cert-verify"] = True
    if tls.alpn:
        out["alpn"] = list(tls.alpn)
    if tls.utls_fingerprint:
        out["client-fingerprint"] = tls.utls_fingerprint
    if tls.reality_public_key:
        reality: dict[str, Any] = {"public-key": tls.reality_public_key}
        if tls.reality_short_id:
            reality["short-id"] = tls.reality_short_id
        out["reality-opts"] = reality
    return out


def clash_transport_from(entry: dict[str, Any]) -> TransportConfig | None:
    """Detect transport from Clash proxy dict (`network` + `*-opts`)."""
    network = entry.get("network")
    if network == "ws":
        ws = entry.get("ws-opts") or {}
        return TransportConfig(
            type="ws",
            path=ws.get("path"),
            headers=ws.get("headers"),
        )
    if network == "grpc":
        grpc = entry.get("grpc-opts") or {}
        return TransportConfig(
            type="grpc",
            service_name=grpc.get("grpc-service-name"),
        )
    if network == "http":
        h2 = entry.get("h2-opts") or {}
        return TransportConfig(
            type="http",
            path=h2.get("path"),
            host=h2.get("host"),
        )
    if network == "httpupgrade":
        hu = entry.get("http-upgrade-opts") or {}
        return TransportConfig(
            type="httpupgrade",
            path=hu.get("path"),
            headers=hu.get("headers"),
        )
    return None


def clash_transport_to(t: TransportConfig | None) -> dict[str, Any]:
    """Emit Clash `network` + `*-opts` from a unified TransportConfig."""
    if t is None or t.type is None:
        return {}
    out: dict[str, Any] = {"network": t.type}
    if t.type == "ws":
        ws: dict[str, Any] = {}
        if t.path:
            ws["path"] = t.path
        if t.headers:
            ws["headers"] = dict(t.headers)
        if ws:
            out["ws-opts"] = ws
    elif t.type == "grpc":
        if t.service_name:
            out["grpc-opts"] = {"grpc-service-name": t.service_name}
    elif t.type == "http":
        h2: dict[str, Any] = {}
        if t.path:
            h2["path"] = t.path
        if t.host:
            h2["host"] = list(t.host)
        if h2:
            out["h2-opts"] = h2
    elif t.type == "httpupgrade":
        hu: dict[str, Any] = {}
        if t.path:
            hu["path"] = t.path
        if t.headers:
            hu["headers"] = dict(t.headers)
        if hu:
            out["http-upgrade-opts"] = hu
    return out


def sing_box_tls_from(entry: dict[str, Any]) -> TlsConfig | None:
    tls = entry.get("tls")
    if not isinstance(tls, dict):
        return None
    reality = tls.get("reality") or {}
    utls = tls.get("utls") or {}
    return TlsConfig(
        enabled=bool(tls.get("enabled", False)),
        server_name=tls.get("server_name"),
        insecure=bool(tls.get("insecure", False)),
        alpn=tls.get("alpn"),
        reality_public_key=reality.get("public_key") if reality else None,
        reality_short_id=reality.get("short_id") if reality else None,
        utls_fingerprint=utls.get("fingerprint") if utls else None,
    )


def sing_box_tls_to(tls: TlsConfig | None) -> dict[str, Any]:
    if tls is None:
        return {}
    out: dict[str, Any] = {"enabled": tls.enabled}
    if tls.server_name:
        out["server_name"] = tls.server_name
    if tls.insecure:
        out["insecure"] = True
    if tls.alpn:
        out["alpn"] = list(tls.alpn)
    if tls.utls_fingerprint:
        out["utls"] = {"enabled": True, "fingerprint": tls.utls_fingerprint}
    if tls.reality_public_key:
        reality: dict[str, Any] = {"enabled": True, "public_key": tls.reality_public_key}
        if tls.reality_short_id:
            reality["short_id"] = tls.reality_short_id
        out["reality"] = reality
    return {"tls": out}


def sing_box_transport_from(entry: dict[str, Any]) -> TransportConfig | None:
    t = entry.get("transport")
    if not isinstance(t, dict):
        return None
    kind = t.get("type")
    if kind not in {"ws", "grpc", "http", "httpupgrade"}:
        return None
    return TransportConfig(
        type=kind,
        path=t.get("path"),
        headers=t.get("headers"),
        host=t.get("host"),
        service_name=t.get("service_name"),
        method=t.get("method"),
    )


def sing_box_transport_to(t: TransportConfig | None) -> dict[str, Any]:
    if t is None or t.type is None:
        return {}
    out: dict[str, Any] = {"type": t.type}
    if t.path:
        out["path"] = t.path
    if t.headers:
        out["headers"] = dict(t.headers)
    if t.host:
        out["host"] = list(t.host)
    if t.service_name:
        out["service_name"] = t.service_name
    if t.method:
        out["method"] = t.method
    return {"transport": out}
