from dataclasses import replace

import pytest

ENDPOINTS = ["health", "overview", "topology", "routing-modes", "steering", "benchmarks", "failover", "logs", "config"]


@pytest.mark.parametrize("name", ENDPOINTS)
def test_get_endpoints_respond_and_keep_recorded_data_historical(client, name):
    response = client.get(f"/api/{name}")
    assert response.status_code == 200
    body = response.json()
    if name == "health":
        assert body["read_only"] is True and body["live_telemetry"] is True
    elif name == "config":
        assert body["read_only"] is True and body["live_telemetry"] is True
        assert "/api/benchmarks" in body["endpoints"]
    else:
        assert body["data_source"]["live_telemetry"] is False
        assert body["generated_at"]


def test_latest_benchmarks_are_selected_from_validated_actual_datasets(client):
    response = client.get("/api/benchmarks?include_trials=true")
    assert response.status_code == 200
    body = response.json()
    latest = body["latest"]
    modes = {mode["id"]: mode for mode in latest["modes"]}
    assert set(modes) == {"M0", "P1", "P2"}
    assert latest["run_date"] is None  # They were recorded in distinct sessions.
    assert "separate sessions" in latest["dataset_note"]
    assert modes["M0"]["run_date"] == "2026-11-21"
    assert modes["P1"]["run_date"] == modes["P2"]["run_date"] == "2026-11-22"
    assert all(mode["validation_status"] == "validated" for mode in modes.values())
    assert all(mode["trials"] == 30 and mode["transmitted"] == 30000 and mode["received"] == 30000 for mode in modes.values())
    assert modes["M0"]["mean_trial_avg_rtt_ms"] == pytest.approx(0.0232333333)
    assert modes["M0"]["max_rtt_ms"] == pytest.approx(2.578)
    assert modes["P1"]["mean_trial_avg_rtt_ms"] == pytest.approx(0.0113333333)
    assert modes["P1"]["max_rtt_ms"] == pytest.approx(0.448)
    assert modes["P2"]["mean_trial_avg_rtt_ms"] == pytest.approx(0.0136)
    assert modes["P2"]["max_rtt_ms"] == pytest.approx(0.998)
    assert all(len(mode["trial_rows"]) == 30 for mode in modes.values())
    assert latest["summary_file_check"] is None  # No shared summary exists for these separate sessions.
    assert body["earlier_run"]["run_id"] == "20261031"
    assert body["earlier_run"]["summary_file_check"]["matches"] is True
    assert "descriptive" in body["notes"][1]


def test_failover_uses_latest_controlled_recovery_session_and_exact_timestamps(client):
    response = client.get("/api/failover")
    assert response.status_code == 200
    body = response.json()
    assert body["measurement_scope"] == "single_trial"
    assert body["source_log"] == "src/results/recovery_20261122/M2_RECOVERY_SESSION.log"
    assert body["runs_in_log"] == 1 and body["recovered_runs"] == 1
    assert body["failure_link"] == "R2-R5" and body["detection_threshold"] == 3
    head = body["headline_trial"]
    assert head["run_start"] == "2026-11-21 19:53:58.381"
    assert head["verification"]["transmitted"] == 5 and head["verification"]["received"] == 5
    assert head["verification"]["packet_loss_percent"] == 0
    assert head["verification"]["rtt_avg_ms"] == pytest.approx(.265)
    assert head["route_verified"] == "2026-11-21 19:54:41.596"
    metrics = head["metrics"]
    assert metrics["detection_time_s"] == pytest.approx(5.25)
    assert metrics["path_installation_time_s"] == pytest.approx(.244)
    assert metrics["failover_to_route_verified_s"] == pytest.approx(.329)
    assert metrics["installation_to_route_verified_s"] == pytest.approx(.085)
    assert metrics["first_fail_to_install_s"] == pytest.approx(5.493)
    assert metrics["first_fail_to_recovery_s"] == pytest.approx(10.807)
    assert metrics["install_to_recovery_s"] == pytest.approx(5.313)
    assert {event["kind"] for event in head["events"]} >= {"probe_failed", "failover_started", "p2_installed", "route_verified", "recovery_verified"}
    assert body["summary_file_check"] is None  # Approximate report values are not used as exact checks.


