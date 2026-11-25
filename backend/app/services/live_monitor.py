"""Optional passive Linux namespace inspection plus one low-rate ICMP probe.

Only fixed `ip` and `ping` read/probe commands are used. No shell, scripts, route
changes, interface changes, or failure injection are permitted here.
"""
from __future__ import annotations

import json
import platform
import re
import shutil
import subprocess
import time
from typing import Any

from ..config import Settings
from ..schemas import LiveInterface, LiveLink, LiveMonitoringResponse, LiveNamespace, LiveProbe
from .data_reader import utc_now
from .topology import build as build_topology

_CACHE: tuple[float, LiveMonitoringResponse] | None = None
_CACHE_SECONDS = 8
_RTT = re.compile(r"time[=<]([0-9.]+)\s*ms", re.I)
_PACKETS = re.compile(r"(\d+)\s+packets transmitted,\s*(\d+)\s+(?:packets )?received", re.I)


def _run(args: list[str], timeout: float = 0.5) -> subprocess.CompletedProcess[str]:
    """Run a fixed argument vector without a shell and capture bounded output."""
    return subprocess.run(args, capture_output=True, text=True, timeout=timeout, check=False)


def _json_output(result: subprocess.CompletedProcess[str]) -> list[dict[str, Any]] | None:
    if result.returncode != 0:
        return None
    try:
        value = json.loads(result.stdout)
        return value if isinstance(value, list) else None
    except (json.JSONDecodeError, TypeError):
        return None


def _disabled() -> LiveMonitoringResponse:
    return LiveMonitoringResponse(
        enabled=False, status="disabled", generated_at=utc_now(),
        probe=LiveProbe(status="not_run", message="Live monitoring is disabled. Set AIORI_LIVE_MONITORING=true on the Linux backend."),
    )


