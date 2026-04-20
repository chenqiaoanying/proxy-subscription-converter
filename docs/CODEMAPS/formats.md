# Format Support Layer Codemap

**Last Updated:** 2026-04-20
**Entry Points:** `backend/src/app/formats/__init__.py`

## Architecture

```
formats/__init__.py ─────┬──→ Registries: PARSERS[], EMITTERS{}, SUPPORTED_TARGETS
                         │
                         ├──→ base.py (Protocols, Exceptions)
                         ├──→ model.py (Unified Proxy discriminated union)
                         ├──→ common.py (Clash ↔ sing-box TLS/transport helpers)
                         ├──→ sing_box.py (SingBoxParser, SingBoxEmitter)
                         ├──→ clash.py (ClashParser, ClashEmitter)
                         └──→ detect.py (detect_source_format)

routers/generate.py ──────→ Uses: detect_source_format, PARSERS, EMITTERS, Proxy
schemas.py ────────────────→ Imports: (re-exports for typing)
```

## Key Modules

### `model.py` — Unified Proxy Model

**Purpose:** Define a canonical proxy type that both sing-box and Clash can round-trip through.

**Exports:**

| Name | Type | Purpose |
|---|---|---|
| `BaseProxy` | Pydantic `BaseModel` | Abstract base; all proxies inherit `name`, `server`, `port`, `type` |
| `ShadowsocksProxy` | Model | `type: "shadowsocks"`; `cipher`, `password` |
| `VmessProxy` | Model | `type: "vmess"`; `uuid`, `alterId`, `security`, `transport` |
| `VlessProxy` | Model | `type: "vless"`; `uuid`, `transport` |
| `TrojanProxy` | Model | `type: "trojan"`; `password`, `transport` |
| `Hysteria2Proxy` | Model | `type: "hysteria2"`; `password`, `obfs`, `obfs_password` |
| `TuicProxy` | Model | `type: "tuic"`; `token`, `congestion_control` |
| `WireguardProxy` | Model | `type: "wireguard"`; `private_key`, `peers`, `local_addresses` |
| `HttpProxy` | Model | `type: "http"`; `username`, `password` |
| `SocksProxy` | Model | `type: "socks5"`; `username`, `password` |
| `UnknownProxy` | Model | Fallback for unknown types; preserves raw `raw_data: dict` for round-tripping |
| `Proxy` | Discriminated Union | `ShadowsocksProxy \| VmessProxy \| ... \| UnknownProxy` (keyed by `type`) |
| `TlsConfig` | Model | Nested TLS options: `enabled`, `server_name`, `insecure`, `alpn`, `min_version` |
| `TransportConfig` | Model | Nested transport: `type` (http, ws, quic), protocol-specific fields |
| `ProxyGroup` | Model | Outbound group: `tag`, `type`, `proxies`, `urltest_options` |
| `UrlTestOpts` | Model | URL-test settings: `url`, `interval`, `tolerance`, `idle_timeout` |

**Key Design:**
- All proxy types share `name`, `server`, `port`, `type` on `BaseProxy`
- TLS/transport stored as nested objects (sing-box style) with helpers to flatten for Clash
- `UnknownProxy` stores raw dict to enable lossless same-format round-trips
- Pydantic discriminator on `type` field ensures proper model selection

### `base.py` — Protocols & Exceptions

**Exports:**

| Name | Kind | Purpose |
|---|---|---|
| `SubscriptionParser` | Protocol | `parse(text: str) -> list[Proxy]` — convert raw subscription to unified proxies |
| `TargetEmitter` | Protocol | `emit(proxies: list[Proxy], ...config...) -> bytes` — serialize to target format |
| `ParseError` | Exception | Raised when subscription parsing fails (malformed, corrupt) |
| `UnsupportedFormatError` | Exception | Raised when subscription format is unrecognized |

**Protocol Attributes:**

```python
class SubscriptionParser(Protocol):
    @staticmethod
    def parse(text: str) -> list[Proxy]: ...
    
    @classmethod
    def can_parse(cls, text: str) -> bool: ...  # Optional detection hint

class TargetEmitter(Protocol):
    format_name: str  # e.g., "sing-box", "clash"
    media_type: str   # e.g., "application/json", "application/yaml"
    
    @staticmethod
    def emit(proxies: list[Proxy], **kwargs) -> bytes: ...
```

### `sing_box.py` — Sing-box Format

**Classes:**

| Class | Type | Purpose |
|---|---|---|
| `SingBoxParser` | Implements `SubscriptionParser` | Parses `{"outbounds": [...]}` JSON; extracts `type`, `server`, `port`, and protocol-specific fields |
| `SingBoxEmitter` | Implements `TargetEmitter` | Serializes unified proxies back to sing-box JSON outbound format |

**Details:**
- Parser expects sing-box JSON with `outbounds` array
- Emitter returns `application/json` media type
- Round-trip: sing-box → Proxy[] → sing-box is lossless (via UnknownProxy fallback)
- Format name: `"sing-box"`

### `clash.py` — Clash (Mihomo) Format

**Classes:**

