import uuid
from datetime import datetime
from typing import Annotated, Any, Literal, Union

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.fields import AliasChoices


class MatchRule(BaseModel):
    pattern: str | None = None
    proxy_type: list[str] = []
    regex: bool = False
    match_case: bool = False
    match_whole_word: bool = False


class UrlTestOptions(BaseModel):
    url: str | None = None
    interval: str | None = None
    tolerance: int | None = None
    idle_timeout: str | None = None
    interrupt_exist_connections: bool | None = None


class StaticGroupConfig(BaseModel):
    tag: str
    type: Literal["selector", "urltest"] = "selector"
    include: MatchRule | None = None
    exclude: MatchRule | None = None
    imports: list[str] = Field(default=[], validation_alias=AliasChoices("imports", "subscriptions"))
    urltest_options: UrlTestOptions | None = None


class AutoRegionGroupConfig(BaseModel):
    group_tag: str
    type: Literal["auto_region"]
    group_type: Literal["selector", "urltest"] = "selector"
    sub_group_tag: str
    sub_group_type: Literal["selector", "urltest"] = "urltest"
    imports: list[str] = Field(default=[], validation_alias=AliasChoices("imports", "subscriptions"))
    regions: list[str] | Literal["auto"] = "auto"
    others_tag: str = "Others"
    region_map: dict[str, str] = {}
    use_emoji: bool = False
    include: MatchRule | None = None
    exclude: MatchRule | None = None
    group_urltest_options: UrlTestOptions | None = None
    sub_group_urltest_options: UrlTestOptions | None = None


GroupConfig = Union[AutoRegionGroupConfig, StaticGroupConfig]


class SubscriptionConfig(BaseModel):
    url: str
    enabled: bool = True
    user_agent: str | None = None


class SubscriberConfig(BaseModel):
    subscriptions: dict[str, SubscriptionConfig] = {}
    groups: list[GroupConfig] = []


TargetFormat = Literal["sing-box", "clash"]


class UrlTemplate(BaseModel):
    type: Literal["url"] = "url"
    value: str = ""


class ObjectTemplate(BaseModel):
    type: Literal["object"] = "object"
    value: dict[str, Any] = Field(default_factory=dict)


class InlineTemplate(BaseModel):
    type: Literal["inline"] = "inline"
    value: str = ""


TemplateSource = Annotated[
    Union[UrlTemplate, ObjectTemplate, InlineTemplate],
    Field(discriminator="type"),
]


class ConfigData(BaseModel):
    subscriber: SubscriberConfig = SubscriberConfig()
    config_template: dict[TargetFormat, TemplateSource | None] = Field(
        default_factory=dict
    )

    @model_validator(mode="before")
    @classmethod
    def _migrate_legacy_template(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        tpl = data.get("config_template")
        if not isinstance(tpl, dict):
            return data
        migrated: dict[str, Any] = {}
        for fmt, val in tpl.items():
            if val is None:
                migrated[fmt] = None
            elif isinstance(val, dict) and "type" in val and val.get("type") in ("url", "object", "inline"):
                migrated[fmt] = val
            elif isinstance(val, dict):
                migrated[fmt] = {"type": "object", "value": val}
            elif isinstance(val, str):
                migrated[fmt] = {"type": "url", "value": val}
            else:
                migrated[fmt] = None
        data["config_template"] = migrated
        return data


class ConfigCreate(BaseModel):
    name: str
    data: ConfigData = ConfigData()


class ConfigUpdate(BaseModel):
    name: str | None = None
    data: ConfigData | None = None


class ConfigListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    created_at: datetime
    updated_at: datetime


class ConfigOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    data: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class SubscriptionPreviewRequest(BaseModel):
    url: str
    user_agent: str | None = None


class ProxyPreview(BaseModel):
    tag: str
    type: str


class SubscriptionUserInfo(BaseModel):
    upload: int = 0
    download: int = 0
    total: int = 0
    expire: int | None = None  # Unix timestamp in seconds


class SubscriptionPreviewResponse(BaseModel):
    proxies: list[ProxyPreview]
    userinfo: SubscriptionUserInfo | None = None