def build(settings: Settings, *, force: bool = False) -> LiveMonitoringResponse:
    global _CACHE
    if not settings.live_monitoring_enabled:
        return _disabled()
    now = time.monotonic()
    if not force and _CACHE and now - _CACHE[0] < _CACHE_SECONDS:
        return _CACHE[1]
    if platform.system() != "Linux":
        return LiveMonitoringResponse(
            enabled=True, status="unavailable", generated_at=utc_now(),
            probe=LiveProbe(status="unavailable", message="Live namespace monitoring requires Linux; recorded results remain available."),
            warnings=["The backend host is not Linux."],
        )
    ip = shutil.which("ip")
    ping = shutil.which("ping") or shutil.which("ping6")
    if not ip:
        return LiveMonitoringResponse(
            enabled=True, status="unavailable", generated_at=utc_now(),
            probe=LiveProbe(status="unavailable", message="The iproute2 `ip` utility is not available on the backend host."),
            warnings=["Install iproute2 on the Linux backend host to inspect namespaces."],
        )

    topology = build_topology(settings)
    warnings: list[str] = []
    try:
        ns_result = _run([ip, "netns", "list"])
    except (OSError, subprocess.TimeoutExpired):
        ns_result = None
    if ns_result is None or ns_result.returncode != 0:
        response = LiveMonitoringResponse(
            enabled=True, status="unavailable", generated_at=utc_now(),
            probe=LiveProbe(status="unavailable", message="Could not read the Linux network namespace list; check backend permissions."),
            warnings=["Namespace inspection failed or timed out."],
        )
        _CACHE = (time.monotonic(), response)
        return response
    present = {line.split()[0] for line in ns_result.stdout.splitlines() if line.split()}

    namespaces: list[LiveNamespace] = []
    interfaces_by_namespace: dict[str, dict[str, bool | None]] = {}
    available_count = 0
    for node in topology.nodes:
        name = node.namespace
        # Script parsing supplies names, but only conservative Linux ns tokens are passed to exec.
        if not re.fullmatch(r"[a-z][a-z0-9_]{0,14}", name):
            warnings.append(f"Skipped invalid namespace identifier for node {node.id}.")
            namespaces.append(LiveNamespace(name=name, status="unavailable"))
            interfaces_by_namespace[name] = {}
            continue
        if name not in present:
            namespaces.append(LiveNamespace(name=name, status="missing"))
            interfaces_by_namespace[name] = {}
            continue
        try:
            link_result = _run([ip, "-j", "-n", name, "link", "show"])
            route_result = _run([ip, "-j", "-n", name, "-6", "route", "show"])
        except (OSError, subprocess.TimeoutExpired):
            namespaces.append(LiveNamespace(name=name, status="unavailable"))
            interfaces_by_namespace[name] = {}
            warnings.append(f"Live inspection timed out for namespace {name}.")
            continue
        raw_links = _json_output(link_result)
        raw_routes = _json_output(route_result)
        if raw_links is None:
            namespaces.append(LiveNamespace(name=name, status="unavailable"))
            interfaces_by_namespace[name] = {}
            warnings.append(f"Could not read interfaces in namespace {name}; check capabilities." )
            continue
        interfaces: list[LiveInterface] = []
        interface_map: dict[str, bool | None] = {}
        for item in raw_links:
            if item.get("ifname") == "lo":
                continue
            flags = item.get("flags") or []
            state = str(item.get("operstate") or "UNKNOWN").upper()
            up = state == "UP" and "UP" in flags and "LOWER_UP" in flags
            interfaces.append(LiveInterface(name=str(item.get("ifname", "unknown")), state=state, up=up))
            interface_map[str(item.get("ifname", ""))] = up
        routes: list[str] = []
        for route in raw_routes or []:
            parts = [str(route.get(k)) for k in ("dst", "gateway", "dev") if route.get(k)]
            if parts:
                routes.append(" ".join(parts))
        namespaces.append(LiveNamespace(name=name, status="available", interfaces=interfaces, ipv6_routes=routes))
        interfaces_by_namespace[name] = interface_map
        available_count += 1

    live_links: list[LiveLink] = []
    for link in topology.links:
        left, right = link.a.lower(), link.b.lower()
        if left not in present or right not in present:
            status = "down"
        elif left not in interfaces_by_namespace or right not in interfaces_by_namespace:
            status = "unknown"
        else:
            a_state = interfaces_by_namespace[left].get(f"{left}-{right}")
            b_state = interfaces_by_namespace[right].get(f"{right}-{left}")
            status = "up" if a_state is True and b_state is True else "down" if a_state is False or b_state is False else "unknown"
        live_links.append(LiveLink(id=link.id, a=link.a, b=link.b, status=status))

    destination = topology.destination
    probe = LiveProbe(status="unavailable", destination=destination, message="ICMP probe unavailable.")
    if not ping:
        probe.message = "Live interface status is available, but ping/ping6 is not installed."
        warnings.append("Install iputils-ping to enable the single low-rate ICMP reachability/RTT probe.")
    elif "s" not in present:
        probe.message = "Source namespace s is missing; no ICMP probe was sent."
    elif not destination:
        probe.message = "Destination address is unavailable from repository configuration; no ICMP probe was sent."
    else:
        try:
            result = _run([ip, "netns", "exec", "s", ping, "-6", "-n", "-c", "1", "-W", "1", destination], timeout=2.5)
            output = f"{result.stdout}\n{result.stderr}"
            if result.returncode != 0 and re.search(r"operation not permitted|permission denied|socket:.*not permitted", output, re.I):
                probe = LiveProbe(destination=destination, status="unavailable", message="ICMPv6 probe permission is unavailable; no packet result is reported.")
                warnings.append("Grant the backend process permission to send ICMPv6 probes (for example, run it with appropriate Linux capabilities).")
                result = None
            if result is None:
                pass
            else:
                counts = _PACKETS.search(output)
                sent, received = (int(counts.group(1)), int(counts.group(2))) if counts else (1, 1 if result.returncode == 0 else 0)
                rtt_match = _RTT.search(output)
                probe = LiveProbe(
                    destination=destination, status="success" if result.returncode == 0 else "unreachable",
                    packets_sent=sent, packets_received=received,
                    packet_loss_percent=(100.0 * (sent - received) / sent) if sent else None,
                    rtt_ms=float(rtt_match.group(1)) if rtt_match else None,
                    message="One ICMPv6 probe was sent from namespace s." if result.returncode == 0 else "The single ICMPv6 probe did not receive a reply.",
                )
        except subprocess.TimeoutExpired:
            probe = LiveProbe(destination=destination, status="timeout", packets_sent=1, packets_received=0, packet_loss_percent=100.0, message="The one-packet ICMPv6 probe timed out after 2.5 seconds.")
        except OSError:
            probe = LiveProbe(destination=destination, status="unavailable", message="Could not execute the ICMPv6 probe on the backend host.")

    state = "available" if available_count == len(topology.nodes) and probe.status in {"success", "unreachable"} else "partial" if available_count or probe.status in {"success", "unreachable"} else "unavailable"
    response = LiveMonitoringResponse(enabled=True, status=state, generated_at=utc_now(), namespaces=namespaces, links=live_links, probe=probe, warnings=warnings)
    _CACHE = (time.monotonic(), response)
    return response
