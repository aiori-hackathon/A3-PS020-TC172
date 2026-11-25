"""AIORI-3 SRv6 dashboard backend - read-only.

Reads recorded experiment files and repository scripts. It never executes scripts, never
touches namespaces/routes/interfaces, and exposes no write or command endpoints.
"""
from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import API_VERSION, SERVICE_NAME, load_settings
from .routes import benchmarks, failover, health, live, logs, overview, routing, system, topology

log = logging.getLogger("aiori3")

settings = load_settings()
app = FastAPI(
    title="AIORI-3 SRv6 Dashboard API",
    version=API_VERSION,
    description="Read-only API over recorded SRv6 results with optional live namespace/interface status and a single ICMPv6 probe.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=False,
    allow_methods=["GET", "HEAD", "OPTIONS"],
    allow_headers=["Accept", "Content-Type"],
)

for module in (health, overview, topology, routing, benchmarks, failover, logs, system, live):
    app.include_router(module.router, prefix="/api")


@app.get("/", include_in_schema=False)
def root() -> dict[str, str]:
    return {"service": SERVICE_NAME, "version": API_VERSION, "docs": "/docs", "health": "/api/health"}


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception) -> JSONResponse:
    log.exception("Unhandled error: %s", exc)
    # No traceback, paths or internals in the response.
    return JSONResponse(status_code=500, content={"detail": "Internal error while reading experiment data."})
