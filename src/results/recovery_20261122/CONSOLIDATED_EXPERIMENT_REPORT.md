# SRv6 Path Steering and Measured Failure Recovery — Experimental Results

## 1. M0: OSPFv3 Baseline

- Trials: 30
- Packets per trial: 1,000
- Total transmitted: 30,000
- Total received: 30,000
- Packet loss: 0%
- Mean trial-average RTT: 0.02323 ms
- Median trial-average RTT: 0.02100 ms
- Highest observed RTT: 2.578 ms

Source: results/final/m0_analysis_20261121.txt

## 2. M1: SRv6 Path Steering

### P1: Primary Path (R1–R2–R5)

- Trials: 30
- Packets per trial: 1,000
- Total transmitted: 30,000
- Total received: 30,000
- Packet loss: 0%
- Mean trial-average RTT: 0.011333 ms
- Median trial-average RTT: 0.011 ms
- Highest trial-average RTT: 0.019 ms
- Mean trial maximum RTT: 0.235267 ms
- Highest individual RTT: 0.448 ms
- Mean trial duration: 1004.100 ms

Source: p1_benchmark_revalidated.csv

### P2: Backup Path (R1–R3–R4–R5)

- Trials: 30
- Packets per trial: 1,000
- Total transmitted: 30,000
- Total received: 30,000
- Packet loss: 0%
- Mean trial-average RTT: 0.013600 ms
- Median trial-average RTT: 0.015 ms
- Highest trial-average RTT: 0.020 ms
- Mean trial maximum RTT: 0.343267 ms
- Highest individual RTT: 0.998 ms
- Mean trial duration: 1005.733 ms

Source: p2_benchmark_revalidated.csv

## 3. M2: Controlled Failure Recovery

- Primary P1 route was active before failure injection.
- Failure was injected by bringing the R2–R5 link down.
- Monitor detected consecutive failed probes.
- Backup P2 policy was installed.
- Backup route was verified.
- Recovery connectivity was verified with 5/5 successful packets and 0% loss.

Observed timing from the controlled recovery session:

- First failed probe to failover start: approximately 5.25 seconds.
- Third failed probe to failover start: approximately 1.06 seconds.
- Failover installation start to route verification: approximately 0.33 seconds.
- Route verification to recovery ping completion: approximately 5.23 seconds.

Source: M2_RECOVERY_REPORT.txt and M2_RECOVERY_SESSION.log

## 4. Comparison

| Metric | M0 | P1 | P2 |
|---|---:|---:|---:|
| Trials | 30 | 30 | 30 |
| Packets transmitted | 30,000 | 30,000 | 30,000 |
| Packets received | 30,000 | 30,000 | 30,000 |
| Packet loss | 0% | 0% | 0% |
| Mean trial-average RTT (ms) | 0.023230 | 0.011333 | 0.013600 |
| Median trial-average RTT (ms) | 0.021000 | 0.011000 | 0.015000 |
| Highest individual RTT (ms) | 2.578 | 0.448 | 0.998 |

## 5. Interpretation and Limitations

All three routing modes recorded zero packet loss in their respective
benchmark sessions. The revalidated P1 and P2 SRv6 runs recorded lower
mean trial-average RTT values than the available M0 baseline dataset.

These are descriptive observations from separate experimental sessions.
They do not establish that SRv6 inherently improves latency. Differences
in test conditions, host scheduling, virtual-machine performance and
measurement variability may influence RTT.

The M2 experiment demonstrates the observed controlled failure detection,
backup policy installation, route verification and connectivity recovery
in the tested environment. The recorded timings should be interpreted
according to the specific measurement points used in the recovery log.

## 6. Data Provenance

- M0: results/final/m0_benchmark_20261121.csv
- P1: results/recovery_20261122/p1_benchmark_revalidated.csv
- P2: results/recovery_20261122/p2_benchmark_revalidated.csv
- M2: results/recovery_20261122/M2_RECOVERY_REPORT.txt
- M2 log: results/recovery_20261122/M2_RECOVERY_SESSION.log

The earlier failed benchmark dataset is preserved separately and is not
used in this consolidated benchmark comparison.
