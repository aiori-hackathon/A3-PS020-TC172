# NetNova — Experimental Results
## AIORI-3 PS-020: Local SRv6 Path Steering and Measured Failure Recovery

## 1. Experimental Overview

The experiments evaluate:
- M0: OSPFv3 baseline routing.
- M1-P1: SRv6 path steering through R2 and R5.
- M1-P2: SRv6 path steering through R3, R4 and R5.
- M2: Controlled failure detection and recovery through P2.

The experiments were conducted in a Linux network namespace-based router topology.

## 2. M0 — OSPFv3 Baseline

### Fresh benchmark — 21 November 2026
- Trials: 30
- Packets per trial: 1000
- Total packets transmitted: 30000
- Total packets received: 30000
- Packet loss: 0%
- Mean trial-average RTT: 0.02323 ms
- Median trial-average RTT: 0.02100 ms
- Highest observed RTT: 2.578 ms

The benchmark completed all 30 trials without packet loss.

Detailed data:
- `m0_benchmark_20261121.csv`
- `m0_analysis_20261121.txt`

## 3. M1 — SRv6 Path Steering

### P1 — Primary path
The P1 path uses the R2 segment followed by the R5 End.DT6 segment.

Connectivity validation:
- 10/10 packets received
- 0% packet loss
- Average RTT: 0.616 ms

### P2 — Alternate path
The P2 path uses the R3, R4 and R5 segment chain.

Connectivity validation:
- 10/10 packets received
- 0% packet loss
- Average RTT: 0.254 ms

Route verification and SID counter observations were recorded during path validation.

## 4. M0, P1 and P2 Benchmark Comparison
### 31 October 2026

| Mode | Trials | Packets Received | Loss | Mean Trial-Average RTT |
|---|---:|---:|---:|---:|
| M0 OSPFv3 | 30 | 30000/30000 | 0% | 0.01497 ms |
| P1 SRv6 | 30 | 30000/30000 | 0% | 0.05693 ms |
| P2 SRv6 | 30 | 30000/30000 | 0% | 0.01993 ms |

All three modes completed the benchmark with zero packet loss in this experiment.

These measurements are specific to the tested VM and topology.

Source:
- `comparison_summary_20261031.csv`

The fresh M0 benchmark from 21 November is not combined with this comparison because it was conducted at a different time.

## 5. M2 — Controlled Failure and Recovery

Experiment sequence:
1. P1 connectivity was validated before failure injection.
2. The R2-R5 link was deliberately brought down.
3. The monitor detected three consecutive failed probes.
4. P2 was installed.
5. The P2 segment list was verified on the R1 route.
6. Recovery connectivity was tested.

Recovery:
- 5/5 packets received
- 0% packet loss
- Recovery-test average RTT: 0.545 ms

SID counters were observed on R3, R4 and R5 with zero errors reported.

The R2-R5 link was restored, followed by a post-restoration ping:
- 5/5 packets received
- 0% packet loss
- Average RTT: 0.251 ms

The experiment provides evidence of successful P2 route installation and connectivity recovery following the controlled R2-R5 link failure.

## 6. Evidence and Reproducibility

Raw CSV files, validation logs, failover logs, reports and earlier experiment records are retained in the results directories.

The report summarizes the recorded evidence and does not replace the original experiment files.

