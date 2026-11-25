import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('recharts', async () => {
  const ReactModule = await import('react')
  const Box = ({ children }: { children?: React.ReactNode }) => ReactModule.createElement('div', null, children)
  const SvgBox = ({ children }: { children?: React.ReactNode }) => ReactModule.createElement('svg', null, children)
  const Shape = () => null
  return { ResponsiveContainer: Box, AreaChart: SvgBox, BarChart: SvgBox, LineChart: SvgBox, CartesianGrid: Shape, Tooltip: Shape, XAxis: Shape, YAxis: Shape, Area: Shape, Bar: Shape, Line: Shape, Cell: Shape }
})

const source = { kind: 'historical', live_telemetry: false, description: 'Recorded experiment results; not live telemetry.', files: ['src/results/final/m0_benchmark_20261121.csv'], missing_files: [], last_modified: null }
const modeStats = [
  { id: 'M0', mode: 'M0_OSPFv3', label: 'M0 · OSPFv3 baseline', run_date: '2026-11-21', trials: 30, transmitted: 30000, received: 30000, packets_lost: 0, packet_loss_percent: 0, mean_trial_avg_rtt_ms: .0232333333, median_trial_avg_rtt_ms: .021, max_rtt_ms: 2.578, mean_trial_duration_ms: 1013, trial_rows:[{trial:1,transmitted:1000,received:1000,packet_loss_percent:0,duration_ms:1013,min_rtt_ms:.004,avg_rtt_ms:.02,max_rtt_ms:.6,mdev_rtt_ms:.01}], source_file: 'src/results/final/m0_benchmark_20261121.csv' },
  { id: 'P1', mode: 'P1_SRv6', label: 'M1 · SRv6 primary path (P1)', run_date: '2026-11-22', trials: 30, transmitted: 30000, received: 30000, packets_lost: 0, packet_loss_percent: 0, mean_trial_avg_rtt_ms: .0113333333, median_trial_avg_rtt_ms: .011, max_rtt_ms: .448, mean_trial_duration_ms: 1004, trial_rows:[{trial:1,transmitted:1000,received:1000,packet_loss_percent:0,duration_ms:1004,min_rtt_ms:.003,avg_rtt_ms:.01,max_rtt_ms:.1,mdev_rtt_ms:.005}], source_file: 'src/results/recovery_20261122/p1_benchmark_revalidated.csv' },
  { id: 'P2', mode: 'P2_SRv6', label: 'M1 · SRv6 backup path (P2)', run_date: '2026-11-22', trials: 30, transmitted: 30000, received: 30000, packets_lost: 0, packet_loss_percent: 0, mean_trial_avg_rtt_ms: .0136, median_trial_avg_rtt_ms: .015, max_rtt_ms: .998, mean_trial_duration_ms: 1006, trial_rows:[{trial:1,transmitted:1000,received:1000,packet_loss_percent:0,duration_ms:1006,min_rtt_ms:.004,avg_rtt_ms:.012,max_rtt_ms:.2,mdev_rtt_ms:.006}], source_file: 'src/results/recovery_20261122/p2_benchmark_revalidated.csv' },
]
const paths = [
  { id: 'P1', role: 'primary', nodes: ['S', 'R1', 'R2', 'R5', 'D'], segments: ['fc00:0:2::1', 'fc00:0:5::d6'], link_ids: ['s-r1', 'r1-r2', 'r2-r5', 'r5-d'] },
  { id: 'P2', role: 'backup', nodes: ['S', 'R1', 'R3', 'R4', 'R5', 'D'], segments: ['fc00:0:3::1', 'fc00:0:4::1', 'fc00:0:5::d6'], link_ids: ['s-r1', 'r1-r3', 'r3-r4', 'r4-r5', 'r5-d'] },
]
const nodes = ['S','R1','R2','R3','R4','R5','D'].map((id) => ({ id, namespace: id.toLowerCase(), kind: id==='S'||id==='D'?'endpoint':'router', interfaces: [], sid: id==='R2'?'fc00:0:2::1':id==='R3'?'fc00:0:3::1':id==='R4'?'fc00:0:4::1':id==='R5'?'fc00:0:5::d6':null, sid_behavior: id==='R5'?'End.DT6':id.startsWith('R')&&id!=='R1'?'End':null, status: 'unknown' }))
const modeOverview = [
  { id:'M0', name:'OSPFv3 baseline', configured:'OSPFv3 routing', measured:'30,000 packets, 0% loss, mean trial RTT 0.02323 ms', source_files:[modeStats[0].source_file] },
  { id:'M1-P1', name:'SRv6 primary path (P1)', configured:'Segments via R2 then R5', measured:'30,000 packets, 0% loss, mean trial RTT 0.01133 ms', source_files:[modeStats[1].source_file] },
  { id:'M1-P2', name:'SRv6 backup path (P2)', configured:'Segments via R3, R4 then R5', measured:'30,000 packets, 0% loss, mean trial RTT 0.01360 ms', source_files:[modeStats[2].source_file] },
  { id:'M2', name:'Failure recovery', configured:'P2 after 3 failed probes', measured:'One recorded recovery trial', source_files:['src/results/recovery_20261122/M2_RECOVERY_SESSION.log'] },
]
const topology = { data_source:{...source,kind:'repo_config'}, generated_at:'2026-11-24T00:00:00Z', warnings:[], nodes, links:[{id:'r2-r5',a:'R2',b:'R5',subnet:'fc00:25::/64',failure_link:true,status:'unknown'}], paths, failure_link:'R2-R5', destination:'fc00:b::1', live_status_note:'Statuses are unknown; no live telemetry.' }
const events = [
  { timestamp:'2026-11-21 19:54:36.017', kind:'probe_failed', message:'Probe 1/3' },
  { timestamp:'2026-11-21 19:54:41.267', kind:'failover_started', message:'Installing P2' },
  { timestamp:'2026-11-21 19:54:41.510', kind:'p2_installed', message:'P2 install command completed' },
  { timestamp:'2026-11-21 19:54:41.596', kind:'route_verified', message:'P2 route verified' },
  { timestamp:'2026-11-21 19:54:46.823', kind:'recovery_verified', message:'P2 route and connectivity verified' },
]
const responses: Record<string, any> = {
  '/api/health': { status:'ok', service:'aiori3-srv6-backend', version:'2.1.0', read_only:true, live_telemetry:false, host_os:'Linux', data_dir:{path:'src/results',exists:true,readable:true,files_found:59}, scripts_dir_exists:true },
  '/api/overview': { data_source:source, generated_at:'2026-11-24T00:00:00Z', warnings:[], project:{name:'AIORI-3 SRv6',team:'NetNova',code:'A3-PS020-TC172'}, modes:modeOverview, experiment_dates:{benchmark_M0:'2026-11-21',benchmark_P1:'2026-11-22',benchmark_P2:'2026-11-22'}, last_updated:null },
  '/api/topology': topology,
  '/api/steering': topology,
  '/api/routing-modes': { data_source:source, generated_at:'2026-11-24T00:00:00Z', warnings:[], modes:modeOverview, paths, interpretation_note:'Separate benchmark sessions; comparison is descriptive.' },
  '/api/benchmarks': { data_source:source, generated_at:'2026-11-24T00:00:00Z', warnings:[], latest:{run_id:'validated-20261121-20261122',run_date:null,dataset_note:'Separate sessions.',modes:modeStats,summary_file_check:null}, comparison_vs_m0:[{mode:'P1_SRv6',mean_rtt_delta_vs_m0_ms:-.0119,max_rtt_delta_vs_m0_ms:-2.13,packet_loss_delta_vs_m0_pp:0},{mode:'P2_SRv6',mean_rtt_delta_vs_m0_ms:-.009633,max_rtt_delta_vs_m0_ms:-1.58,packet_loss_delta_vs_m0_pp:0}], earlier_run:null, notes:['Latest M0/P1/P2 records are separate sessions.'] },
  '/api/failover': { data_source:{...source,files:['src/results/recovery_20261122/M2_RECOVERY_SESSION.log']}, generated_at:'2026-11-24T00:00:00Z', warnings:[], measurement_scope:'single_trial', scope_note:'One recovery trial.', source_log:'src/results/recovery_20261122/M2_RECOVERY_SESSION.log',runs_in_log:1,recovered_runs:1,detection_threshold:3,failure_link:'R2-R5',headline_trial:{run_id:1,run_start:'2026-11-21 19:53:58.381',detection_threshold:3,probes_succeeded_before_failure:34,metrics:{detection_time_s:5.25,path_installation_time_s:.244,failover_to_route_verified_s:.329,installation_to_route_verified_s:.085,first_fail_to_install_s:5.493,first_fail_to_recovery_s:10.807,install_to_recovery_s:5.313},verification:{transmitted:5,received:5,packet_loss_percent:0,rtt_min_ms:.176,rtt_avg_ms:.265,rtt_max_ms:.365,rtt_mdev_ms:.067},events,route_verified:'2026-11-21 19:54:41.596'},runs:[{run_id:1,started:'2026-11-21 19:53:58.381',outcome:'recovered',probe_failures:3,failover_attempts:1,error_count:0}],limitations:['Single trial.'] },
  '/api/logs': { data_source:source, generated_at:'2026-11-24T00:00:00Z', warnings:[], total_available:1,returned:1,entries:[{id:'m2-route',timestamp:events[3].timestamp,category:'M2',kind:'event',severity:'ok',message:'[run 1] P2 route verified',source_file:'src/results/recovery_20261122/M2_RECOVERY_SESSION.log'}] },
  '/api/config': { service:'aiori3-srv6-backend', version:'2.1.0', read_only:true, live_telemetry:true, data_dir:'src/results', scripts_dir:'src/scripts', cors_origins:['http://localhost:5173'], endpoints:['/api/health','/api/config','/api/live/status'] },
  '/api/live/status': { enabled:true, status:'available', generated_at:'2026-11-24T00:00:00Z', poll_interval_seconds:10, namespaces:['s','r1','r2','r3','r4','r5','d'].map(name=>({name,status:'available',interfaces:[],ipv6_routes:[]})), links:['s-r1','r1-r2','r2-r5','r1-r3','r3-r4','r4-r5','d-r5'].map(id=>({id,a:id.split('-')[0].toUpperCase(),b:id.split('-')[1].toUpperCase(),status:'up'})), probe:{source:'s',destination:'fc00:b::1',status:'success',packets_sent:1,packets_received:1,packet_loss_percent:0,rtt_ms:.123,message:'One ICMPv6 probe was sent from namespace s.'}, warnings:[] },
}