def test_topology_and_steering_are_parsed_from_linux_scripts(client):
    topology = client.get("/api/topology").json()
    steering = client.get("/api/steering").json()
    assert [node["id"] for node in topology["nodes"]] == ["S", "R1", "R2", "R3", "R4", "R5", "D"]
    paths = {path["id"]: path for path in steering["paths"]}
    assert paths["P1"]["nodes"] == ["S", "R1", "R2", "R5", "D"]
    assert paths["P2"]["nodes"] == ["S", "R1", "R3", "R4", "R5", "D"]
    assert paths["P1"]["segments"] == ["fc00:0:2::1", "fc00:0:5::d6"]
    assert topology["failure_link"] == "R2-R5"
    assert [link["id"] for link in topology["links"] if link["failure_link"]] == ["r2-r5"]
    assert {node["id"]: node["sid_behavior"] for node in topology["nodes"] if node["sid"]} == {
        "R2": "End", "R3": "End", "R4": "End", "R5": "End.DT6"
    }
    assert all(link["status"] == "unknown" for link in topology["links"])


def test_live_monitor_is_enabled_by_default_and_does_not_affect_historical_api(client, monkeypatch):
    monkeypatch.delenv("AIORI_LIVE_MONITORING", raising=False)
    response = client.get("/api/live/status")
    assert response.status_code == 200
    body = response.json()
    assert body["enabled"] is True
    assert body["status"] != "disabled"
    assert client.get("/api/benchmarks").json()["latest"]["modes"]


def test_routing_modes_and_overview_include_per_mode_dates(client):
    routing = client.get("/api/routing-modes").json()
    overview = client.get("/api/overview").json()
    assert [mode["id"] for mode in routing["modes"]] == ["M0", "M1-P1", "M1-P2", "M2"]
    assert [path["id"] for path in routing["paths"]] == ["P1", "P2"]
    assert overview["experiment_dates"]["benchmark_M0"] == "2026-11-21"
    assert overview["experiment_dates"]["benchmark_P1"] == "2026-11-22"
    assert overview["experiment_dates"]["benchmark_P2"] == "2026-11-22"
    assert "separate sessions" in routing["interpretation_note"]
    assert overview["data_source"]["kind"] == "historical"


def test_logs_include_validated_benchmarks_and_controlled_m2_events(client):
    body = client.get("/api/logs?limit=500").json()
    assert body["returned"] == len(body["entries"])
    ids = {entry["id"] for entry in body["entries"]}
    assert {"rec-benchmark-m0", "rec-benchmark-p1", "rec-benchmark-p2"} <= ids
    assert any(entry["category"] == "M2" and "route verified" in entry["message"].lower() for entry in body["entries"])
    stamps = [entry["timestamp"] for entry in body["entries"] if entry["timestamp"]]
    sort_keys = [(stamp if len(stamp) > 10 else f"{stamp} 00:00:00").ljust(23, "0") for stamp in stamps]
    assert sort_keys == sorted(sort_keys, reverse=True)
    filtered = client.get("/api/logs?severity=error&category=M2").json()
    assert all(entry["severity"] == "error" and entry["category"] == "M2" for entry in filtered["entries"])
    assert client.get("/api/logs?limit=0").status_code == 422
    assert client.get("/api/logs?severity=bogus").status_code == 422


def test_missing_result_and_script_directories_degrade_without_fake_values(client, src, monkeypatch):
    monkeypatch.setenv("AIORI_DATA_DIR", str(src / "no-results"))
    assert client.get("/api/health").json()["status"] == "degraded"
    benchmarks = client.get("/api/benchmarks").json()
    assert benchmarks["latest"] is None and benchmarks["data_source"]["kind"] == "unavailable"
    assert benchmarks["warnings"]
    failover = client.get("/api/failover").json()
    assert failover["measurement_scope"] == "none" and failover["headline_trial"] is None
    assert client.get("/api/overview").status_code == 200
    assert client.get("/api/logs").status_code == 200
    monkeypatch.setenv("AIORI_SCRIPTS_DIR", str(src / "missing-scripts"))
    topo = client.get("/api/topology").json()
    assert topo["nodes"] == [] and topo["paths"] == [] and topo["warnings"]


