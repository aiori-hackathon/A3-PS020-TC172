"""Read, validate and aggregate the latest supported benchmark evidence.

The newest validated comparison is deliberately assembled from three independently
recorded sessions: M0 (2026-11-21) and P1/P2 (2026-11-22). These are never presented
as a single simultaneous run. Older October and troubleshooting runs remain separate.
"""
from __future__ import annotations

import re
import statistics
from typing import Literal

from ..config import Settings
from ..schemas import BenchmarkMode, BenchmarkRun, BenchmarksResponse, Comparison, SummaryCheck, TrialRow
from .data_reader import SourceTracker, num, utc_now

ModeId = Literal["M0", "P1", "P2"]
_MODE_META: dict[ModeId, tuple[str, str]] = {
    "M0": ("M0_OSPFv3", "M0 · OSPFv3 baseline"),
    "P1": ("P1_SRv6", "M1 · SRv6 primary path (P1)"),
    "P2": ("P2_SRv6", "M1 · SRv6 backup path (P2)"),
}
_LATEST: dict[ModeId, tuple[str, str, str, str]] = {
    "M0": ("final/m0_benchmark_20261121.csv", "20261121", "final/m0_analysis_20261121.txt", "2026-11-21"),
    "P1": ("recovery_20261122/p1_benchmark_revalidated.csv", "20261122", "recovery_20261122/CONSOLIDATED_EXPERIMENT_REPORT.md", "2026-11-22"),
    "P2": ("recovery_20261122/p2_benchmark_revalidated.csv", "20261122", "recovery_20261122/CONSOLIDATED_EXPERIMENT_REPORT.md", "2026-11-22"),
}
_OCTOBER = {"M0": "m0_benchmark_20261031.csv", "P1": "p1_benchmark_20261031.csv", "P2": "p2_benchmark_20261031.csv"}


def _date(run_id: str) -> str | None:
    return f"{run_id[:4]}-{run_id[4:6]}-{run_id[6:8]}" if len(run_id) == 8 and run_id.isdigit() else None


def parse_trials(rows: list[dict[str, str]]) -> tuple[list[TrialRow], int]:
    out: list[TrialRow] = []
    bad = 0
    for row in rows:
        tx, rx = num(row.get("transmitted")), num(row.get("received"))
        duration, avg, maximum, trial = (num(row.get(k)) for k in ("duration_ms", "avg_ms", "max_ms", "trial"))
        minimum, deviation = num(row.get("min_ms")), num(row.get("mdev_ms"))
        values = (tx, rx, duration, avg, maximum, trial)
        if (any(v is None for v in values) or tx <= 0 or rx < 0 or rx > tx or duration <= 0
                or avg < 0 or maximum < 0 or trial < 1 or int(trial) != trial
                or int(tx) != tx or int(rx) != rx or (minimum is not None and minimum < 0)
                or (deviation is not None and deviation < 0)):
            bad += 1
            continue
        computed_loss = (tx - rx) / tx * 100
        recorded_loss = num(row.get("packet_loss"))
        if recorded_loss is not None and abs(recorded_loss - computed_loss) > 0.000001:
            bad += 1
            continue
        out.append(TrialRow(
            trial=int(trial), transmitted=int(tx), received=int(rx),
            packet_loss_percent=round(computed_loss, 6), duration_ms=duration,
            min_rtt_ms=minimum, avg_rtt_ms=avg, max_rtt_ms=maximum, mdev_rtt_ms=deviation,
        ))
    return out, bad


def aggregate(mode_id: ModeId, mode: str, label: str, source_file: str,
              trials: list[TrialRow], skipped: int, requested: set[int], include_trials: bool,
              run_id: str | None = None, validation_file: str | None = None) -> BenchmarkMode:
    tx = sum(t.transmitted for t in trials)
    rx = sum(t.received for t in trials)
    total_ms = sum(t.duration_ms for t in trials)
    mins = [t.min_rtt_ms for t in trials if t.min_rtt_ms is not None]
    return BenchmarkMode(
        id=mode_id, mode=mode, label=label, source_file=source_file,
        run_id=run_id, run_date=_date(run_id) if run_id else None,
        validation_file=validation_file, validation_status="validated" if validation_file else "unvalidated",
        trials=len(trials), skipped_rows=skipped,
        requested_pps=next(iter(requested)) if len(requested) == 1 else None,
        transmitted=tx, received=rx, packets_lost=tx - rx,
        packet_loss_percent=round((tx - rx) / tx * 100, 6),
        mean_trial_avg_rtt_ms=statistics.fmean(t.avg_rtt_ms for t in trials),
        median_trial_avg_rtt_ms=statistics.median(t.avg_rtt_ms for t in trials),
        min_rtt_ms=min(mins) if mins else None,
        max_rtt_ms=max(t.max_rtt_ms for t in trials),
        mean_trial_duration_ms=total_ms / len(trials), total_duration_ms=total_ms,
        observed_rate_pps=(tx / (total_ms / 1000)) if total_ms > 0 else None,
        trial_rows=trials if include_trials else None,
    )


