import uuid
from datetime import datetime
from typing import Any, Literal, Union

from pydantic import BaseModel, ConfigDict, Field
from pydantic.fields import AliasChoices


class MatchRule(BaseModel):
    pattern: str | None = None
    proxy_type: list[str] = []
    regex: bool = False
    match_case: bool = False
    match_whole_word: bool = False


class StaticGroupConfig(BaseModel):
    tag: str
    type: Literal["selector", "urltest"] = "selector"
    include: MatchRule | None = None
    exclude: MatchRule | None = None
    imports: list[str] = Field(default=[], validation_alias=AliasChoices("imports", "subscriptions"))


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


GroupConfig = Union[AutoRegionGroupConfig, StaticGroupConfig]


class SubscriptionConfig(BaseModel):
    url: str
    enabled: bool = True
    user_agent: str | None = None


class SubscriberConfig(BaseModel):
    subscriptions: dict[str, SubscriptionConfig] = {}
    groups: list[GroupConfig] = []


class ConfigData(BaseModel):
    subscriber: SubscriberConfig = SubscriberConfig()
    config_template: str | dict[str, Any] | None = None


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
