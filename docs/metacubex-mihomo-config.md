# MetaCubeX / Mihomo Configuration Reference

> Source: https://wiki.metacubex.one/config  
> Fetched: 2026-04-20

---

## Table of Contents

1. [General / Global Settings](#general--global-settings)
2. [DNS](#dns)
3. [Domain Sniffer](#domain-sniffer)
4. [Inbound (Listeners)](#inbound-listeners)
5. [TUN](#tun)
6. [Proxies (Outbound)](#proxies-outbound)
7. [Proxy Groups](#proxy-groups)
8. [Proxy Providers](#proxy-providers)
9. [Rules](#rules)
10. [Rule Providers](#rule-providers)

---

## General / Global Settings

Source: https://wiki.metacubex.one/config/general

### Network Access

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `allow-lan` | bool | `false` | Allow LAN clients to use the proxy ports |
| `bind-address` | string | `*` | IP address to bind to (`*` = all interfaces) |
| `lan-allowed-ips` | list | — | Whitelist of IP ranges allowed to connect |
| `lan-disallowed-ips` | list | — | Blacklist of IP ranges denied access |

### Authentication

| Option | Description |
|--------|-------------|
| `authentication` | List of `user:pass` credentials for HTTP(S)/SOCKS/mixed ports |
| `skip-auth-prefixes` | IP ranges that bypass authentication checks |

### Operation Mode

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mode` | enum | `rule` | `rule` / `global` / `direct` |
| `log-level` | enum | `info` | `silent` / `error` / `warning` / `info` / `debug` |
| `find-process-mode` | enum | — | Controls process matching behavior |
| `ipv6` | bool | `true` | Enable IPv6 support |

### Performance

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `unified-delay` | bool | `false` | Calculate RTT to remove connection overhead differences |
| `tcp-concurrent` | bool | `false` | Try all resolved IPs concurrently |
| `keep-alive-interval` | int | `15` | TCP keepalive interval in seconds |

### API & Dashboard

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `external-controller` | string | `127.0.0.1:9090` | RESTful API listen address |
| `external-ui` | string | — | Path to web dashboard static files |
| `secret` | string | — | API access token |

### GEO Data

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `geodata-mode` | bool | `false` | `false` = MMDB format, `true` = DAT format |
| `geodata-loader` | string | `memconservative` | GEO file loading strategy |
| `geo-auto-update` | bool | `false` | Auto-update GEO files |
| `geo-update-interval` | int | — | Update interval in hours |
| `geox-url` | map | — | Custom download URLs for `geoip`, `geosite`, `mmdb`, `asn` |

### Miscellaneous

| Option | Type | Description |
|--------|------|-------------|
| `interface-name` | string | Bind outbound connections to a specific network interface |
| `routing-mark` | int | Linux fwmark for outbound traffic |
| `global-ua` | string | Custom User-Agent for GEO/provider resource downloads |
| `etag-support` | bool | Enable ETag caching for downloads (default: `true`) |

---

## DNS

Source: https://wiki.metacubex.one/config/dns

### Core Settings

```yaml
dns:
  enable: true
  cache-algorithm: lru          # lru (default) or arc
  prefer-h3: false              # prefer HTTP/3 for DoH
  listen: 0.0.0.0:53
  ipv6: true
```

### Enhanced Mode

| Option | Values | Description |
|--------|--------|-------------|
| `enhanced-mode` | `fake-ip` / `redir-host` | How DNS responses are handled |
| `fake-ip-range` | CIDR | IPv4 pool for fake-ip (e.g. `198.18.0.1/16`) |
| `fake-ipv6-range` | CIDR | IPv6 pool for fake-ip |
| `fake-ip-filter` | list | Domains excluded from fake-ip assignment |
| `fake-ip-filter-mode` | `blacklist` / `whitelist` / `rule` | Filtering strategy |

### DNS Servers

| Option | Description |
|--------|-------------|
| `default-nameserver` | IP-only resolvers for bootstrapping DNS server domains |
| `nameserver` | Primary resolvers for standard queries |
| `fallback` | Overseas DNS for pollution detection and validation |
| `proxy-server-nameserver` | Resolves proxy node domains only |
| `direct-nameserver` | Resolves DIRECT-policy domains |
| `nameserver-policy` | Domain-specific resolver routing (supports wildcards and geosite refs) |

### Fallback Filtering

Controls how DNS pollution is detected and routed to `fallback` servers:

| Option | Description |
|--------|-------------|
| `fallback-filter.geoip` | Use GeoIP to detect polluted responses |
| `fallback-filter.geoip-code` | Country code to treat as polluted (e.g. `CN`) |
| `fallback-filter.geosite` | GeoSite categories to always use fallback |
| `fallback-filter.ipcidr` | IP ranges considered polluted |
| `fallback-filter.domain` | Explicit domain list to always use fallback |

### Advanced Parameters (via `#` separator)

Appended to individual nameserver URLs:

- `proxy=<name>` — route DNS queries through a proxy
- `ecs=<cidr>` — EDNS Client Subnet
- `skip-cert-verify=true` — disable TLS certificate verification
- `disable-qtype-N` — filter out specific query types

---

## Domain Sniffer

Source: https://wiki.metacubex.one/config/sniff

Detects domain names from raw traffic (useful when DNS is unreliable).

```yaml
sniffer:
  enable: true
  force-dns-mapping: true    # sniff redir-host traffic
  parse-pure-ip: true        # sniff IP-only traffic without domain
  override-destination: true # replace destination with sniffed domain

  sniff:
    HTTP:
      ports: [80, 8080-8880]
      override-destination: false
    TLS:
      ports: [443, 8443]
    QUIC:
      ports: [443, 8443]

  force-domain:
    - "+.example.com"

  skip-domain:
    - "Mijia Cloud"
    - "+.apple.com"

  skip-src-address:
    - 192.168.0.3/32

  skip-dst-address:
    - 192.168.0.3/32
```

---

## Inbound (Listeners)

Source: https://wiki.metacubex.one/config/inbound

### LAN Inbound (unencrypted local traffic)

Supported types: `socks` / `http` / `mixed` / `redirect` / `tproxy` / `tunnel` / `tun`

Common fields:

| Field | Description |
|-------|-------------|
| `name` | Listener identifier |
| `port` | Listening port |
| `listen` | Bind address (default: `0.0.0.0`) |
| `udp` | Enable UDP (default: `true`) |
| `rule` | Optional sub-rule set name |
| `proxy` | Route all traffic directly to this proxy/group |

### Internet Inbound (encrypted)

Supported types: **Shadowsocks**, **VMess**, **TUIC**

- Shadowsocks: requires `password` and `cipher`
- VMess: requires user credentials and `uuid`
- TUIC: requires token or user auth, certificate/key pairs, congestion control, timeouts

### Legacy Entry Points

Supports direct protocol URLs (`ss://`, `vmess://`) as shorthand configuration.

---

## TUN

Source: https://wiki.metacubex.one/config/inbound/tun

Routes system-level traffic through mihomo.

```yaml
tun:
  enable: true
  stack: mixed         # system | gvisor | mixed
  device: utun0        # interface name (macOS must use utun prefix)
  auto-route: true     # auto-add routes for global traffic
  auto-redirect: false # Linux only: iptables/nftables TCP redirect
  dns-hijack:
    - any:53
  strict-route: true   # prevent address leaks
  mtu: 9000
  gso: false           # Generic Segmentation Offload (Linux)
  gso-max-size: 65536
  udp-timeout: 300     # NAT session timeout in seconds
```

### Stack Comparison

| Stack | Description |
|-------|-------------|
| `system` | OS kernel stack — most stable, lowest resource usage |
| `gvisor` | User-space implementation — better isolation |
| `mixed` | System TCP + gvisor UDP — balanced performance |

### Advanced

- **Route filtering**: include/exclude specific addresses, address sets, or interfaces
- **UID / Android controls**: restrict routing by user ID or app package (Linux/Android)
- **iproute2 customization**: configure routing table and rule indices

---

## Proxies (Outbound)

Source: https://wiki.metacubex.one/config/proxies

### Universal Fields

All proxy types share these fields:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | string | — | Unique proxy identifier |
| `type` | string | — | Protocol: `ss`, `vmess`, `vless`, `trojan`, `hysteria`, `tuic`, `wireguard`, `ssh`, etc. |
| `server` | string | — | Host address (domain or IP) |
| `port` | int | — | Connection port |
| `ip-version` | enum | `dual` | `dual` / `ipv4` / `ipv6` / `ipv4-prefer` / `ipv6-prefer` |
| `udp` | bool | `false` | Enable UDP (auto-enabled for UDP-based protocols) |
| `interface-name` | string | — | Bind to a specific network interface |
| `routing-mark` | int | — | Linux fwmark |
| `tfo` | bool | `false` | TCP Fast Open |
| `mptcp` | bool | `false` | Multi-Path TCP |
| `dialer-proxy` | string | — | Route this proxy's traffic through another proxy/group |

### Multiplexing (smux)

```yaml
smux:
  enabled: true
  protocol: smux       # smux | yamux | h2mux
  max-connections: 4
  min-streams: 4
  max-streams: 0       # 0 = unlimited
  padding: false
  statistic: false
  only-tcp: false
  brutal-opts:
    enabled: false
    up: 50             # Mbps
    down: 100          # Mbps
```

### Supported Protocol Types

`ss` (Shadowsocks), `vmess`, `vless`, `trojan`, `hysteria`, `hysteria2`, `tuic`, `wireguard`, `ssh`, `http`, `socks5`, `snell`, and more.

---

## Proxy Groups

Source: https://wiki.metacubex.one/config/proxy-groups

### Core Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Policy group identifier (quote if contains special chars) |
| `type` | enum | `select` / `url-test` / `fallback` / `load-balance` / `relay` |
| `proxies` | list | Referenced proxy names or other group names |
| `use` | list | Proxy provider names to include |
| `include-all` | bool | Include all proxies and providers (sorted by name) |
| `include-all-proxies` | bool | Include only inline proxies |
| `include-all-providers` | bool | Include all proxy providers |

### Health Check

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `url` | string | — | Test endpoint URL |
| `interval` | int | — | Check interval in seconds (`0` = disabled) |
| `timeout` | int | — | Timeout in milliseconds |
| `lazy` | bool | `true` | Skip tests when group is not active |
| `max-failed-times` | int | `5` | Force re-check after N consecutive failures |
| `expected-status` | string | — | Accepted HTTP codes, e.g. `"200/302/400-503"` |

### Filtering

| Field | Description |
|-------|-------------|
| `filter` | Include nodes matching keyword or regex |
| `exclude-filter` | Exclude nodes matching keyword or regex |
| `exclude-type` | Exclude by protocol type, e.g. `"Shadowsocks\|Http"` |

### Display / Advanced

| Field | Description |
|-------|-------------|
| `disable-udp` | Block UDP for this group |
| `hidden` | Hide group from API responses |
| `icon` | Icon identifier for dashboard |

---

## Proxy Providers

Source: https://wiki.metacubex.one/config/proxy-providers

Centrally manage proxy node lists from remote or local sources.

### Core Fields

| Field | Required | Description |
|-------|----------|-------------|
| `type` | Yes | `http` / `file` / `inline` |
| `url` | http only | Remote subscription URL |
| `path` | No | Local storage path (defaults to MD5 hash of URL) |
| `interval` | No | Update interval in seconds |
| `proxy` | No | Proxy to use for downloading (e.g. `DIRECT`) |
| `size-limit` | No | Max file size in bytes (`0` = unlimited) |
| `header` | No | Custom HTTP headers (e.g. `User-Agent`, `Authorization`) |

### Health Check

```yaml
health-check:
  enable: true
  url: https://www.gstatic.com/generate_204
  interval: 300
  timeout: 5000
  lazy: true
  expected-status: "204"
```

### Override Options

Modify node properties after loading:

| Option | Description |
|--------|-------------|
| `additional-prefix` | Prepend text to all node names |
| `additional-suffix` | Append text to all node names |
| `proxy-name` | Regex-based name substitution rules |
| Other fields | TFO, MPTCP, UDP, certificate settings, routing marks, IP version |

### Filtering

| Field | Description |
|-------|-------------|
| `filter` | Include nodes matching keyword or regex |
| `exclude-filter` | Exclude nodes matching keyword or regex |
| `exclude-type` | Exclude by protocol type |

### Inline Type

The `inline` type embeds node definitions directly in the config. Also serves as a fallback payload if HTTP/file parsing fails.

---

## Rules

Source: https://wiki.metacubex.one/config/rules

Rules are evaluated **top-to-bottom**. If a proxy lacks required capability (e.g., UDP on a non-UDP proxy), matching continues down.

### Domain Rules

| Rule | Description |
|------|-------------|
| `DOMAIN` | Exact domain match |
| `DOMAIN-SUFFIX` | Matches domain and all subdomains |
| `DOMAIN-KEYWORD` | Substring match in domain |
| `DOMAIN-WILDCARD` | Wildcard match (`*`, `?`) |
| `DOMAIN-REGEX` | Regex match |
| `GEOSITE` | GeoSite category match |

### IP Rules

| Rule | Description |
|------|-------------|
| `IP-CIDR` | IPv4 CIDR range |
| `IP-CIDR6` | IPv6 CIDR range |
| `IP-SUFFIX` | IP suffix match |
| `IP-ASN` | Autonomous System Number |
| `GEOIP` | GeoIP country code |

### Source IP Rules

`SRC-GEOIP`, `SRC-IP-ASN`, `SRC-IP-CIDR`, `SRC-IP-SUFFIX`

### Port / Protocol Rules

| Rule | Description |
|------|-------------|
| `DST-PORT` | Destination port (ranges supported) |
| `SRC-PORT` | Source port |
| `IN-PORT` | Inbound listener port |
| `NETWORK` | `TCP` or `UDP` |
| `DSCP` | DSCP traffic class |

### Inbound Rules

`IN-TYPE`, `IN-USER`, `IN-NAME`

### Process Rules

`PROCESS-NAME`, `PROCESS-PATH`, `PROCESS-PATH-WILDCARD`, `PROCESS-PATH-REGEX`, `UID`

### Special Rules

| Rule | Description |
|------|-------------|
| `RULE-SET` | Reference an external rule provider |
| `AND` | Logical AND of sub-conditions |
| `OR` | Logical OR of sub-conditions |
| `NOT` | Logical NOT of a condition |
| `SUB-RULE` | Delegate to a named sub-rule set |
| `MATCH` | Catch-all (always matches) |

### Parameters

| Parameter | Description |
|-----------|-------------|
| `no-resolve` | Skip DNS resolution for IP rules when matching domains |
| `src` | Match source IP instead of destination (for IP-based rules) |

### Logical Rule Example

```yaml
rules:
  - AND,((NETWORK,UDP),(DST-PORT,443)),REJECT
  - OR,((DOMAIN-SUFFIX,google.com),(DOMAIN-SUFFIX,googleapis.com)),Proxy
  - MATCH,DIRECT
```

---

## Rule Providers

Source: https://wiki.metacubex.one/config/rule-providers

Load rule lists from remote or local sources.

### Configuration

```yaml
rule-providers:
  my-reject-list:
    type: http
    url: "https://example.com/reject.yaml"
    path: ./ruleset/reject.yaml
    interval: 86400
    proxy: DIRECT
    behavior: domain       # domain | ipcidr | classical
    format: yaml           # yaml | text | mrs
    size-limit: 0
    header:
      User-Agent: ["clash.meta"]
```

### Key Fields

| Field | Required | Description |
|-------|----------|-------------|
| `type` | Yes | `http` / `file` / `inline` |
| `behavior` | Yes | `domain` / `ipcidr` / `classical` |
| `format` | No | `yaml` (default) / `text` / `mrs` |
| `url` | http only | Remote endpoint |
| `path` | No | Local storage path (restricted to HomeDir) |
| `interval` | No | Update interval in seconds |
| `proxy` | No | Proxy to use for download |
| `size-limit` | No | Max size in bytes (`0` = unlimited) |
| `header` | No | Custom HTTP headers |
| `payload` | inline only | Inline rule content |

> **Note**: `mrs` format only supports `domain` and `ipcidr` behaviors.

### Usage in Rules

```yaml
rules:
  - RULE-SET,my-reject-list,REJECT
```