| Class | Type | Purpose |
|---|---|---|
| `ClashParser` | Implements `SubscriptionParser` | Parses Clash/YAML with `proxies:` array; maps `ss`→`shadowsocks`, `select`→`selector`, `url-test`→`urltest` |
| `ClashEmitter` | Implements `TargetEmitter` | Serializes unified proxies to Clash YAML (PyYAML); maps back to Clash field names |

**Details:**
- Parser reads YAML, accepts `proxies: [...]` array
- Maps Clash type names: `ss`, `vmess`, `vless`, `trojan`, `hysteria2`, `tuic`, `wireguard`, `http`, `socks5`
- Maps Clash group types: `select`→`selector`, `url-test`→`urltest`
- Time conversion: Clash `3m` → 180 seconds; on emit, converts back
- Emitter returns `application/yaml` media type
- Format name: `"clash"`
- Round-trip: Clash → Proxy[] → Clash is lossless (via UnknownProxy fallback)

### `common.py` — Format Helpers

**Purpose:** Convert between Clash's flat field model and sing-box's nested structures.

**Key Functions:**

| Function | Purpose |
|---|---|
| `tls_to_clash_fields(tls: TlsConfig) -> dict` | Flatten nested TLS to Clash style (`tls: true`, `servername: "..."`) |
| `clash_fields_to_tls(**fields) -> TlsConfig` | Convert flat Clash fields to nested TlsConfig |
| `transport_to_clash_fields(transport: TransportConfig) -> dict` | Flatten transport (e.g., `ws-opts`, `h2-opts`) |
| `clash_fields_to_transport(**fields) -> TransportConfig` | Reconstruct nested TransportConfig from flat fields |

**Why it matters:**
- Sing-box: `{tls: {enabled: true, server_name: "..."}, transport: {type: "ws", ...}}`
- Clash: `{tls: true, servername: "...", ws-opts: {...}}`
- Helpers bridge the gap during parse/emit

### `detect.py` — Format Auto-Detection

**Exports:**

| Function | Purpose |
|---|---|
| `detect_source_format(url: str, content_type: str, text: str) -> type[SubscriptionParser]` | Determine which parser to use |

**Detection Order:**
1. **URL suffix**: `.json` → `SingBoxParser`, `.yaml|.yml` → `ClashParser`
2. **Content-Type header**: `application/json` → sing-box, `application/yaml|text/yaml` → Clash
3. **Content sniff**: Try parsing as JSON (sing-box), else try YAML (Clash)
4. **Default**: If all fail, raise `UnsupportedFormatError`

**Example:**
```
http://example.com/subs/foo.yaml
  ↓ (URL check: .yaml)
  → ClashParser
  
http://example.com/api/proxies (no extension)
  ↓ (Content-Type: application/json)
  → SingBoxParser

http://example.com/config (generic URL)
  ↓ (Try JSON parse)
  → If succeeds: SingBoxParser
  ↓ (If JSON fails, try YAML)
  → If succeeds: ClashParser
  ↓ (If both fail)
  → UnsupportedFormatError
```

## Data Flow: Parse → Emit

```
Subscription URL
  ↓
detect_source_format(url, content_type, text)
  ↓
parser_cls = SingBoxParser | ClashParser
  ↓
parser_cls.parse(text) → list[Proxy]
  ↓ (in _run_generate)
[Apply filters, groups, region detection on Proxy objects]
  ↓
target_emitter = EMITTERS[target_format]
  ↓
target_emitter.emit(proxies, ...) → bytes
  ↓
Response (media_type: JSON | YAML)
```

## Registries (`__init__.py`)

**PARSERS** (list of parser classes):
```python
PARSERS: list[type[SubscriptionParser]] = [SingBoxParser, ClashParser]
```

**EMITTERS** (dict of format name → emitter class):
```python
EMITTERS: dict[str, type[TargetEmitter]] = {
    "sing-box": SingBoxEmitter,
    "clash": ClashEmitter,
}
```

**SUPPORTED_TARGETS** (tuple of format names):
```python
SUPPORTED_TARGETS: tuple[str, ...] = ("sing-box", "clash")
```

To add a new format (e.g., Quantumult):
1. Create `quantumult.py` with `QuantumultParser(SubscriptionParser)` and `QuantumultEmitter(TargetEmitter)`
2. Append `QuantumultParser` to `PARSERS`
3. Add `"quantumult": QuantumultEmitter` to `EMITTERS`
4. Import in `__init__.py`

## Dropped Proxies Tracking

When converting between formats:
- Some protocols may not be supported by the target (e.g., Clash may not support Wireguard)
- `UnknownProxy` is emitted as-is, but known proxy types that can't be converted are dropped
- The count is tracked and returned in the `X-Dropped-Proxies` response header

Example:
```
Original: [ShadowsocksProxy, WireguardProxy, VlessProxy]
Target: Clash (doesn't support Wireguard)
Result: [ShadowsocksProxy, VlessProxy] + header "X-Dropped-Proxies: 1"
```

## Dependencies

| Package | Purpose |
|---|---|
| `pydantic` | Model definition, validation, JSON serialization |
| `pyyaml` | YAML parsing/emission (Clash format) |

## Related Areas

- **[Backend Architecture](./backend.md)** — routers/generate.py uses formats module
- **[Frontend Architecture](./frontend.md)** — API client consumes JSON/YAML responses
- **[INDEX](./INDEX.md)** — Overview of all codemaps
