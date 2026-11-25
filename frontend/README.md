# NetNova dashboard frontend

React, TypeScript and Vite frontend for the read-only AIORI-3 PS-020 SRv6 API. All dashboard data comes from the FastAPI backend; the frontend does not fall back to the older static benchmark/M2 copies when the API is unavailable.

## Run locally

Requires Node.js 18 or newer. Start the backend first (see `../backend/README.md`), then:

```bash
npm ci
npm run dev
```

Open `http://localhost:5173`. The development server is configured for VM/host access. Set `VITE_API_BASE_URL` in `.env.local` if the API is not at `http://localhost:8000`.

## Commands

```bash
npm test          # Dashboard/API integration and page navigation tests
npm run typecheck # TypeScript validation
npm run build     # Production output in dist/
npm run preview   # Preview the production build
```

The app loads `/api/overview`, `/api/topology`, `/api/routing-modes`, `/api/steering`, `/api/benchmarks`, `/api/failover`, `/api/logs`, `/api/health` and `/api/config`. It only sends GET requests. On connection failure it shows an error and unavailable states, rather than presenting stale results as current.

When the backend has `AIORI_LIVE_MONITORING=true`, the dashboard also polls `/api/live/status` every 10 seconds. It shows current Linux namespace/interface/route state and one ICMPv6 reachability/RTT probe separately from historical experiment data. Live monitoring requires the backend to run on the Linux host that owns the namespaces.
