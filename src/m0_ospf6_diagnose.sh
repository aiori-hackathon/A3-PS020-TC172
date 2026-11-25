#!/usr/bin/env bash
# Safe, read-only diagnostics for NetNova M0 OSPF6.
set -u

FRR=/usr/lib/frr
BASE=${1:-$HOME/NetNova/src}
CFG="$BASE/configs/m0"
ROUTERS=(r1 r2 r3 r4 r5)

section(){ printf '\n===== %s =====\n' "$*"; }

section "NetNova M0 OSPF6 read-only diagnostic"
printf 'Project path: %s\n' "$BASE"
printf 'Timestamp: '; date

section "Namespaces"
ip netns list

for r in "${ROUTERS[@]}"; do
  section "$r: interfaces and addresses"
  ip netns exec "$r" ip -br link 2>&1 || true
  ip netns exec "$r" ip -6 -br addr 2>&1 || true
  ip netns exec "$r" ip -6 route 2>&1 || true

  section "$r: FRR process check"
  ps -ww -eo pid,stat,args | grep -E "/usr/lib/frr/(zebra|ospf6d).* -N $r([[:space:]]|$)" | grep -v grep || echo "No matching daemon process found"

  section "$r: runtime sockets and pid files"
  ls -la "/run/frr/$r" 2>&1 || true

  section "$r: OSPF6 config file"
  if [[ -f "$CFG/$r/ospf6d.conf" ]]; then
    cat "$CFG/$r/ospf6d.conf"
  else
    echo "Missing: $CFG/$r/ospf6d.conf"
  fi

  section "$r: Zebra CLI"
  ip netns exec "$r" vtysh -N "$r" -d zebra -c "show version" 2>&1 || true
  ip netns exec "$r" vtysh -N "$r" -d zebra -c "show ipv6 route" 2>&1 || true

  section "$r: OSPF6 CLI"
  ip netns exec "$r" vtysh -N "$r" -d ospf6d -c "show version" 2>&1 || true
  ip netns exec "$r" vtysh -N "$r" -d ospf6d -c "show running-config" 2>&1 || true
  ip netns exec "$r" vtysh -N "$r" -d ospf6d -c "show ipv6 ospf6 neighbor" 2>&1 || true
  ip netns exec "$r" vtysh -N "$r" -d ospf6d -c "show ipv6 ospf6 interface" 2>&1 || true
  ip netns exec "$r" vtysh -N "$r" -d ospf6d -c "show ipv6 ospf6" 2>&1 || true
done

section "Kernel IPv6 forwarding and seg6 settings"
for r in "${ROUTERS[@]}"; do
  echo "--- $r ---"
  ip netns exec "$r" sysctl net.ipv6.conf.all.forwarding net.ipv6.conf.default.forwarding net.ipv6.conf.all.seg6_enabled 2>&1 || true
  ip netns exec "$r" sysctl net.ipv6.conf.all.accept_ra 2>&1 || true
done

section "Recent FRR/kernel messages"
journalctl --since "30 minutes ago" --no-pager 2>&1 | grep -iE 'ospf6d|ospf6|frr|zebra' | tail -n 250 || true
journalctl -k --since "30 minutes ago" --no-pager 2>&1 | grep -iE 'multicast|apparmor|frr|ospf|seg6' | tail -n 100 || true

section "Diagnostic complete"
echo "Read-only checks completed. No services, files, interfaces, or namespaces were changed."
