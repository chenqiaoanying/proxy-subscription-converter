from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from api.database import engine, init_db
from api.routers import configs, generate


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    if engine is not None and str(engine.url).startswith("sqlite"):
        await init_db()
    yield


app = FastAPI(title="proxy-subscribe-converter", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(configs.router, prefix="/api")
app.include_router(generate.router, prefix="/api")

# Mangum wraps the ASGI app for Vercel's Lambda-compatible Python runtime
handler = Mangum(app, lifespan="off")
