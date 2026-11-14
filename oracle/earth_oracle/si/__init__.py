"""Agua Clara SI engine.

Four modules, matching the Field Shift challenge brief:
  1. compare   — water, soil and income for the existing rotation and three alternatives
  2. tradeoffs — weighted, Pareto-aware ranking from the farmer's own priorities
  3. risk      — month × hazard grid (frost, heat, water deficit, bare soil, salinity)
  4. uncertainty — Monte Carlo p10/p50/p90, rank stability and what drives the spread

Plus an SI water-use model (physics vs linear vs gradient-boosting quantiles) that fills
ECOSTRESS gaps and calibrates the physics, and CERES, the voice that explains it all.
"""

AGENT_NAME = "CERES"
