from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.app.database import engine, init_db
from src.app.routers import generate
from src.app.routers import configs


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    if engine is not None and str(engine.url).startswith("sqlite"):
        await init_db()
    yield


app = FastAPI(title="proxy-subscription-converter", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(configs.router)
app.include_router(generate.router)
