# NetNova — PS-020 Evidence Index

This directory contains implementation scripts, configuration files, experiment logs, benchmark results, dashboard screenshots, and Docker deployment evidence for the NetNova SRv6 Path Steering and Measured Failure Recovery project.

## Evidence Structure

| Folder | Contents |
|---|---|
| `01_linux_topology` | Scripts for creating and tearing down the Linux network topology. |
| `02_m0_baseline` | Baseline OSPFv3 configuration scripts, validation logs, ping tests, and benchmark data. |
| `03_m1_p1_steering` | SRv6 SID setup, P1 path steering scripts, path validation, and benchmark results. |
| `04_m1_p2_steering` | P2 path steering implementation script and benchmark results. |
| `05_m2_failover` | Failover experiment scripts, logs, reports, and recovery validation evidence. |
| `06_benchmarks` | Benchmark scripts, comparative results, experiment reports, and checksums. |
| `07_dashboard` | Screenshots documenting the dashboard, topology, routing modes, steering paths, failover, benchmarks, and settings. |
| `08_docker` | Docker Compose configuration, Dockerfiles, runtime status, and Docker system information. |

## Supporting Directories

- `configs/` — Router configuration files used for the M0 OSPFv3 setup.
- `results/` — Original experiment logs, benchmark datasets, validation reports, and historical results.
- `scripts/` — Original experiment and topology automation scripts.

## Experiment Modes

- **M0:** Baseline routing using OSPFv3.
- **M1-P1:** SRv6 primary path steering.
- **M1-P2:** SRv6 alternate path steering.
- **M2:** Controlled failure and recovery experiment.

## Dashboard

The dashboard screenshots are provided as visual evidence of the recorded experiment data and its presentation. They do not, by themselves, establish that the network lab was live at the time of screenshot capture.

## Notes

Benchmark files and experiment reports reflect the recorded experiment sessions and their respective dates. Comparisons should be interpreted in the context of the recorded experimental conditions.

