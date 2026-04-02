from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from api.routers import configs, generate

app = FastAPI(title="proxy-subscribe-converter")

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
