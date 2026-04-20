"""Unified proxy model shared across source/target formats."""
from __future__ import annotations

from typing import Annotated, Any, Literal, Union

from pydantic import BaseModel, ConfigDict, Field


class TlsConfig(BaseModel):
    model_config = ConfigDict(extra="allow")

    enabled: bool = False
    server_name: str | None = None
    insecure: bool = False
    alpn: list[str] | None = None
    reality_public_key: str | None = None
    reality_short_id: str | None = None
    utls_fingerprint: str | None = None


class TransportConfig(BaseModel):
    model_config = ConfigDict(extra="allow")

    type: Literal["ws", "grpc", "http", "httpupgrade"] | None = None
    path: str | None = None
    host: list[str] | None = None
    headers: dict[str, str] | None = None
    service_name: str | None = None  # grpc
    method: str | None = None        # http


class UrlTestOpts(BaseModel):
    model_config = ConfigDict(extra="allow")

    url: str | None = None
    interval: str | None = None       # e.g. "3m"
    tolerance: int | None = None
    idle_timeout: str | None = None
    interrupt_exist_connections: bool | None = None


class BaseProxy(BaseModel):
    """Shared fields for every proxy protocol."""

    model_config = ConfigDict(extra="allow", populate_by_name=True)

    name: str
    type: str
    server: str
    port: int
    tls: TlsConfig | None = None
    transport: TransportConfig | None = None
    extra_sing_box: dict[str, Any] = Field(default_factory=dict)
    extra_clash: dict[str, Any] = Field(default_factory=dict)


class ShadowsocksProxy(BaseProxy):
    type: Literal["shadowsocks"] = "shadowsocks"
    method: str
    password: str
    plugin: str | None = None
    plugin_opts: dict[str, Any] | None = None


class VmessProxy(BaseProxy):
    type: Literal["vmess"] = "vmess"
    uuid: str
    alter_id: int = 0
    security: str = "auto"


class VlessProxy(BaseProxy):
    type: Literal["vless"] = "vless"
    uuid: str
    flow: str | None = None


class TrojanProxy(BaseProxy):
    type: Literal["trojan"] = "trojan"
    password: str


class Hysteria2Proxy(BaseProxy):
    type: Literal["hysteria2"] = "hysteria2"
    password: str
    obfs: str | None = None
    obfs_password: str | None = None
    up_mbps: int | None = None
    down_mbps: int | None = None


class TuicProxy(BaseProxy):
    type: Literal["tuic"] = "tuic"
    uuid: str
    password: str
    congestion_control: str | None = None
    udp_relay_mode: str | None = None


class WireguardProxy(BaseProxy):
    type: Literal["wireguard"] = "wireguard"
    private_key: str
    peer_public_key: str | None = None
    pre_shared_key: str | None = None
    local_address: list[str] | None = None
    mtu: int | None = None
    reserved: list[int] | None = None


class HttpProxy(BaseProxy):
    type: Literal["http"] = "http"
    username: str | None = None
    password: str | None = None


class SocksProxy(BaseProxy):
    type: Literal["socks"] = "socks"
    username: str | None = None
    password: str | None = None
    version: str = "5"


class UnknownProxy(BaseProxy):
    """Fallback preserving the original raw dict for round-trip in same format."""

    type: str  # arbitrary
    raw: dict[str, Any] = Field(default_factory=dict)
    source_format: Literal["sing-box", "clash"] = "sing-box"


Proxy = Annotated[
    Union[
        ShadowsocksProxy,
        VmessProxy,
        VlessProxy,
        TrojanProxy,
        Hysteria2Proxy,
        TuicProxy,
        WireguardProxy,
        HttpProxy,
        SocksProxy,
        UnknownProxy,
    ],
    Field(discriminator="type"),
]


class ProxyGroup(BaseModel):
    """Unified outbound group (selector / urltest)."""

    model_config = ConfigDict(extra="allow")

    name: str
    type: Literal["selector", "urltest"]
    proxies: list[str]
    urltest: UrlTestOpts | None = None


KNOWN_PROXY_TYPES: set[str] = {
    "shadowsocks",
    "vmess",
    "vless",
    "trojan",
    "hysteria2",
    "tuic",
    "wireguard",
    "http",
    "socks",
}
