from fastapi import APIRouter

from ..config import load_settings
from ..schemas import LiveMonitoringResponse
from ..services import live_monitor

router = APIRouter()


@router.get("/live/status", response_model=LiveMonitoringResponse, summary="Optional read-only namespace and ICMP status")
def live_status() -> LiveMonitoringResponse:
    return live_monitor.build(load_settings())
