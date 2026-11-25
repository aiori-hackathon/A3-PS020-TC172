#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

LOG="results/m2/controlled_failover.log"
mkdir -p results/m2
touch "$LOG"

failures=0
switched=0
start_time=$SECONDS
MAX_WAIT=120

echo "========================================" | tee -a "$LOG"
echo "M2 Controlled Monitor Started: $(date '+%F %T.%N')" | tee -a "$LOG"

while (( SECONDS - start_time < MAX_WAIT )); do
    timestamp=$(date '+%F %T.%N')

    if sudo ip netns exec s ping -6 -c 1 -W 1 fc00:b::1 >/dev/null 2>&1; then
        echo "$timestamp SUCCESS: Destination reachable" | tee -a "$LOG"
        failures=0
    else
        failures=$((failures + 1))
        echo "$timestamp FAILURE: Probe $failures/3" | tee -a "$LOG"
    fi

    if [[ "$failures" -ge 3 && "$switched" -eq 0 ]]; then
        echo "$(date '+%F %T.%N') FAILOVER: Installing P2" | tee -a "$LOG"

        if sudo bash scripts/31_m1_p2.sh 2>&1 | tee -a "$LOG"; then
            echo "$(date '+%F %T.%N') P2 INSTALL COMMAND COMPLETED" | tee -a "$LOG"

            route=$(sudo ip -n r1 -6 route get fc00:b::1 2>&1)
            echo "$route" | tee -a "$LOG"

            if echo "$route" | grep -q "fc00:0:3::1" && echo "$route" | grep -q "fc00:0:4::1" && echo "$route" | grep -q "fc00:0:5::d6"; then
                echo "$(date '+%F %T.%N') P2 ROUTE VERIFIED" | tee -a "$LOG"

                sleep 1

                if sudo ip netns exec s ping -6 -c 5 -W 1 fc00:b::1 2>&1 | tee -a "$LOG"; then
                    switched=1
                    echo "$(date '+%F %T.%N') RECOVERY SUCCESS: P2 route and connectivity verified" | tee -a "$LOG"
                    break
                else
                    echo "$(date '+%F %T.%N') RECOVERY FAILED: P2 connectivity test failed" | tee -a "$LOG"
                fi
            else
                echo "$(date '+%F %T.%N') ERROR: P2 route verification failed" | tee -a "$LOG"
            fi
        else
            echo "$(date '+%F %T.%N') ERROR: P2 installation failed" | tee -a "$LOG"
        fi
    fi

    sleep 1
done

if [[ "$switched" -eq 0 ]]; then
    echo "$(date '+%F %T.%N') TIMEOUT: Recovery not verified within ${MAX_WAIT}s" | tee -a "$LOG"
    exit 1
fi

echo "M2 Controlled Monitor Completed: $(date '+%F %T.%N')" | tee -a "$LOG"
