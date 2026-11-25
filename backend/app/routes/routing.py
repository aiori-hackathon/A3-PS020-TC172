from fastapi import APIRouter

from ..config import load_settings
from ..schemas import RoutingModesResponse, TopologyResponse
from ..services import overview as overview_service
from ..services import topology as topology_service

router = APIRouter()


@router.get("/routing-modes", response_model=RoutingModesResponse, summary="Configured routing modes and measured results")
def routing_modes() -> RoutingModesResponse:
    settings = load_settings()
    overview = overview_service.build(settings)
    topology = topology_service.build(settings)
    return RoutingModesResponse(
        data_source=overview.data_source,
        generated_at=overview.generated_at,
        warnings=list(dict.fromkeys([*overview.warnings, *topology.warnings])),
        modes=overview.modes,
        paths=topology.paths,
        interpretation_note=(
            "M0 benchmark is dated 2026-11-21; P1 and P2 benchmark datasets are dated 2026-11-22. "
            "They are separate sessions and their comparison is descriptive. Configured path details "
            "come from repository scripts; path reachability is not live telemetry."
        ),
    )


@router.get("/steering", response_model=TopologyResponse, summary="SRv6 SIDs and configured steering paths")
def steering() -> TopologyResponse:
    return topology_service.build(load_settings())
