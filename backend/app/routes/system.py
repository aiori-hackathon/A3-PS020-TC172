from fastapi import APIRouter

from ..config import API_VERSION, SERVICE_NAME, load_settings
from ..schemas import SystemConfigResponse

router = APIRouter()


@router.get("/config", response_model=SystemConfigResponse, summary="Effective read-only backend configuration")
def system_config() -> SystemConfigResponse:
    settings = load_settings()
    return SystemConfigResponse(
        service=SERVICE_NAME,
        version=API_VERSION,
        data_dir=str(settings.data_dir.expanduser()),
        scripts_dir=str(settings.scripts_dir.expanduser()),
        cors_origins=list(settings.cors_origins),
        live_telemetry=settings.live_monitoring_enabled,
        endpoints=[
            "/api/health", "/api/overview", "/api/topology", "/api/routing-modes",
            "/api/steering", "/api/benchmarks", "/api/failover", "/api/logs", "/api/config", "/api/live/status",
        ],
    )
