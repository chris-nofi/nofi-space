"""Create (or update) the CERES voice agent in Retell, pointing at this oracle's WebSocket.

usage:
  export RETELL_API_KEY=key_...            # server-side secret, never in the frontend
  export PUBLIC_WSS_URL=wss://oracle.example.com   # where the oracle is reachable from the internet
  export RETELL_VOICE_ID=...               # pick a Spanish (Latin America) voice in the Retell dashboard
  python scripts/retell_setup.py [--agent-id agent_xxx]   # --agent-id updates an existing agent

Then put the printed agent id in web/.env as VITE_RETELL_AGENT_ID, and a Retell *public* key
(allowed for your domain + localhost) as VITE_RETELL_PUBLIC_KEY.
Docs: https://docs.retellai.com/api-references/create-agent
"""
from __future__ import annotations

import argparse
import os
import sys

import requests

API = "https://api.retellai.com"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--agent-id", help="update this agent instead of creating a new one")
    a = ap.parse_args()

    key = os.getenv("RETELL_API_KEY")
    wss = (os.getenv("PUBLIC_WSS_URL") or "").rstrip("/")
    voice = os.getenv("RETELL_VOICE_ID")
    if not (key and wss and voice):
        sys.exit("set RETELL_API_KEY, PUBLIC_WSS_URL and RETELL_VOICE_ID")
    if not wss.startswith("wss://"):
        sys.exit("PUBLIC_WSS_URL must start with wss:// (Retell connects over TLS)")

    body = {
        "agent_name": "CERES · CERES Ventures (NOFI Labs)",
        "voice_id": voice,
        "language": os.getenv("RETELL_LANGUAGE", "es-419"),  # Spanish, Latin America (no Peru-specific code)
        "response_engine": {"type": "custom-llm", "llm_websocket_url": f"{wss}/v1/ceres/retell"},
    }
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    if a.agent_id:
        r = requests.patch(f"{API}/update-agent/{a.agent_id}", json=body, headers=headers, timeout=30)
    else:
        r = requests.post(f"{API}/create-agent", json=body, headers=headers, timeout=30)
    if r.status_code >= 300:
        sys.exit(f"Retell error {r.status_code}: {r.text}")
    agent = r.json()
    print("agent_id:", agent.get("agent_id"))
    print("websocket:", body["response_engine"]["llm_websocket_url"] + "/{call_id}")
    print("Next: set VITE_RETELL_AGENT_ID in web/.env, then test in the Retell dashboard (Test Audio).")


if __name__ == "__main__":
    main()
