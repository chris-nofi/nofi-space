"""CERES — conversational voice of the CERES Ventures SI engine.

One brain, two channels:
  * text  — POST /v1/ceres/chat (Claude Sonnet 5.5 by default)
  * voice — Retell custom-LLM WebSocket /v1/ceres/retell/{call_id} (Claude Haiku 5.5 by default)

CERES is not fine-tuned. It is grounded: a knowledge pack (knowledge/*.md) in the system
prompt plus live tools that call the SI engine, so every farm number comes from the engine.
"""
