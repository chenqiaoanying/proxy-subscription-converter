import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict


class MatchRule(BaseModel):
    pattern: str | None = None
    proxy_type: list[str] = []
    regex: bool = False
    match_case: bool = False
    match_whole_word: bool = False


class FilterConfig(BaseModel):
    tag: str
    type: Literal["selector", "urltest"] = "selector"
    include: MatchRule | None = None
    exclude: MatchRule | None = None
    subscriptions: list[str] = []


class SubscriptionConfig(BaseModel):
    url: str
    tag: str | None = None
    enabled: bool = True
    user_agent: str | None = None


class SubscriberConfig(BaseModel):
    subscriptions: dict[str, SubscriptionConfig] = {}
    filters: list[FilterConfig] = []


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