function stubApi(fail = false) {
  const calls: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    calls.push(`${init?.method || 'GET'} ${url.pathname}${url.search}`)
    if (fail) throw new TypeError('Backend unavailable')
    const key=url.pathname
    if (!(key in responses)) return new Response('{}',{status:404})
    return new Response(JSON.stringify(responses[key]),{status:200,headers:{'Content-Type':'application/json'}})
  }))
  return calls
}

async function mount() {
  vi.resetModules()
  vi.stubEnv('VITE_API_BASE_URL','http://backend.test:8000')
  vi.stubEnv('VITE_API_TIMEOUT_MS','2000')
  const { App } = await import('../main')
  return render(<App />)
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('NetNova dashboard API integration', () => {
  it('opens the workspace details menu and lets the workspace breadcrumb return to Overview', async () => {
    stubApi()
    await mount()
    const workspaceButton=screen.getByRole('button',{name:/AIORI-3 SRv6 Hackathon project/})
    fireEvent.click(workspaceButton)
    expect(workspaceButton.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('PS-020 · A3-PS020-TC172')).toBeTruthy()
    fireEvent.click(screen.getByRole('button',{name:/Network Topology/}))
    expect(await screen.findByText('Seven-node SRv6 topology')).toBeTruthy()
    fireEvent.click(screen.getByRole('button',{name:'Workspace'}))
    expect(await screen.findByRole('heading',{name:'Overview'})).toBeTruthy()
  })

  it('loads current recorded results and uses the endpoint data across all eight pages', async () => {
    const calls=stubApi()
    await mount()
    await screen.findByRole('heading',{name:'Overview'})
    expect(await screen.findByText(/Live network monitor · AVAILABLE/)).toBeTruthy()
    await waitFor(()=>expect(screen.getAllByText('M0 2026-11-21 · P1 2026-11-22 · P2 2026-11-22').length).toBe(2))
    expect(screen.getAllByText(/0\.02323/).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button',{name:/Network Topology/}))
    expect(await screen.findByText('Seven-node SRv6 topology')).toBeTruthy()
    expect(screen.getByText('R2 ↔ R5')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab',{name:'P2'}))
    expect(screen.getByRole('img',{name:/P2 view/})).toBeTruthy()
    fireEvent.click(screen.getByRole('tab',{name:'M2 · Failure'}))
    expect(screen.getByText(/recovery path uses P2/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button',{name:/Routing Modes/}))
    expect(await screen.findByText('Routing mode comparison')).toBeTruthy()
    expect(screen.getByText(/Separate benchmark sessions/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button',{name:/SRv6 Path Steering/}))
    expect(await screen.findByText('P1 · Primary path')).toBeTruthy()
    expect(screen.getByText('fc00:0:3::1 → fc00:0:4::1 → fc00:0:5::d6')).toBeTruthy()

    fireEvent.click(screen.getByRole('button',{name:/Failover Monitoring/}))
    expect(await screen.findByText('Recorded recovery timeline')).toBeTruthy()
    expect(screen.getByText('P2 route verified')).toBeTruthy()
    expect(screen.getByText('10.81')).toBeTruthy()

    fireEvent.click(screen.getByRole('button',{name:/Benchmark Analytics/}))
    expect(await screen.findByText('Change vs M0 baseline')).toBeTruthy()
    expect(screen.getByText(/90 total trials/)).toBeTruthy()
    expect(screen.getByText(/90,000 packets transmitted/)).toBeTruthy()
    expect(screen.getByText(/M0 · OSPFv3 baseline · M1 · SRv6 primary path/)).toBeTruthy()
    expect(screen.getByText(/p1_benchmark_revalidated\.csv/)).toBeTruthy()
    expect(screen.getByText('Per-mode reports')).toBeTruthy()
    expect(screen.getAllByText(/0\.01133/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/0\.0136/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/0\.05693/)).toBeNull()
    expect(screen.getByText('Mean and median RTT')).toBeTruthy()
    expect(screen.getByText('Highest observed RTT')).toBeTruthy()
    expect(screen.getByText('Average RTT per trial')).toBeTruthy()
    expect(screen.getByText('Maximum RTT per trial')).toBeTruthy()
    expect(screen.getByText('Packet delivery')).toBeTruthy()
    expect(screen.getByText('Mean trial duration')).toBeTruthy()

    fireEvent.click(screen.getByRole('button',{name:/Experiment Logs/}))
    expect(await screen.findByText('Experiment event history')).toBeTruthy()
    expect(screen.getByText('[run 1] P2 route verified')).toBeTruthy()

    fireEvent.click(screen.getByRole('button',{name:/Settings/}))
    expect(await screen.findByText('API connection')).toBeTruthy()
    expect(screen.queryByText('Data source details')).toBeNull()
    expect(screen.getByText('Data provenance')).toBeTruthy()
    expect(screen.getByText('http://localhost:5173')).toBeTruthy()

    for(const path of ['/api/health','/api/overview','/api/topology','/api/routing-modes','/api/steering','/api/benchmarks','/api/failover','/api/logs','/api/config','/api/live/status']) {
      expect(calls.some((call)=>call.startsWith(`GET ${path}`))).toBe(true)
    }
    expect(calls.every((call)=>call.startsWith('GET '))).toBe(true)
  })

  it('shows loading and backend error states without substituting older local measurements', async () => {
    stubApi(true)
    await mount()
    expect(screen.getByText(/Loading recorded experiment data/)).toBeTruthy()
    expect(await screen.findByText(/No local or older measurements are substituted/)).toBeTruthy()
    expect(screen.queryByText(/0\.05693/)).toBeNull()
    expect(screen.getByText(/No recorded measurements available/)).toBeTruthy()
  })
})
