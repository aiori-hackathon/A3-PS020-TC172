# AIORI-3 PS-020 — NetNova Experiment Results

## M0 — OSPF Baseline
- `final/m0_benchmark_20261121.csv` — 30-trial M0 benchmark.
- `final/m0_analysis_20261121.txt` — summary statistics and RTT outlier analysis for the 21 November benchmark.
- `final/m0_benchmark_20261031.csv` — earlier M0 benchmark.
- `m0_summary.txt` — baseline summary.
- `m0_failure_ping.log` and `m0_route_test_ping.log` — validation logs.

## M1 — SRv6 Path Steering

### P1 — Primary SRv6 Path
- `final/p1_benchmark_20261031.csv` — P1 benchmark data.
- P1 uses the R2 segment followed by the R5 End.DT6 segment.

### P2 — Alternate SRv6 Path
- `final/p2_benchmark_20261031.csv` — P2 benchmark data.
- P2 uses the R3, R4 and R5 segment chain.

### Path Validation
- `m1/path_validation.txt`
- `final/path_validation_20261031.txt`
- `final/p1_route_before_m0.txt`

## Benchmark Comparisons
- `benchmark/comparison_summary.csv`
- `benchmark/p1_benchmark.csv`
- `benchmark/p2_benchmark.csv`
- `benchmark/README.txt`
- `final/comparison_summary_20261031.csv`

## M2 — Controlled Failure Recovery
- `m2/controlled_failover.log` — controlled failure, detection, P2 installation, route verification and recovery.
- `m2/m2_controlled_report.txt` — experiment report.
- `m2/README.txt` — evidence index.
- `m2/failover.log` — earlier unsuccessful monitor attempt, preserved.
- Earlier logs and summary are retained in the M2 directory.

## Controlled M2 Experiment Summary
- P1 connectivity was validated before the failure.
- R2-R5 was deliberately brought down.
- The monitor detected three consecutive failed probes.
- P2 was installed and the segment list was verified.
- Recovery ping: 5/5 packets received, 0% loss.
- SID counters were observed on R3, R4 and R5, with zero errors reported.
- R2-R5 was restored.
- Post-restoration ping: 5/5 packets received, 0% loss.

## Evidence Integrity
Original benchmark files and earlier experiment logs are retained.
This index describes the evidence files; it does not replace raw results.

## Revalidation Session — 22 November

### Revalidated P1 and P2 Benchmarks
- `recovery_20261122/p1_benchmark_revalidated.csv` — fresh 30-trial P1 benchmark, 30,000 packets, 0% observed loss.
- `recovery_20261122/p2_benchmark_revalidated.csv` — fresh 30-trial P2 benchmark, 30,000 packets, 0% observed loss.

### Revalidation Reports
- `recovery_20261122/M1_P1_RECOVERY.txt` — P1 path validation evidence.
- `recovery_20261122/M1_P2_RECOVERY.txt` — P2 path validation evidence.
- `recovery_20261122/M2_RECOVERY_REPORT.txt` — controlled M2 recovery summary.
- `recovery_20261122/M2_RECOVERY_SESSION.log` — detailed controlled recovery session log.
- `recovery_20261122/M2_monitor_console.txt` — monitor output.
- `recovery_20261122/CONSOLIDATED_EXPERIMENT_REPORT.md` — consolidated M0, P1, P2 and M2 results, comparison and limitations.

### Revalidation Notes
- P1 and P2 were independently revalidated with 30 trials each.
- Each benchmark transmitted and received 30,000 packets with 0% observed packet loss.
- The P1 and P2 revalidated datasets are separate from the older October comparison datasets.
- `recovery_20261122/p1_benchmark.csv` is a preserved earlier troubleshooting dataset and is not used in the consolidated benchmark comparison.
