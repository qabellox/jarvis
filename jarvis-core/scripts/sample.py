"""Sample script executed by the JARVIS execute_python tool.

Proves the agent can drive real automation on the host machine.
"""
import json
import platform
import sys
import time

def main() -> int:
    started = time.time()
    payload = {
        "python": sys.version.split()[0],
        "platform": platform.system(),
        "machine": platform.machine(),
        "greeting": "Hello from JARVIS Core script executor",
    }
    if len(sys.argv) > 1:
        payload["args"] = sys.argv[1:]
    print(json.dumps(payload, indent=2))
    print(f"elapsed_ms={int((time.time() - started) * 1000)}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
