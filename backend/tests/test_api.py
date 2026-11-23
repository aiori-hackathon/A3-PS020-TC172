import json

import pytest

ENDPOINTS = ["health", "overview", "topology", "benchmarks", "failover", "logs"]


@pytest.mark.parametrize("name", ENDPOINTS)
def test_every_endpoint_ok_and_labels_its_source(client, name):
    r = client.get(f"/api/{name}")
    assert r.status_code == 200
    body = r.json()
    if name != "health":
        assert body["data_source"]["live_telemetry"] is False
        assert body["data_source"]["kind"] in ("historical", "repo_config")
        assert body["generated_at"]
    else:
        assert body["status"] == "ok" and body["read_only"] is True and body["version"] and body["timestamp"]


def test_benchmarks_real_values_and_separate_run_warnings(client):
    b = client.get("/api/benchmarks").json()
    latest = b["latest"]
    modes = {m["id"]: m for m in latest["modes"]}
    assert latest["run_id"] == "20261121" and latest["run_date"] == "2026-11-21"
    assert set(modes) == {"M0", "P1", "P2"}
    assert all(m["trials"] == 30 and m["transmitted"] == 30000 and m["received"] == 30000 for m in modes.values())
    # M0 from the latest M0 run; P1/P2 from the validated recovery CSVs (values match the repo's consolidated report).
    assert modes["M0"]["source_file"] == "src/results/final/m0_benchmark_20261121.csv"
    assert modes["P1"]["source_file"] == "src/results/recovery_20261122/p1_benchmark_revalidated.csv"
    assert modes["P2"]["source_file"] == "src/results/recovery_20261122/p2_benchmark_revalidated.csv"
    assert (modes["M0"]["max_rtt_ms"], modes["P1"]["max_rtt_ms"], modes["P2"]["max_rtt_ms"]) == (2.578, 0.448, 0.998)
    assert modes["M0"]["mean_trial_avg_rtt_ms"] == pytest.approx(0.023233, abs=1e-6)
    assert modes["P1"]["mean_trial_avg_rtt_ms"] == pytest.approx(0.011333, abs=1e-6)
    assert modes["P2"]["median_trial_avg_rtt_ms"] == pytest.approx(0.015)
    # The separate-run provenance is stated, per mode, and in the notes.
    for mode_id in ("P1", "P2"):
        assert any(mode_id in w and "separate recorded run" in w and "recovery_20261122" in w for w in b["warnings"])
    assert not any("M0 is from a separate" in w for w in b["warnings"])
    assert any("separate recorded run" in n for n in b["notes"])
    assert latest["summary_file_check"] is None  # no comparison summary exists for the 20261121 run
    assert b["earlier_run"] is None  # src/results/benchmark holds only invalid (NA, 100% loss) runs
    assert modes["M0"]["trial_rows"] is None
    with_rows = client.get("/api/benchmarks?include_trials=true").json()
    assert all(len(m["trial_rows"]) == 30 for m in with_rows["latest"]["modes"])  # one file per mode, nothing pooled


def test_matching_p1_p2_files_preferred_over_recovery(client, src):
    res = src / "results"
    (res / "final/p1_benchmark_20261121.csv").write_text((res / "final/p1_benchmark_20261031.csv").read_text())
    (res / "final/p2_benchmark_20261121.csv").write_text((res / "final/p2_benchmark_20261031.csv").read_text())
    b = client.get("/api/benchmarks").json()
    modes = {m["id"]: m for m in b["latest"]["modes"]}
    assert modes["P1"]["source_file"] == "src/results/final/p1_benchmark_20261121.csv"
    assert modes["P2"]["source_file"] == "src/results/final/p2_benchmark_20261121.csv"
    assert not any("separate recorded run" in w for w in b["warnings"])
    assert not any("separate recorded run" in n for n in b["notes"])
    assert not any("recovery_20261122" in f for f in b["data_source"]["files"])