def _summary_value(text: str, pattern: str) -> float | None:
    match = re.search(pattern, text, re.IGNORECASE)
    return num(match.group(1).replace(",", "")) if match else None


def _report_column(text: str, metric: str, mode_id: ModeId) -> float | None:
    header = next((line for line in text.splitlines() if "| Metric | M0 | P1 | P2 |" in line), None)
    row = next((line for line in text.splitlines() if line.strip().startswith(f"| {metric} |")), None)
    if not header or not row:
        return None
    names = [cell.strip() for cell in header.strip().strip("|").split("|")]
    values = [cell.strip().replace(",", "") for cell in row.strip().strip("|").split("|")]
    try:
        return num(values[names.index(mode_id)])
    except (ValueError, IndexError):
        return None


def _validate_latest(tr: SourceTracker, mode_id: ModeId, mode: BenchmarkMode, validation_rel: str) -> bool:
    text = tr.text(validation_rel, required=False)
    if text is None:
        tr.warnings.append(f"{mode_id}: validation evidence {tr.display(validation_rel)} is unavailable; dataset not promoted to latest.")
        return False
    expected_source = _LATEST[mode_id][0].split("/")[-1]
    if expected_source not in text:
        tr.warnings.append(f"{mode_id}: validation report does not identify {expected_source}; dataset not promoted to latest.")
        return False

    checks: list[tuple[str, float | None, float, float]] = []
    if mode_id == "M0":
        checks = [
            ("trials", _summary_value(text, r"Trials completed:\s*([\d,]+)"), mode.trials, 0),
            ("transmitted", _summary_value(text, r"Total packets transmitted:\s*([\d,]+)"), mode.transmitted, 0),
            ("received", _summary_value(text, r"Total packets received:\s*([\d,]+)"), mode.received, 0),
            ("mean RTT", _summary_value(text, r"Mean trial-average RTT:\s*([\d.]+)\s*ms"), mode.mean_trial_avg_rtt_ms, .000005),
            ("median RTT", _summary_value(text, r"Median trial-average RTT:\s*([\d.]+)\s*ms"), mode.median_trial_avg_rtt_ms, .000005),
            ("maximum RTT", _summary_value(text, r"Highest observed RTT:\s*([\d.]+)\s*ms"), mode.max_rtt_ms, .000001),
        ]
    else:
        checks = [
            ("trials", _report_column(text, "Trials", mode_id), mode.trials, 0),
            ("transmitted", _report_column(text, "Packets transmitted", mode_id), mode.transmitted, 0),
            ("received", _report_column(text, "Packets received", mode_id), mode.received, 0),
            ("packet loss", _report_column(text, "Packet loss", mode_id), mode.packet_loss_percent, .000001),
            ("mean RTT", _report_column(text, "Mean trial-average RTT (ms)", mode_id), mode.mean_trial_avg_rtt_ms, .000005),
            ("median RTT", _report_column(text, "Median trial-average RTT (ms)", mode_id), mode.median_trial_avg_rtt_ms, .000005),
            ("maximum RTT", _report_column(text, "Highest individual RTT (ms)", mode_id), mode.max_rtt_ms, .000001),
        ]
    failed = [name for name, expected, actual, tolerance in checks if expected is None or abs(expected - actual) > tolerance]
    if failed:
        tr.warnings.append(f"{mode_id}: CSV does not match {tr.display(validation_rel)} ({', '.join(failed)}); dataset not promoted to latest.")
        return False
    return True


def _load_mode(tr: SourceTracker, mode_id: ModeId, rel: str, run_id: str, include_trials: bool,
               validation_rel: str | None = None) -> BenchmarkMode | None:
    got = tr.csv_rows(rel, required=False)
    if got is None:
        tr.warnings.append(f"{mode_id}: expected benchmark data {tr.display(rel)} was not readable.")
        return None
    rows, malformed = got
    trials, invalid = parse_trials(rows)
    skipped = malformed + invalid
    if skipped:
        tr.warnings.append(f"{tr.display(rel)}: {skipped} malformed or invalid trial row(s) skipped.")
    if not trials:
        tr.warnings.append(f"{mode_id}: no valid trial rows in {tr.display(rel)}.")
        return None
    trial_numbers = [t.trial for t in trials]
    if len(trial_numbers) != len(set(trial_numbers)):
        tr.warnings.append(f"{mode_id}: duplicate trial numbers in {tr.display(rel)}; dataset rejected.")
        return None
    name, label = _MODE_META[mode_id]
    requested = {int(v) for row in rows if (v := num(row.get("requested_pps"))) is not None and int(v) == v}
    mode = aggregate(mode_id, name, label, tr.display(rel), trials, skipped, requested,
                     include_trials, run_id, tr.display(validation_rel) if validation_rel else None)
    if validation_rel and not _validate_latest(tr, mode_id, mode, validation_rel):
        return None
    return mode


