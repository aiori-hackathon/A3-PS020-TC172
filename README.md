# NetNova · AIORI-3 PS-020 SRv6 Dashboard

NetNova's AIORI-3 project demonstrates IPv6 Segment Routing (SRv6) path steering and controlled failure recovery in a Linux network-namespace lab. The web dashboard presents the repository's recorded experiment evidence and configuration through a read-only FastAPI service.

## Architecture

```text
React + TypeScript + Vite (5173)
        │ GET /api/*
        ▼
FastAPI + Pydantic (8000)
        ├── reads src/results (CSV, TXT, Markdown, logs)
        ├── parses src/scripts (topology, SIDs and P1/P2 policies as text)
        └── optional /api/live/status reads Linux namespaces and probes ICMPv6
```

The backend never executes Linux experiment scripts, changes routes/interfaces, triggers failures, or writes experiment files. Optional live monitoring (disabled by default) reads namespace interface/route state and sends one ICMPv6 probe every 10 seconds from `s` to the configured destination. Live state is separate from historical benchmark and recovery evidence.

## Technology stack

- Frontend: React 18, TypeScript, Vite, Recharts, Lucide, Vitest and Testing Library.
- Backend: Python 3.10+, FastAPI, Pydantic 2, Uvicorn and pytest.
- Experiment lab: Linux network namespaces, IPv6, SRv6 (`seg6`), FRRouting OSPFv3, shell scripts and recorded CSV/text/log evidence.

## Project layout

```text
backend/                 FastAPI app, configuration, schemas, routes, services and tests
frontend/                React dashboard, Vite config, public assets and frontend tests
src/configs/             Linux/FRR configuration files
src/scripts/              Topology, routing, SID and experiment scripts (never run by API)
src/results/              Original recorded experiment datasets and analysis
evidence/                 Project screenshots and supporting evidence
*.pdf                     Hackathon project and implementation documents
```

## Quick start

### Docker deployment

Docker runs the dashboard frontend and read-only FastAPI evidence API as two services. Nginx serves the built React app on port `8080` and proxies `/api/*` to FastAPI over the private Compose network. The backend reads the included `src/results` and `src/scripts` trees. Live Linux namespace monitoring is disabled in this deployment; the SRv6 lab itself is not containerized.

#### Prerequisites

- Docker Desktop for Windows, with the WSL 2 backend enabled, or Docker Engine with the Compose plugin on Linux/macOS.
- On Windows, install Docker Desktop from [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/), start it, and wait until it reports that the engine is running.
- Verify from PowerShell or a terminal with `docker --version` and `docker compose version`. If either command fails, finish installing or starting Docker Desktop and open a new terminal.

#### Start the dashboard

Run these commands from the project root:

```bash
docker compose up --build
```

