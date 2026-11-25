import json
import subprocess

from app.config import load_settings
from app.services import live_monitor


def test_live_monitor_reads_namespaces_and_sends_one_icmp_probe(monkeypatch, src):
    monkeypatch.setenv("AIORI_LIVE_MONITORING", "true")
    monkeypatch.setattr(live_monitor.platform, "system", lambda: "Linux")
    monkeypatch.setattr(live_monitor.shutil, "which", lambda name: f"/usr/bin/{name}" if name in {"ip", "ping"} else None)
    namespaces = "s\nr1\nr2\nr3\nr4\nr5\nd\n"
    interfaces = {
        "s": ["s-r1"], "r1": ["r1-r2", "r1-r3", "r1-s"], "r2": ["r2-r1", "r2-r5"],
        "r3": ["r3-r1", "r3-r4"], "r4": ["r4-r3", "r4-r5"], "r5": ["r5-r2", "r5-r4", "r5-d"], "d": ["d-r5"],
    }
    commands: list[list[str]] = []

    def fake_run(args, timeout=1.5):
        commands.append(args)
        if args[1:3] == ["netns", "list"]:
            return subprocess.CompletedProcess(args, 0, namespaces, "")
        if args[1:4] == ["-j", "-n", "s"] or (len(args) > 3 and args[1] == "-j" and args[2] == "-n"):
            name = args[3]
            if args[-2:] == ["link", "show"]:
                payload = [{"ifname": item, "operstate": "UP", "flags": ["BROADCAST", "UP", "LOWER_UP"]} for item in interfaces[name]]
                return subprocess.CompletedProcess(args, 0, json.dumps(payload), "")
            if "route" in args:
                return subprocess.CompletedProcess(args, 0, "[]", "")
        if args[1:3] == ["netns", "exec"]:
            assert args[3] == "s" and "-c" in args and args[args.index("-c") + 1] == "1"
            return subprocess.CompletedProcess(args, 0, "64 bytes from fc00:b::1: time=0.123 ms\n1 packets transmitted, 1 received, 0% packet loss", "")
        raise AssertionError(f"Unexpected command: {args}")

    monkeypatch.setattr(live_monitor, "_run", fake_run)
    result = live_monitor.build(load_settings(), force=True)
    assert result.status == "available"
    assert len(result.namespaces) == 7
    assert all(link.status == "up" for link in result.links)
    assert result.probe.status == "success"
    assert result.probe.packets_sent == result.probe.packets_received == 1
    assert result.probe.rtt_ms == 0.123
    assert all(isinstance(command, list) for command in commands)
    assert not any("bash" in command or "sh" in command for command in commands)