def _check_summary(tr: SourceTracker, run_id: str, modes: list[BenchmarkMode]) -> SummaryCheck | None:
    rel = f"final/comparison_summary_{run_id}.csv"
    got = tr.csv_rows(rel, required=False)
    if got is None:
        return None
    by_mode = {r.get("mode", ""): r for r in got[0]}
    problems: list[str] = []
    for mode in modes:
        row = by_mode.get(mode.mode)
        if row is None:
            problems.append(f"{mode.mode}: not present in {rel}")
            continue
        pairs = [
            ("trials", mode.trials, 0), ("transmitted", mode.transmitted, 0), ("received", mode.received, 0),
            ("packet_loss_percent", mode.packet_loss_percent, 1e-6),
            ("mean_trial_avg_rtt_ms", mode.mean_trial_avg_rtt_ms, 5e-6),
            ("median_trial_avg_rtt_ms", mode.median_trial_avg_rtt_ms, 5e-6),
            ("mean_trial_duration_ms", mode.mean_trial_duration_ms, 0.05),
            ("highest_observed_rtt_ms", mode.max_rtt_ms, 1e-9),
        ]
        for key, actual, tolerance in pairs:
            expected = num(row.get(key))
            if expected is None or abs(expected - actual) > tolerance:
                problems.append(f"{mode.mode}.{key}: file={row.get(key)!r} recomputed={actual:.6g}")
    return SummaryCheck(file=tr.display(rel), matches=not problems, mismatches=problems)


def _load_october(tr: SourceTracker) -> BenchmarkRun | None:
    modes = [_load_mode(tr, mode_id, f"final/{filename}", "20261031", False)
             for mode_id, filename in _OCTOBER.items()]
    valid = [mode for mode in modes if mode is not None]
    if not valid:
        return None
    check = _check_summary(tr, "20261031", valid)
    if check and check.matches:
        valid = [mode.model_copy(update={"validation_status": "validated", "validation_file": check.file}) for mode in valid]
    return BenchmarkRun(run_id="20261031", run_date="2026-10-31", modes=valid,
                        summary_file_check=check,
                        dataset_note="October benchmark set; shown separately from the newer, independently validated November mode datasets.")


def build(settings: Settings, include_trials: bool = False) -> BenchmarksResponse:
    tr = SourceTracker(settings.data_dir)
    modes: list[BenchmarkMode] = []
    for mode_id, (rel, run_id, validation, _) in _LATEST.items():
        mode = _load_mode(tr, mode_id, rel, run_id, include_trials, validation)
        if mode is not None:
            modes.append(mode)

    latest = None
    if modes:
        same_session = len({mode.run_id for mode in modes}) == 1
        latest = BenchmarkRun(
            run_id=next(iter({m.run_id for m in modes})) if same_session else "validated-20261121-20261122",
            run_date=_date(modes[0].run_id or "") if same_session else None,
            modes=modes,
            summary_file_check=_check_summary(tr, modes[0].run_id, modes) if same_session and modes[0].run_id else None,
            dataset_note=("One validated run." if same_session else
                          "Latest validated per-mode datasets span separate sessions: M0 on 2026-11-21; P1 and P2 on 2026-11-22. Cross-mode deltas are descriptive and are not a same-session controlled comparison."),
        )
    else:
        tr.warnings.append("No latest validated benchmark datasets are available.")

    by_id = {m.id: m for m in modes}
    baseline = by_id.get("M0")
    comparison: list[Comparison] = []
    if baseline:
        for mode in modes:
            if mode.id == "M0":
                continue
            comparison.append(Comparison(
                mode=mode.mode,
                mean_rtt_delta_vs_m0_ms=round(mode.mean_trial_avg_rtt_ms - baseline.mean_trial_avg_rtt_ms, 6),
                max_rtt_delta_vs_m0_ms=round(mode.max_rtt_ms - baseline.max_rtt_ms, 6),
                packet_loss_delta_vs_m0_pp=round(mode.packet_loss_percent - baseline.packet_loss_percent, 6),
            ))

    earlier = _load_october(tr)
    return BenchmarksResponse(
        data_source=tr.info("historical", "Per-trial CSVs selected only when their recorded validation report agrees; historical data, not live measurements."),
        generated_at=utc_now(), warnings=list(dict.fromkeys(tr.warnings)), latest=latest,
        comparison_vs_m0=comparison, earlier_run=earlier,
        notes=[
            "Latest validated mode files: M0 final/m0_benchmark_20261121.csv; P1/P2 recovery_20261122/*_revalidated.csv.",
            "Latest M0, P1 and P2 results are separate sessions. Deltas versus M0 are descriptive, not a synchronized comparative trial.",
            "Median RTT is the median of per-trial average RTTs; per-packet RTTs are not stored.",
            "Maximum RTT is the highest per-trial maximum, retaining observed outliers.",
            "October 2026 results and troubleshooting datasets are kept separate from the latest validated results.",
        ],
    )
