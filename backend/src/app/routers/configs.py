import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.database import get_db
from src.app.models import Config
from src.app.schemas import ConfigCreate, ConfigListItem, ConfigOut, ConfigUpdate

router = APIRouter()


@router.get("/configs", response_model=list[ConfigListItem])
async def list_configs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Config).order_by(Config.created_at.desc()))
    return result.scalars().all()


@router.post("/configs", response_model=ConfigOut, status_code=201)
async def create_config(body: ConfigCreate, db: AsyncSession = Depends(get_db)):
    config = Config(name=body.name, data=body.data.model_dump())
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return config


@router.get("/configs/{config_id}", response_model=ConfigOut)
async def get_config(config_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    config = await db.get(Config, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    return config


@router.put("/configs/{config_id}", response_model=ConfigOut)
async def update_config(
    config_id: uuid.UUID, body: ConfigUpdate, db: AsyncSession = Depends(get_db)
):
    config = await db.get(Config, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    if body.name is not None:
        config.name = body.name
    if body.data is not None:
        config.data = body.data.model_dump()
    config.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(config)
    return config


@router.delete("/configs/{config_id}", status_code=204)
async def delete_config(config_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    config = await db.get(Config, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    await db.delete(config)
    await db.commit()
