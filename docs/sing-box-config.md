# sing-box Configuration Reference

> Source: https://sing-box.sagernet.org/configuration  
> Fetched: 2026-04-20

---

## Table of Contents

1. [Top-Level Structure](#top-level-structure)
2. [Log](#log)
3. [DNS](#dns)
   - [DNS Servers](#dns-servers)
   - [DNS Rules](#dns-rules)
4. [NTP](#ntp)
5. [Route](#route)
   - [Route Rules](#route-rules)
   - [Rule Set](#rule-set)
6. [Inbound](#inbound)
   - [TUN](#tun-inbound)
   - [Shadowsocks Inbound](#shadowsocks-inbound)
7. [Outbound](#outbound)
   - [Selector](#selector-outbound)
   - [URLTest](#urltest-outbound)
   - [Shadowsocks Outbound](#shadowsocks-outbound)
8. [Shared Fields](#shared-fields)
   - [Listen Fields](#listen-fields)
   - [Dial Fields](#dial-fields)
   - [TLS — Inbound](#tls--inbound)
   - [TLS — Outbound](#tls--outbound)
   - [Multiplex](#multiplex)
9. [Experimental](#experimental)

---

## Top-Level Structure

Source: https://sing-box.sagernet.org/configuration/

sing-box uses JSON for configuration. Top-level fields:

| Field | Type | Description |
|-------|------|-------------|
| `log` | Object | Logging configuration |
| `dns` | Object | DNS servers, rules, and caching |
| `ntp` | Object | Network Time Protocol client |
| `certificate` | Object | Certificate management |
| `certificate_providers` | Array | Certificate provider configurations |
| `http_clients` | Array | HTTP client settings |
| `endpoints` | Array | Endpoint definitions (WireGuard, Tailscale) |
| `inbounds` | Array | Incoming connection handlers |
| `outbounds` | Array | Outgoing connection handlers |
| `route` | Object | Traffic routing rules and rule sets |
| `services` | Array | Service configurations (DERP, Resolved, APIs) |
| `experimental` | Object | Cache, Clash API, V2Ray API |

### CLI Commands

```bash
# Validate config
sing-box check

# Format config in-place
sing-box format -w -c config.json -D config_directory

# Merge multiple configs
sing-box merge output.json -c config.json -D config_directory
```

---

## Log

Source: https://sing-box.sagernet.org/configuration/log/

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `disabled` | bool | `false` | Stop all logging after startup |
| `level` | string | — | `trace` / `debug` / `info` / `warn` / `error` / `fatal` / `panic` |
| `output` | string | — | File path for log output; disables console logging when set |
| `timestamp` | bool | `true` | Include timestamp on each log line |

```json
{
  "log": {
    "disabled": false,
    "level": "info",
    "output": "box.log",
    "timestamp": true
  }
}
```

---

## DNS

Source: https://sing-box.sagernet.org/configuration/dns/

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `servers` | array | — | DNS server configurations |
| `rules` | array | — | DNS rule configurations |
| `fakeip` | object | — | FakeIP settings |
| `final` | string | first server | Default server tag when no rule matches |
| `strategy` | string | — | `prefer_ipv4` / `prefer_ipv6` / `ipv4_only` / `ipv6_only` |
| `disable_cache` | bool | `false` | Disable DNS caching (conflicts with `optimistic`) |
| `disable_expire` | bool | `false` | Disable cache expiration (conflicts with `optimistic`) |
| `independent_cache` | bool | `false` | **Deprecated v1.14.0** — per-server independent cache |
| `cache_capacity` | int | — | LRU cache size; values under 1024 are ignored |
| `reverse_mapping` | bool | `false` | Store IP→domain mappings for use in routing rules |
| `client_subnet` | string | — | Append EDNS0-subnet OPT record to all queries |
| `optimistic` | bool/object | — | **v1.14.0+** Return stale cached responses, refresh in background. Object form: `{ "enabled": true, "timeout": "3d" }` |

### DNS Servers

Source: https://sing-box.sagernet.org/configuration/dns/server/

Each entry in `dns.servers`:

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Server implementation type (see table below) |
| `tag` | string | Unique identifier used in rules and `final` |

**Server types:**

| Type | Description |
|------|-------------|
| *(empty)* | Legacy |
| `local` | System local resolver |
| `hosts` | Hosts file |
| `tcp` | DNS over TCP |
| `udp` | DNS over UDP |
| `tls` | DNS over TLS (DoT) |
| `quic` | DNS over QUIC (DoQ) |
| `https` | DNS over HTTPS (DoH) |
| `h3` | DNS over HTTP/3 |
| `dhcp` | DHCP-based |
| `fakeip` | Fake IP pool |
| `tailscale` | Tailscale MagicDNS |
| `resolved` | systemd-resolved |

### DNS Rules

Source: https://sing-box.sagernet.org/configuration/dns/rule/

Rules are evaluated top-to-bottom. Supported matching fields:

**Domain matching:**

| Field | Description |
|-------|-------------|
| `domain` | Exact domain match |
| `domain_suffix` | Suffix match (e.g. `.cn`) |
| `domain_keyword` | Substring in domain |
| `domain_regex` | Regex match |

**Query / network:**

| Field | Description |
|-------|-------------|
| `query_type` | DNS query type: `A`, `AAAA`, `HTTPS`, or integer type codes |
| `ip_version` | `4` or `6` |
| `network` | `tcp` or `udp` |
| `auth_user` | Authenticated username |

**Source matching:**

| Field | Description |
|-------|-------------|
| `source_ip_cidr` | Source IP ranges |
| `source_ip_is_private` | Non-public source IPs (v1.8.0+) |
| `source_port` / `source_port_range` | Source port(s) |
| `source_mac_address` | Device MAC (v1.14.0+, requires Neighbor Resolution) |
| `source_hostname` | Device hostname via DHCP (v1.14.0+) |

**Process / application:**

| Field | Description |
|-------|-------------|
| `process_name` | Process name (Linux/Windows/macOS) |
| `process_path` | Process path (Linux/Windows/macOS) |
| `process_path_regex` | Process path regex (v1.10.0+) |
| `package_name` | Android package name |
| `package_name_regex` | Android package regex (v1.14.0+) |
| `user` / `user_id` | Linux username / UID |

**Network state (graphical clients):**

| Field | Description |
|-------|-------------|
| `network_type` | `wifi` / `cellular` / `ethernet` / `other` (v1.11.0+) |
| `network_is_expensive` | Metered connection (v1.11.0+) |
| `network_is_constrained` | Low Data Mode — Apple platforms (v1.11.0+) |
| `wifi_ssid` / `wifi_bssid` | WiFi network name / AP MAC |

**Interface / address:**

| Field | Description |
|-------|-------------|
| `interface_address` | Specific interface address (v1.13.0+) |
| `network_interface_address` | Network type interface (v1.13.0+) |
| `default_interface_address` | Default route interface (v1.13.0+) |

**Rule sets / advanced:**

| Field | Description |
|-------|-------------|
| `rule_set` | Reference an external rule-set (v1.8.0+) |
| `rule_set_ip_cidr_match_source` | Apply rule-set CIDRs to source IP (v1.10.0+) |
| `clash_mode` | Clash proxy mode |
| `invert` | Invert match result |
| `action` | Required — see DNS Rule Actions |

**Response matching (v1.14.0+, requires preceding `evaluate` action):**

| Field | Description |
|-------|-------------|
| `match_response` | Enable response-based matching |
| `response_rcode` | DNS response code |
| `response_answer` | DNS answer records |
| `response_ns` / `response_extra` | NS / additional records |

**Logical rules:**

```json
{
  "type": "logical",
  "mode": "and",
  "rules": [ ... ]
}
```

**Default matching formula:**

```
(domain OR domain_suffix OR domain_keyword OR domain_regex) AND
(port OR port_range) AND
(source_ip_cidr OR source_ip_is_private) AND
(source_port OR source_port_range) AND
[other fields]
```

---

## NTP

Source: https://sing-box.sagernet.org/configuration/ntp/

Built-in NTP client. Required for protocols like TLS, Shadowsocks, and VMess in environments without time sync.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | bool | `false` | Activate NTP service |
| `server` | string | — | NTP server hostname or IP |
| `server_port` | int | `123` | NTP port |
| `interval` | duration | `30m` | Sync frequency |

Also accepts all [Dial Fields](#dial-fields).

```json
{
  "ntp": {
    "enabled": false,
    "server": "time.apple.com",
    "server_port": 123,
    "interval": "30m"
  }
}
```

---

## Route

Source: https://sing-box.sagernet.org/configuration/route/

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `rules` | array | — | Routing rules |
| `rule_set` | array | — | Remote/local/inline rule sets (v1.8.0+) |
| `final` | string | first outbound | Default outbound when no rule matches |
| `auto_detect_interface` | bool | `false` | Bind to default NIC to prevent routing loops under TUN (Linux/Windows/macOS) |
| `override_android_vpn` | bool | `false` | Accept Android VPN as upstream NIC |
| `default_interface` | string | — | Bind to this NIC by default (Linux/Windows/macOS) |
| `default_mark` | int | `0` | Default routing mark (Linux only) |
| `find_process` | bool | `false` | Enable process search for logging |
| `find_neighbor` | bool | `false` | Enable neighbor resolution (v1.14.0+; Linux/macOS) |
| `dhcp_lease_files` | array | — | Custom DHCP lease paths for hostname/MAC resolution (v1.14.0+) |
| `default_http_client` | string | — | HTTP client tag for remote rule-set downloads (v1.14.0+) |
| `default_domain_resolver` | string/object | — | Domain resolver config (v1.12.0+) |
| `default_network_strategy` | string | — | Network strategy for dial operations (v1.11.0+) |
| `default_network_type` | array | — | Network type preferences (v1.11.0+) |
| `default_fallback_network_type` | array | — | Fallback network types (v1.11.0+) |
| `default_fallback_delay` | duration | — | Fallback connection delay (v1.11.0+) |

> `geoip` and `geosite` fields are deprecated since v1.8.0; use `rule_set` instead.

### Route Rules

Source: https://sing-box.sagernet.org/configuration/route/rule/

**Domain matching:**

| Field | Description |
|-------|-------------|
| `domain` | Exact domain |
| `domain_suffix` | Domain suffix |
| `domain_keyword` | Substring |
| `domain_regex` | Regex |

**Network / protocol:**

| Field | Description |
|-------|-------------|
| `network` | `tcp` / `udp` / `icmp` (v1.13.0+) |
| `protocol` | Sniffed protocol |
| `client` | Sniffed client identifier (v1.10.0+) |
| `ip_version` | `4` or `6` |

**IP matching:**

| Field | Description |
|-------|-------------|
| `ip_cidr` | Destination IP ranges |
| `source_ip_cidr` | Source IP ranges |
| `ip_is_private` | Non-public destination (v1.8.0+) |
| `source_ip_is_private` | Non-public source (v1.8.0+) |

**Port matching:**

| Field | Description |
|-------|-------------|
| `port` | Destination port(s) |
| `port_range` | Port ranges: `"1000:2000"`, `":3000"`, `"4000:"` |
| `source_port` | Source port(s) |
| `source_port_range` | Source port ranges |

**Process / application:**

| Field | Description |
|-------|-------------|
| `process_name` | Executable name (Linux/Windows/macOS) |
| `process_path` | Full path (Linux/Windows/macOS) |
| `process_path_regex` | Path regex (v1.10.0+) |
| `package_name` | Android package |
| `package_name_regex` | Android package regex (v1.14.0+) |

**User / auth:**

| Field | Description |
|-------|-------------|
| `auth_user` | Username from inbound |
| `user` | Linux username |
| `user_id` | Linux UID |

**Network interface / device:**

| Field | Description |
|-------|-------------|
| `inbound` | Inbound handler tags |
| `interface_address` | Specific interface IPs (v1.13.0+) |
| `network_interface_address` | Network type interfaces (v1.13.0+) |
| `default_interface_address` | Default route interface (v1.13.0+) |
| `source_mac_address` | Device MAC (v1.14.0+) |
| `source_hostname` | Hostname from DHCP (v1.14.0+) |

**Network conditions (graphical clients):**

| Field | Description |
|-------|-------------|
| `network_type` | `wifi` / `cellular` / `ethernet` / `other` (v1.11.0+) |
| `network_is_expensive` | Metered network (v1.11.0+) |
| `network_is_constrained` | Low Data Mode — Apple (v1.11.0+) |
| `wifi_ssid` / `wifi_bssid` | WiFi SSID / BSSID |

**Advanced:**

| Field | Description |
|-------|-------------|
| `clash_mode` | Clash operation mode |
| `preferred_by` | Outbound preferences: `tailscale`, `wireguard` |
| `rule_set` | Reference external rule sets (v1.8.0+) |
| `rule_set_ip_cidr_match_source` | Apply rule-set CIDR to source IP (v1.10.0+) |
| `invert` | Negate match |
| `action` | Required; see Rule Actions (v1.11.0+) |

**Logical rules:**

```json
{
  "type": "logical",
  "mode": "and",
  "rules": [ ... ]
}
```

**Default matching formula:**

```
(domain OR domain_suffix OR domain_keyword OR domain_regex OR ip_cidr OR ip_is_private) AND
(port OR port_range) AND
(source_ip_cidr OR source_ip_is_private) AND
(source_port OR source_port_range) AND
[other fields]
```

### Rule Set

Source: https://sing-box.sagernet.org/configuration/rule-set/

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | `local` / `remote` / `inline` |
| `tag` | string | Yes | Unique identifier |
| `format` | string | No | `source` (`.json`) or `binary` (`.srs`); auto-detected from extension |

**Inline type (v1.10.0+):**

| Field | Type | Description |
|-------|------|-------------|
| `rules` | array | Headless Rule objects inline |

**Local type:**

| Field | Type | Description |
|-------|------|-------------|
| `path` | string | File system path; auto-reloads on modification (v1.10.0+) |

**Remote type:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `url` | string | — | HTTP(S) endpoint |
| `http_client` | object | — | HTTP client config (v1.14.0+) |
| `update_interval` | duration | `1d` | Refresh frequency |
| `download_detour` | string | — | **Deprecated v1.16.0** — use `http_client` instead |

```json
{
  "type": "remote",
  "tag": "geosite-cn",
  "format": "binary",
  "url": "https://example.com/geosite-cn.srs",
  "update_interval": "7d"
}
```

---

## Inbound

Source: https://sing-box.sagernet.org/configuration/inbound/

All inbounds require:
- `type` — protocol type
- `tag` — unique identifier

**Available inbound types:**

| Type | Protocol | Injectable |
|------|----------|-----------|
| `direct` | Direct | Yes |
| `mixed` | Mixed (HTTP+SOCKS) | — |
| `socks` | SOCKS | — |
| `http` | HTTP | — |
| `shadowsocks` | Shadowsocks | — |
| `vmess` | VMess | — |
| `trojan` | Trojan | — |
| `naive` | NaiveProxy | — |
| `hysteria` | Hysteria | — |
| `shadowtls` | ShadowTLS | — |
| `tuic` | TUIC | — |
| `hysteria2` | Hysteria 2 | — |
| `vless` | VLESS | — |
| `anytls` | AnyTLS | — |
| `tun` | TUN | — |
| `redirect` | Redirect | — |
| `tproxy` | TProxy | — |
| `cloudflared` | Cloudflare Tunnel | — |

### TUN Inbound

Source: https://sing-box.sagernet.org/configuration/inbound/tun/

**Core settings:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | string | — | `"tun"` |
| `tag` | string | — | Identifier |
| `interface_name` | string | auto | Virtual interface name |
| `address` | string[] | — | IPv4/IPv6 prefixes for the TUN interface |
| `mtu` | int | — | Maximum transmission unit |

**Routing:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `auto_route` | bool | `false` | Set default route through TUN |
| `strict_route` | bool | — | Enforce strict routing (requires `auto_route`) |
| `route_address` | string[] | — | Custom routes instead of default |
| `route_exclude_address` | string[] | — | Exclude these from TUN routes |
| `route_address_set` | string[] | — | Rule-set tags whose IPs are routed through TUN |
| `route_exclude_address_set` | string[] | — | Rule-set tags whose IPs bypass TUN |
| `iproute2_table_index` | int | `2022` | Linux iproute2 table index |
| `iproute2_rule_index` | int | `9000` | Linux iproute2 rule start index |

**Auto-redirect (Linux):**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `auto_redirect` | bool | `false` | Use nftables for improved TUN routing |
| `auto_redirect_input_mark` | string | `0x2023` | Input connection mark |
| `auto_redirect_output_mark` | string | `0x2024` | Output connection mark |
| `auto_redirect_reset_mark` | string | `0x2025` | Reset connection mark (v1.13.0+) |
| `auto_redirect_nfqueue` | int | `100` | NFQueue number (v1.13.0+) |

**NAT & performance:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `endpoint_independent_nat` | bool | — | Enable EIM NAT (gvisor stack) |
| `udp_timeout` | duration | `5m` | UDP NAT session expiry |
| `stack` | string | `mixed`/`system` | `system` / `gvisor` / `mixed` |
| `exclude_mptcp` | bool | — | Bypass MPTCP (v1.13.0+) |

**Interface filtering (Linux):**

| Field | Description |
|-------|-------------|
| `include_interface` | Limit to these network interfaces |
| `exclude_interface` | Exclude these network interfaces |

**User / package filtering (Linux/Android):**

| Field | Description |
|-------|-------------|
| `include_uid` / `include_uid_range` | Route only these UIDs |
| `exclude_uid` / `exclude_uid_range` | Exclude these UIDs |
| `include_android_user` | Android user IDs (`0`=main, `10`=work) |
| `include_package` / `exclude_package` | Android package names |

**MAC address filtering (Linux, v1.14.0+):**

| Field | Description |
|-------|-------------|
| `include_mac_address` | Route only these MACs |
| `exclude_mac_address` | Exclude these MACs |

**Platform HTTP proxy:**

| Field | Type | Description |
|-------|------|-------------|
| `platform.http_proxy.enabled` | bool | Enable system HTTP proxy |
| `platform.http_proxy.server` | string | Proxy address |
| `platform.http_proxy.server_port` | int | Proxy port |
| `platform.http_proxy.bypass_domain` | string[] | Bypass these hosts |
| `platform.http_proxy.match_domain` | string[] | Use proxy for these hosts (Apple only) |

### Shadowsocks Inbound

Source: https://sing-box.sagernet.org/configuration/inbound/shadowsocks/

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | string | — | `"shadowsocks"` |
| `tag` | string | — | Identifier |
| `network` | string | both | `tcp` or `udp` |
| `method` | string | required | Encryption method |
| `password` | string | required | Password |
| `managed` | bool | `false` | Enable for SSM API dynamic user management |
| `multiplex` | object | — | Multiplex configuration |

**Encryption methods:**

| Method | Key length |
|--------|-----------|
| `2022-blake3-aes-128-gcm` | 16 bytes |
| `2022-blake3-aes-256-gcm` | 32 bytes |
| `2022-blake3-chacha20-poly1305` | 32 bytes |
| `none` | — |
| `aes-128-gcm`, `aes-192-gcm`, `aes-256-gcm` | — |
| `chacha20-ietf-poly1305`, `xchacha20-ietf-poly1305` | — |

Also supports `users` array (multi-user) and `destinations` array (relay).

---

## Outbound

Source: https://sing-box.sagernet.org/configuration/outbound/

All outbounds require `type` and `tag`. Available types:

| Type | Description |
|------|-------------|
| `direct` | Pass through directly |
| `block` | Drop traffic |
| `socks` | SOCKS5 proxy |
| `http` | HTTP proxy |
| `shadowsocks` | Shadowsocks proxy |
| `vmess` | VMess proxy |
| `trojan` | Trojan proxy |
| `wireguard` | WireGuard (supports IP connections) |
| `hysteria` | Hysteria proxy |
| `vless` | VLESS proxy |
| `shadowtls` | ShadowTLS proxy |
| `tuic` | TUIC proxy |
| `hysteria2` | Hysteria 2 proxy |
| `anytls` | AnyTLS proxy |
| `tor` | Tor network |
| `ssh` | SSH tunnel |
| `dns` | DNS outbound |
| `selector` | Manual selection group |
| `urltest` | Automatic latency-based selection |
| `naive` | NaiveProxy |

### Selector Outbound

Source: https://sing-box.sagernet.org/configuration/outbound/selector/

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | string | — | `"selector"` |
| `tag` | string | — | Identifier |
| `outbounds` | array | required | List of outbound tags to select from |
| `default` | string | first | Default selection |
| `interrupt_exist_connections` | bool | `false` | Terminate active inbound connections on selection change |

> Controlled via Clash API only.

```json
{
  "type": "selector",
  "tag": "select",
  "outbounds": ["proxy-a", "proxy-b", "proxy-c"],
  "default": "proxy-c",
  "interrupt_exist_connections": false
}
```

### URLTest Outbound

Source: https://sing-box.sagernet.org/configuration/outbound/urltest/

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | string | — | `"urltest"` |
| `tag` | string | — | Identifier |
| `outbounds` | array | required | List of outbound tags to test |
| `url` | string | `https://www.gstatic.com/generate_204` | URL to test against |
| `interval` | duration | `3m` | Test interval |
| `tolerance` | int | `50` | Tolerance in milliseconds before switching |
| `idle_timeout` | duration | `30m` | Stop testing after this idle period |
| `interrupt_exist_connections` | bool | `false` | Terminate active connections when selected outbound changes |

```json
{
  "type": "urltest",
  "tag": "auto",
  "outbounds": ["proxy-a", "proxy-b", "proxy-c"],
  "interval": "3m",
  "tolerance": 50
}
```

### Shadowsocks Outbound

Source: https://sing-box.sagernet.org/configuration/outbound/shadowsocks/

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | `"shadowsocks"` |
| `tag` | string | — | Identifier |
| `server` | string | Yes | Server address |
| `server_port` | int | Yes | Server port |
| `method` | string | Yes | Encryption method |
| `password` | string | Yes | Password |
| `plugin` | string | No | SIP003 plugin: `obfs-local` or `v2ray-plugin` |
| `plugin_opts` | string | No | SIP003 plugin options |
| `network` | string | both | `tcp` or `udp` |
| `udp_over_tcp` | bool/object | `false` | Tunnel UDP over TCP |
| `multiplex` | object | No | Multiplex config |

Also accepts all [Dial Fields](#dial-fields).

```json
{
  "type": "shadowsocks",
  "tag": "ss-out",
  "server": "127.0.0.1",
  "server_port": 1080,
  "method": "2022-blake3-aes-128-gcm",
  "password": "8JCsPssfgS8tiRwiMlhARg=="
}
```

---

## Shared Fields

### Listen Fields

Source: https://sing-box.sagernet.org/configuration/shared/listen/

Used by all inbound types.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `listen` | string | required | Listen address |
| `listen_port` | int | — | Listen port |
| `bind_interface` | string | — | Network interface to bind to (v1.12.0+) |
| `routing_mark` | int/hex | — | Netfilter routing mark (Linux only, v1.12.0+) |
| `reuse_addr` | bool | `false` | Reuse listener address (v1.12.0+) |
| `netns` | string | — | Network namespace name or path (Linux only, v1.12.0+) |
| `tcp_fast_open` | bool | `false` | Enable TCP Fast Open |
| `tcp_multi_path` | bool | `false` | Enable TCP Multi Path (Go 1.21+) |
| `disable_tcp_keep_alive` | bool | `false` | Disable TCP keep-alive (v1.13.0+) |
| `tcp_keep_alive` | duration | `5m` | TCP keep-alive initial period (v1.13.0+) |
| `tcp_keep_alive_interval` | duration | `75s` | TCP keep-alive interval |
| `udp_fragment` | bool | `false` | Enable UDP fragmentation |
| `udp_timeout` | duration | `5m` | UDP NAT expiry |
| `detour` | string | — | Forward connections to specified inbound |

> Sniff-related fields (`sniff`, `sniff_override_destination`, `sniff_timeout`, `domain_strategy`, `udp_disable_domain_unmapping`) were removed in v1.13.0.

### Dial Fields

Source: https://sing-box.sagernet.org/configuration/shared/dial/

Used by all outbound types and NTP.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `detour` | string | — | Route through this upstream outbound |
| `bind_interface` | string | — | Bind to this network interface |
| `inet4_bind_address` | string | — | IPv4 source address |
| `inet6_bind_address` | string | — | IPv6 source address |
| `bind_address_no_port` | bool | `false` | Don't reserve port when binding (Linux only, v1.13.0+) |
| `routing_mark` | int/hex | `0` | Netfilter routing mark (Linux only) |
| `reuse_addr` | bool | `false` | Reuse address |
| `netns` | string | — | Network namespace (Linux only, v1.12.0+) |
| `connect_timeout` | duration | — | Connection timeout |
| `tcp_fast_open` | bool | `false` | TCP Fast Open |
| `tcp_multi_path` | bool | `false` | TCP Multi Path (Go 1.21+) |
| `disable_tcp_keep_alive` | bool | `false` | Disable TCP keep-alive (v1.13.0+) |
| `tcp_keep_alive` | duration | `5m` | TCP keep-alive initial period (v1.13.0+) |
| `tcp_keep_alive_interval` | duration | `75s` | TCP keep-alive interval |
| `udp_fragment` | bool | `false` | UDP fragmentation |
| `domain_resolver` | string/object | — | DNS resolver for domain resolution (v1.12.0+) |
| `network_strategy` | string | — | Interface selection strategy (v1.11.0+, graphical clients) |
| `network_type` | array | — | `wifi` / `cellular` / `ethernet` / `other` (v1.11.0+) |
| `fallback_network_type` | array | — | Fallback network types (v1.11.0+) |
| `fallback_delay` | duration | `300ms` | RFC 6555 Fast Fallback delay (v1.11.0+) |

> `domain_strategy` deprecated in v1.12.0; use `domain_resolver` instead.

### TLS — Inbound

Source: https://sing-box.sagernet.org/configuration/shared/tls/

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | bool | `true` | Enable TLS |
| `server_name` | string | — | Hostname for virtual hosting / certificate verification |
| `alpn` | array | `[]` | Supported application protocols in preference order |
| `min_version` | string | `1.0` (server) | Minimum TLS version |
| `max_version` | string | `1.3` | Maximum TLS version |
| `cipher_suites` | array | `[]` | TLS 1.0–1.2 cipher suites (TLS 1.3 not configurable) |
| `curve_preferences` | array | P256, P384, P521, X25519, X25519MLKEM768 | Key exchange mechanisms |
| `certificate` | array | `[]` | Server cert chain (PEM lines) |
| `certificate_path` | string | — | Path to server cert chain (auto-reloads) |
| `key` | array | `[]` | Server private key (PEM lines) |
| `key_path` | string | — | Path to server private key (auto-reloads) |
| `client_authentication` | string | `"no"` | `no` / `request` / `require-any` / `verify-if-given` / `require-and-verify` |
| `client_certificate` | array | `[]` | Allowed client cert chain (PEM lines) |
| `client_certificate_path` | array | `[]` | Paths to allowed client cert chains |
| `client_certificate_public_key_sha256` | array | `[]` | SHA-256 hashes of allowed client cert public keys (base64) |
| `handshake_timeout` | duration | `15s` | TLS handshake timeout |
| `certificate_provider` | string/object | — | Shared certificate provider tag or inline config |
| `kernel_tx` | bool | `false` | Kernel TLS TX (Linux 5.1+, TLS 1.3 only) |
| `kernel_rx` | bool | `false` | Kernel TLS RX (Linux 5.1+, TLS 1.3 only) |
| `ech.enabled` | bool | `false` | Encrypted Client Hello |
| `ech.key` | array | `[]` | ECH key (PEM lines) |
| `ech.key_path` | string | — | Path to ECH key (auto-reloads) |
| `reality.enabled` | bool | `false` | Reality protocol |
| `reality.handshake` | object | required | Handshake server address + Dial Fields |
| `reality.private_key` | string | required | Private key from `sing-box generate reality-keypair` |
| `reality.short_id` | array | required | Hex strings 0–8 digits |
| `reality.max_time_difference` | duration | — | Max clock skew; disabled if empty |

### TLS — Outbound

Source: https://sing-box.sagernet.org/configuration/shared/tls/

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | bool | `true` | Enable TLS |
| `engine` | string | `go` | `go` or `apple` (macOS/iOS, direct TCP only) |
| `disable_sni` | bool | `false` | Omit SNI from ClientHello |
| `server_name` | string | — | Override server name for verification |
| `insecure` | bool | `false` | Accept any server certificate |
| `alpn` | array | `[]` | Supported ALPN protocols |
| `min_version` | string | `1.2` | Minimum TLS version |
| `max_version` | string | `1.3` | Maximum TLS version |
| `cipher_suites` | array | `[]` | TLS 1.0–1.2 cipher suites |
| `certificate` | string | — | Server certificate (PEM) for pinning |
| `certificate_path` | string | — | Path to server certificate |
| `certificate_public_key_sha256` | array | `[]` | SHA-256 hashes of server cert public keys (base64) |
| `client_certificate` | array | `[]` | Client cert chain (PEM lines) |
| `client_certificate_path` | string | — | Path to client cert chain |
| `client_key` | array | `[]` | Client private key (PEM lines) |
| `client_key_path` | string | — | Path to client private key |
| `handshake_timeout` | duration | `15s` | Handshake timeout |
| `kernel_tx` / `kernel_rx` | bool | `false` | Kernel TLS TX/RX (Linux 5.1+, TLS 1.3) |
| `fragment` | bool | `false` | Fragment TLS handshake to bypass firewalls |
| `fragment_fallback_delay` | duration | `500ms` | Fallback delay when auto-detect unavailable |
| `record_fragment` | bool | `false` | Fragment into multiple TLS records |
| `spoof` | string | — | Inject forged ClientHello with whitelisted SNI |
| `spoof_method` | string | `wrong-sequence` | `wrong-sequence` or `wrong-checksum` |
| `ech.enabled` | bool | `false` | Encrypted Client Hello |
| `ech.config` | array | `[]` | ECH config (PEM); attempts DNS if empty |
| `ech.config_path` | string | — | Path to ECH config |
| `ech.query_server_name` | string | — | Override domain for ECH HTTPS record lookup |
| `utls.enabled` | bool | `false` | uTLS browser fingerprinting |
| `utls.fingerprint` | string | `chrome` | `chrome` / `firefox` / `edge` / `safari` / `360` / `qq` / `ios` / `android` / `random` / `randomized` |
| `reality.enabled` | bool | `false` | Reality protocol |
| `reality.public_key` | string | required | Public key from `sing-box generate reality-keypair` |
| `reality.short_id` | string | required | Hex string 0–8 digits |

### Multiplex

Source: https://sing-box.sagernet.org/configuration/shared/multiplex/

**Inbound multiplex:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | bool | `true` | Enable multiplex support |
| `padding` | bool | `false` | Reject non-padded connections if enabled |
| `brutal` | object | — | TCP Brutal congestion control |

**Outbound multiplex:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | bool | `true` | Enable multiplex |
| `protocol` | string | `h2mux` | `smux` / `yamux` / `h2mux` |
| `max_connections` | int | `4` | Max connections (conflicts with `max_streams`) |
| `min_streams` | int | `4` | Min streams before opening new connection (conflicts with `max_streams`) |
| `max_streams` | int | `0` | Max streams per connection (conflicts with `max_connections` + `min_streams`) |
| `padding` | bool | `false` | Enable padding (v1.3-beta9+) |
| `brutal` | object | — | TCP Brutal config |

---

## Experimental

Source: https://sing-box.sagernet.org/configuration/experimental/

Available since v1.8.0. All three sub-fields are optional objects:

| Field | Description |
|-------|-------------|
| `cache_file` | Persistent DNS cache and selected outbound storage |
| `clash_api` | Clash-compatible REST API (enables selector control, dashboard) |
| `v2ray_api` | V2Ray-compatible gRPC API |

```json
{
  "experimental": {
    "cache_file": {},
    "clash_api": {
      "external_controller": "127.0.0.1:9090",
      "secret": ""
    },
    "v2ray_api": {}
  }
}
```