def test_recovery_fallback_missing_or_invalid_is_not_fabricated(client, src):
    rec = src / "results/recovery_20261122"
    (rec / "p1_benchmark_revalidated.csv").unlink()
    (rec / "p2_benchmark_revalidated.csv").write_text("trial,requested_pps,transmitted,received,packet_loss,duration_ms,min_ms,avg_ms,max_ms,mdev_ms\n1,0,1000,0,100%,NA,NA,NA,NA,NA\n")
    b = client.get("/api/benchmarks").json()
    assert [m["id"] for m in b["latest"]["modes"]] == ["M0"]
    assert any("P1" in w and "not reported" in w for w in b["warnings"])
    assert any("p2_benchmark_revalidated.csv" in w and "not reported" in w for w in b["warnings"])
    # The preserved 100%-loss troubleshooting file p1_benchmark.csv is never used as a substitute.
    assert not any(m["source_file"].endswith("recovery_20261122/p1_benchmark.csv") for m in b["latest"]["modes"])


def test_unusable_latest_m0_falls_back_to_earlier_complete_run(client, src):
    (src / "results/final/m0_benchmark_20261121.csv").write_text("")
    b = client.get("/api/benchmarks").json()
    assert b["latest"]["run_id"] == "20261031"
    modes = {m["id"]: m for m in b["latest"]["modes"]}
    assert set(modes) == {"M0", "P1", "P2"} and modes["P1"]["max_rtt_ms"] == 97.209 and modes["M0"]["max_rtt_ms"] == 4.685
    assert all("/final/" in m["source_file"] and "20261031" in m["source_file"] for m in modes.values())
    assert b["latest"]["summary_file_check"]["matches"] is True
    assert not any("separate recorded run" in w for w in b["warnings"])


def test_failover_matches_recorded_summary_and_declares_single_trial(client):
    f = client.get("/api/failover").json()
    assert f["measurement_scope"] == "single_trial"
    assert f["runs_in_log"] == 5 and f["recovered_runs"] == 2
    m = f["headline_trial"]["metrics"]
    assert (m["first_fail_to_install_s"], m["first_fail_to_recovery_s"], m["install_to_recovery_s"]) == (6.134, 11.405, 5.271)
    assert m["detection_time_s"] == 5.286 and m["path_installation_time_s"] == 0.849
    v = f["headline_trial"]["verification"]
    assert (v["transmitted"], v["received"], v["rtt_avg_ms"]) == (5, 5, 0.644)
    assert f["summary_file_check"]["matches"] is True
    assert f["failure_link"] == "R2-R5" and f["detection_threshold"] == 3
    assert sum(r["is_headline"] for r in f["runs"]) == 1


def test_topology_parsed_from_scripts(client):
    t = client.get("/api/topology").json()
    assert [n["id"] for n in t["nodes"]] == ["S", "R1", "R2", "R3", "R4", "R5", "D"]
    paths = {p["id"]: p for p in t["paths"]}
    assert paths["P1"]["nodes"] == ["S", "R1", "R2", "R5", "D"]
    assert paths["P2"]["nodes"] == ["S", "R1", "R3", "R4", "R5", "D"]
    assert t["failure_link"] == "R2-R5"
    assert [l["id"] for l in t["links"] if l["failure_link"]] == ["r2-r5"]
    assert {n["id"]: n["sid_behavior"] for n in t["nodes"] if n["sid"]} == {"R2": "End", "R3": "End", "R4": "End", "R5": "End.DT6"}
    assert all(l["status"] == "unknown" for l in t["links"])


def test_overview_has_four_modes_and_source(client):
    o = client.get("/api/overview").json()
    assert [m["id"] for m in o["modes"]] == ["M0", "M1-P1", "M1-P2", "M2"]
    assert o["last_updated"] and o["experiment_dates"]["benchmark_run"] == "2026-11-21"
    assert o["data_source"]["kind"] == "historical"


def test_logs_filters_and_order(client):
    r = client.get("/api/logs?limit=500").json()
    assert r["returned"] == len(r["entries"]) <= 500
    stamps = [e["timestamp"] for e in r["entries"] if e["timestamp"]]
    assert stamps == sorted(stamps, reverse=True)
    assert {e["kind"] for e in r["entries"]} == {"event", "record"}
    err = client.get("/api/logs?severity=error&category=M2").json()
    assert err["entries"] and all(e["severity"] == "error" and e["category"] == "M2" for e in err["entries"])
    assert client.get("/api/logs?limit=0").status_code == 422
    assert client.get("/api/logs?severity=bogus").status_code == 422