Open [http://localhost:8080](http://localhost:8080). Refreshing a dashboard route directly is supported by the Nginx SPA fallback. Compose waits for the backend health check before starting the frontend.

To run in the background:

```bash
docker compose up -d --build
```

#### Logs, status, rebuild and shutdown

```bash
docker compose logs
docker compose logs frontend
docker compose logs backend
docker compose ps
docker compose build --no-cache
docker compose up -d
docker compose down
```

The browser only needs port `8080`; the backend is not published on the host. To check backend health from the host, use `docker compose exec backend python -c "from urllib.request import urlopen; print(urlopen('http://127.0.0.1:8000/api/health').read().decode())"`.

#### Troubleshooting

- If Docker commands report that the daemon cannot be reached, start Docker Desktop and wait for the engine to finish starting.
- If port `8080` is already in use, stop the other service using it or change the host side of the `8080:80` mapping in `docker-compose.yml` and use that port in the browser.
- If a build fails after dependency or source changes, run `docker compose build --no-cache` and then `docker compose up`.
- If the frontend reports a backend connection problem, check `docker compose ps` and `docker compose logs backend`; the backend must pass its `/api/health` check before the frontend starts.

#### Services and data

| Service | Purpose | Container port | Host access |
|---|---|---:|---|
| `frontend` | Nginx static React app and `/api/*` reverse proxy | 80 | `http://localhost:8080` |
| `backend` | FastAPI read-only evidence API | 8000 | Internal Compose network only |

The Docker backend uses `/app/src/results` and `/app/src/scripts`, matching the existing repository-relative data layout. It does not execute the scripts or modify evidence. There are no data bind mounts, so the image runs with the project files included at build time. To include later evidence changes, rebuild with `docker compose up --build`.

Use two terminals from the project root. Python and Node dependencies are installed separately.

### Backend

```bash
python -m venv .venv
# Linux/macOS:
source .venv/bin/activate
# Windows PowerShell:
# .venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
# Optional, on Ubuntu/Linux only: enable namespace and ICMPv6 status polling.
# PowerShell: $env:AIORI_LIVE_MONITORING = 'true'
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

Check `http://localhost:8000/api/health`; interactive API docs are at `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend
npm ci
```

Local Vite development defaults to `http://localhost:8000` for the API. To point at another host, copy `.env.example` to `.env.local` (PowerShell: `Copy-Item .env.example .env.local`) and set `VITE_API_BASE_URL`, then run:

```bash
npm run dev
```

Open `http://localhost:5173`. Vite's dev server listens on all interfaces for Linux VM demos; the default API URL is `http://localhost:8000`. Start the backend first. The dashboard shows connection and missing-data errors if the backend cannot be reached; it does not silently replace API results with the older bundled demo data.

To build and serve the production frontend:

```bash
npm run build
npm run preview -- --host 127.0.0.1
```

## Configuration

### Backend environment

| Variable | Default | Description |
|---|---|---|
| `AIORI_DATA_DIR` | `<project>/src/results` | Root of recorded result files. |
| `AIORI_SCRIPTS_DIR` | `<AIORI_DATA_DIR parent>/scripts` | Root of Linux scripts parsed as text. |
| `AIORI_CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated allowed frontend origins. |
| `AIORI_LIVE_MONITORING` | `false` | Enable live Linux namespace/interface/route checks and one ICMPv6 probe per 10-second poll. Requires Linux, `iproute2`, `iputils-ping`, and permission to inspect the named namespaces. |

Set custom paths with environment variables; no machine-specific path is compiled into the code. Restart the backend after changing configuration. For example, PowerShell:

```powershell
$env:AIORI_DATA_DIR = 'D:\NetNova\src\results'
$env:AIORI_SCRIPTS_DIR = 'D:\NetNova\src\scripts'
$env:AIORI_CORS_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173'
$env:AIORI_LIVE_MONITORING = 'true'
```

### Frontend environment

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000` | FastAPI base URL, without a trailing slash. |
| `VITE_API_TIMEOUT_MS` | `8000` | Request timeout in milliseconds. |

For an Ubuntu VM reached from Windows, set the frontend API URL to the host-forwarded or VM-reachable address and add the frontend origin to `AIORI_CORS_ORIGINS`.

## API endpoints

All dashboard routes are GET-only.

| Endpoint | Data |
|---|---|
| `/api/health` | Backend/data availability and read-only status. |
| `/api/config` | Effective API configuration and route list. |
| `/api/live/status` | Optional live namespace/interface/route status and one-packet ICMPv6 reachability/RTT probe. Disabled by default. |
| `/api/overview` | Project overview, M0/M1-P1/M1-P2/M2 summaries and experiment dates. |
| `/api/topology` | Nodes, interfaces, links and configured P1/P2 paths. |
| `/api/routing-modes` | Mode configuration, measurements and paths. |
| `/api/steering` | SRv6 SIDs and segment lists. |
| `/api/benchmarks?include_trials=true` | Per-trial and aggregate M0/P1/P2 benchmark values and M0 comparisons. |
| `/api/failover` | M2 probe/failover/install/route-verification events, recorded ping evidence and supported timing intervals. |
| `/api/logs?limit=100&severity=&category=&kind=` | Historical experiment records/events and optional filters. |

Responses report source files, validation status, warnings and `live_telemetry: false`. API paths never run commands or modify the lab.

## Recorded datasets and limitations

The backend selects evidence identified by `src/results/RESULTS_INDEX.md` and the consolidated recovery report:

- M0 OSPFv3: `src/results/final/m0_benchmark_20261121.csv`, checked against `m0_analysis_20261121.txt` (30 trials; 30,000 packets; 0% loss; mean trial-average RTT about 0.02323 ms).
- M1-P1 primary: `src/results/recovery_20261122/p1_benchmark_revalidated.csv` (30 trials; 30,000 packets; 0% loss; mean trial-average RTT about 0.011333 ms).
- M1-P2 alternate: `src/results/recovery_20261122/p2_benchmark_revalidated.csv` (30 trials; 30,000 packets; 0% loss; mean trial-average RTT about 0.013600 ms).
- M2 controlled recovery: `src/results/recovery_20261122/M2_RECOVERY_SESSION.log` with report `M2_RECOVERY_REPORT.txt`. It records one controlled trial, three failed probes, P2 installation and route verification, 5/5 recovery packets and 0% loss; first failed probe to recovery success is 10.807 s from the event timestamps.

M0 is dated 2026-11-21 and P1/P2 are dated 2026-11-22. They are separate benchmark sessions, so cross-mode differences are descriptive rather than a synchronized comparison. October data and troubleshooting runs are retained and reported separately; failed/older results are not silently substituted. The M2 report contains approximate explanatory intervals; exact API intervals are calculated from the controller log timestamps. The log does not record a timezone. The emulated Linux VM and single recorded M2 trial limit generalization. There are no JSON experiment result files under `src/results`; a legacy M2 JSON copy under the frontend is not the authoritative latest evidence.

## Tests and build

From the project root:

```bash
python -m pip install -r backend/requirements-dev.txt
cd backend
python -m pytest -q
cd ../frontend
npm ci
npm test
npm run typecheck
npm run build
```

Backend tests use temporary copies of `src/` and verify actual dataset selection, parsing, missing/malformed data, M2 timing integrity, CORS, read-only methods, and disabled/mocked-live monitor behavior. Frontend tests exercise all eight dashboard pages against the current API response shapes and assert only GET requests are issued.

## Demo walkthrough

1. Start the backend, then start the Vite frontend.
2. Open the dashboard and confirm the API status indicator is connected.
3. Review Overview, Network Topology, Routing Modes and SRv6 Path Steering for recorded results and repository configuration.
4. Review Failover Monitoring for the single M2 trial, then Benchmark Analytics and Experiment Logs for historical values and sources.
5. Open Settings to see the active API/data paths and CORS origins.

Recorded benchmark and M2 results remain historical. If `AIORI_LIVE_MONITORING=true`, the dashboard separately polls current Linux namespace/interface/route state and sends one ICMPv6 probe from `s` to `d` every 10 seconds. The monitor never executes experiment scripts or changes network configuration. Run it only on the Linux host that owns the namespaces, with permission to inspect them; on other hosts it reports live status unavailable.
