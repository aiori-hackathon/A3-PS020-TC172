# NetNova AIORI-3 PS-020 SRv6 API

FastAPI service for NetNova experiment evidence. It parses existing files under `src/results` and reads topology/route policy definitions under `src/scripts`. It never executes experiment scripts, changes routes/interfaces, injects failures, or writes experiment files. Optional live monitoring is disabled by default; when enabled on Linux it reads current namespace interfaces/routes and sends a single ICMPv6 probe every 10 seconds.

## Runtime and setup

Python 3.10 or newer is required. From the project root:

```bash
python -m venv .venv
source .venv/bin/activate       # Windows PowerShell: .venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
python -m pip install -r backend/requirements-dev.txt  # only needed for tests
```

Start the API from the project root so the default paths resolve to `src/results` and `src/scripts`:

```bash
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

Alternatively, run from `backend/` with the package import path set:

```bash
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The API is available at `http://localhost:8000`; interactive documentation is at `/docs` and OpenAPI JSON is at `/openapi.json`. To allow access from another host, use an appropriate bind address and explicitly configure CORS origins. Do not expose this development service publicly without deployment-level access controls.

## Environment configuration

| Variable | Default | Purpose |
|---|---|---|
| `AIORI_DATA_DIR` | `<project>/src/results` | Root directory for CSV, JSON, TXT and log evidence. |
| `AIORI_SCRIPTS_DIR` | `<AIORI_DATA_DIR parent>/scripts` | Root directory for shell scripts parsed as text. |
| `AIORI_CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated allowed frontend origins. |
| `AIORI_LIVE_MONITORING` | `true` | Read-only Linux namespace inspection and one ICMPv6 probe per polling interval are enabled by default. Set to `false` to disable. Requires Linux, `iproute2`, `iputils-ping`, and namespace access permissions. |

Example for an alternate results checkout:

```bash
export AIORI_DATA_DIR=/data/netnova/src/results
export AIORI_SCRIPTS_DIR=/data/netnova/src/scripts
export AIORI_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

PowerShell uses `$env:AIORI_DATA_DIR = 'D:\NetNova\src\results'` and the equivalent names for the other settings. No credentials or secrets are required.

## API endpoints

All dashboard API endpoints accept `GET` only. Write methods are not implemented.

| Endpoint | Purpose |
|---|---|
| `/api/health` | Service status, read-only flag, configured data directory readability and script-directory availability. |
| `/api/config` | Effective service configuration, allowed CORS origins and endpoint list. |
| `/api/live/status` | Optional current namespace/interface/route state and one ICMPv6 probe result; returns disabled/unavailable distinctly when not active. |
| `/api/overview` | Project overview, four routing/recovery modes, latest validated measurements and experiment dates. |
| `/api/routing-modes` | Routing mode summaries paired with configured P1/P2 paths and an interpretation note. |
| `/api/topology` | Nodes, interfaces, links, subnets, configured SIDs/paths and documented failure link. Node/link state remains `unknown`. |
| `/api/steering` | SRv6 segment identifiers and configured steering paths, parsed from scripts. |
| `/api/benchmarks?include_trials=true` | M0/P1/P2 validated trial data, aggregates, source/validation files and comparisons. Trial rows are optional. |
| `/api/failover` | M2 run events, probe counts, timestamps, route verification, ping evidence and supported timing intervals. |
| `/api/logs?limit=100&severity=&category=&kind=` | Historical experiment records and controller events with filters. Limit range: 1–500. |

Historical data endpoints include `data_source`, `generated_at`, and `warnings`. The live endpoint reports its own current status and uses `disabled`, `unavailable`, or `unknown` values where live access is not available, rather than substituting historical values.

## Dataset selection and interpretation

The latest benchmark response selects the validated files named in `src/results/RESULTS_INDEX.md` and `src/results/recovery_20261122/CONSOLIDATED_EXPERIMENT_REPORT.md`:

| Mode | Selected evidence | Validation evidence |
|---|---|---|
| M0 OSPFv3 | `final/m0_benchmark_20261121.csv` | `final/m0_analysis_20261121.txt` |
| M1-P1 primary | `recovery_20261122/p1_benchmark_revalidated.csv` | `recovery_20261122/CONSOLIDATED_EXPERIMENT_REPORT.md` |
| M1-P2 alternate | `recovery_20261122/p2_benchmark_revalidated.csv` | `recovery_20261122/CONSOLIDATED_EXPERIMENT_REPORT.md` |
| M2 controlled recovery | `recovery_20261122/M2_RECOVERY_SESSION.log` | `recovery_20261122/M2_RECOVERY_REPORT.txt` |

The selected M0 run is dated 2026-11-21; P1/P2 are dated 2026-11-22. They are distinct benchmark sessions. API cross-mode deltas are descriptive and are explicitly not a synchronized same-run comparison. October 2026 results are returned separately as `earlier_run`. Troubleshooting and failed datasets are not silently substituted.

The supplied `src/results` tree contains CSV, TXT, Markdown and controller log evidence, but no JSON experiment result files. A legacy JSON trial copy exists under the frontend's public data directory; it refers to an older M2 log and is not treated as the current authoritative experiment source.

`/api/live/status` is separate from recorded evidence and enabled by default. It works only on the Linux host that owns the namespaces; on Windows it reports unavailable. Set `AIORI_LIVE_MONITORING=false` to disable. It reads `ip netns`, per-namespace links and IPv6 routes, and sends exactly one ICMPv6 packet from namespace `s` to the configured destination per 10-second frontend poll. It never runs experiment scripts or changes routes/interfaces. Access can be unavailable without permission to enter namespaces or execute `ping`.

M2 is one controlled recovery session, not an average over trials. The log records first failed probe, failover start, P2 installation completion, route verification, recovery success and ping statistics. The API calculates intervals only where both source timestamps exist. The report's approximate timings are not used as exact values. Log timestamps have no recorded timezone and are returned as written. “Historical” means recorded experiment evidence, not current network state.

## Tests

From `backend/`:

```bash
python -m pytest -q
```

Tests copy the project `src/` tree into a temporary directory before changing fixtures. They cover latest validated benchmark selection and integrity, M2 event/timing parsing, topology/SID extraction, logs, missing and malformed inputs, CORS, disabled and mocked live monitoring, API error hygiene, and rejection of write methods.