# ---- missing / malformed input ------------------------------------------------
def test_missing_results_dir_degrades_gracefully(client, src, monkeypatch):
    monkeypatch.setenv("AIORI_DATA_DIR", str(src / "does-not-exist"))
    assert client.get("/api/health").json()["status"] == "degraded"
    b = client.get("/api/benchmarks").json()
    assert b["latest"] is None and b["data_source"]["kind"] == "unavailable" and b["warnings"]
    f = client.get("/api/failover").json()
    assert f["measurement_scope"] == "none" and f["headline_trial"] is None and f["warnings"]
    for name in ("overview", "logs"):
        assert client.get(f"/api/{name}").status_code == 200


def test_missing_scripts_dir_gives_empty_topology(client, src, monkeypatch):
    monkeypatch.setenv("AIORI_SCRIPTS_DIR", str(src / "nope"))
    t = client.get("/api/topology")
    assert t.status_code == 200 and t.json()["nodes"] == [] and t.json()["warnings"]


def test_malformed_csv_rows_are_skipped_not_invented(client, src):
    p = src / "results/recovery_20261122/p1_benchmark_revalidated.csv"
    lines = p.read_text().splitlines()
    lines[2] = "2,1000,1000,not-a-number,0%,1008,0.005,0.015,0.299,0.016"  # bad received
    lines[3] = "3,1000"  # too few cells
    p.write_text("\n".join(lines) + "\n")
    b = client.get("/api/benchmarks").json()
    p1 = next(m for m in b["latest"]["modes"] if m["id"] == "P1")
    assert p1["trials"] == 28 and p1["skipped_rows"] >= 1 and p1["transmitted"] == 28000
    assert any("p1_benchmark_revalidated.csv" in w for w in b["warnings"])


def test_empty_and_binary_garbage_files_do_not_crash(client, src):
    (src / "results/final/m0_benchmark_20261121.csv").write_text("")
    (src / "results/m2/failover_success_20261030.log").write_bytes(b"\x00\xff\xfe garbage \x00\n" * 50)
    assert client.get("/api/benchmarks").status_code == 200
    f = client.get("/api/failover").json()
    assert f["measurement_scope"] == "none" and f["warnings"]
    assert client.get("/api/overview").status_code == 200
    assert client.get("/api/logs").status_code == 200


def test_summary_mismatch_is_reported(client, src):
    p = src / "results/m2/failover_summary.txt"
    p.write_text(p.read_text().replace("11.405", "99.999"))
    assert client.get("/api/failover").json()["summary_file_check"]["matches"] is False


def test_log_with_nul_padding_still_parses(client, src):
    p = src / "results/m2/failover_success_20261030.log"
    p.write_bytes(p.read_bytes().replace(b"\n", b"\n\x00\x00", 3))
    assert client.get("/api/failover").json()["headline_trial"]["metrics"]["first_fail_to_recovery_s"] == 11.405


# ---- safety / CORS -------------------------------------------------------------
@pytest.mark.parametrize("method", ["post", "put", "patch", "delete"])
@pytest.mark.parametrize("name", ENDPOINTS)
def test_no_write_methods(client, method, name):
    assert getattr(client, method)(f"/api/{name}").status_code == 405


def test_no_command_or_file_endpoints_exist(client):
    paths = set(client.get("/openapi.json").json()["paths"])
    assert paths == {f"/api/{n}" for n in ENDPOINTS}
    for evil in ("/api/run", "/api/exec", "/api/files?path=../../etc/passwd", "/api/logs/../../etc/passwd"):
        assert client.get(evil).status_code in (404, 405)


def test_cors_allows_dashboard_origin_only(client):
    ok = client.get("/api/health", headers={"Origin": "http://localhost:5173"})
    assert ok.headers["access-control-allow-origin"] == "http://localhost:5173"
    bad = client.get("/api/health", headers={"Origin": "http://evil.example"})
    assert "access-control-allow-origin" not in bad.headers
    pre = client.options("/api/health", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"})
    assert pre.status_code == 200
    pre_post = client.options("/api/health", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"})
    assert pre_post.status_code == 400


def test_unhandled_error_hides_internals(client, monkeypatch):
    from app.services import overview
    monkeypatch.setattr(overview, "build", lambda s: (_ for _ in ()).throw(RuntimeError("secret /home/user/x")))
    r = client.get("/api/overview")
    assert r.status_code == 500 and "secret" not in r.text and "/home" not in r.text