def test_invalid_latest_csv_is_not_silently_replaced_by_older_run(client, src):
    path = src / "results/recovery_20261122/p1_benchmark_revalidated.csv"
    lines = path.read_text().splitlines()
    lines[1] = "1,1000,1000,900,0%,1006,0.004,0.014,0.205,0.016"  # Recorded loss disagrees with tx/rx.
    lines[2] = "2,1000"
    path.write_text("\n".join(lines) + "\n")
    body = client.get("/api/benchmarks").json()
    modes = {mode["id"] for mode in body["latest"]["modes"]}
    assert "P1" not in modes and {"M0", "P2"} <= modes
    assert any("P1" in warning or "p1_benchmark_revalidated.csv" in warning for warning in body["warnings"])
    assert body["earlier_run"]["run_id"] == "20261031"  # Older data remains visibly separate.


def test_nul_padding_and_corrupt_files_are_handled_without_crashing(client, src):
    bad_csv = src / "results/final/m0_benchmark_20261121.csv"
    bad_csv.write_text("")
    current_log = src / "results/recovery_20261122/M2_RECOVERY_SESSION.log"
    current_log.write_bytes(b"\x00\xff\xfe invalid\x00\n" * 50)
    assert client.get("/api/benchmarks").status_code == 200
    failover = client.get("/api/failover").json()
    assert failover["measurement_scope"] == "none" and failover["headline_trial"] is None
    assert failover["warnings"]
    assert client.get("/api/overview").status_code == 200
    assert client.get("/api/logs").status_code == 200


def test_nul_padded_current_log_still_parses(client, src):
    path = src / "results/recovery_20261122/M2_RECOVERY_SESSION.log"
    path.write_bytes(path.read_bytes().replace(b"\n", b"\n\x00\x00", 3))
    body = client.get("/api/failover").json()
    assert body["headline_trial"]["metrics"]["first_fail_to_recovery_s"] == pytest.approx(10.807)


@pytest.mark.parametrize("method", ["post", "put", "patch", "delete"])
@pytest.mark.parametrize("name", ENDPOINTS)
def test_api_has_no_write_methods(client, method, name):
    assert getattr(client, method)(f"/api/{name}").status_code == 405


def test_no_command_or_arbitrary_file_endpoints(client):
    paths = set(client.get("/openapi.json").json()["paths"])
    assert paths == {f"/api/{name}" for name in ENDPOINTS} | {"/api/live/status"}
    for path in ("/api/run", "/api/exec", "/api/files?path=../../etc/passwd", "/api/logs/../../etc/passwd"):
        assert client.get(path).status_code in (404, 405)


def test_cors_allows_configured_dashboard_origins_only(client):
    response = client.get("/api/health", headers={"Origin": "http://localhost:5173"})
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    denied = client.get("/api/health", headers={"Origin": "http://evil.example"})
    assert "access-control-allow-origin" not in denied.headers
    preflight = client.options("/api/health", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"})
    assert preflight.status_code == 200
    post = client.options("/api/health", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"})
    assert post.status_code == 400


def test_unhandled_error_does_not_expose_internals(client, monkeypatch):
    from app.services import overview
    monkeypatch.setattr(overview, "build", lambda settings: (_ for _ in ()).throw(RuntimeError("secret /home/user/file")))
    response = client.get("/api/overview")
    assert response.status_code == 500
    assert "secret" not in response.text and "/home" not in response.text


def test_legacy_summary_crosscheck_is_available_when_legacy_log_is_selected(src):
    from app.config import load_settings
    from app.services.failover import build
    path = src / "results/m2/failover_summary.txt"
    path.write_text(path.read_text().replace("11.405", "99.999"))
    settings = replace(load_settings(), m2_log_candidates=("m2/failover_success_20261030.log",))
    response = build(settings)
    assert response.summary_file_check is not None
    assert response.summary_file_check.matches is False
