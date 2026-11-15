# 13b · Public vs paid data boundary (CERES web + x402)

Branch: `feat/ceres-commercial-data-boundary` (based on `feat/ceres-branding`, which is based on `feat/ceres-web-integration`).
Status: implemented and tested locally. **Not deployed.** Both live Netlify sites still build `feat/ceres-web-integration`.

## 1. What changed and why

Before this change the public build copied every canonical evidence record (the hash preimage anchored in
`WaterProofRegistry`) to `/data/evidence/*.json` and `/legacy/evidence/*.json`, linked them from `/verify/`, and the
legacy bundles embedded granule / Sentinel-2 item / HLS scene IDs. Anyone could download the same bytes the x402
Evidence API sells. The leak audit run against a build of the live branch reports 76 failures in 28 public files
(`ceres-web/.audit/before-after.json`, regenerated locally).

Now:

```text
canonical evidence (avalanche/oracle/evidence or CERES_EVIDENCE_DIR)
        │  exact sha256(canon(record)) — unchanged
        ├──────────────► Netlify Function bundle (server-only demo packaging, never in dist/)
        │                   /v1/* : 402 → verify → settle → 200 (full record + dataHash + proof + receipt)
        └──► build: ceres-public-summary.v1 (ALLOWLIST) ──► dist/data/public/summaries.json ──► free site
                                                            dist/data/index.json (farm, period, dataHash only)
build guard: scripts/audit-public.mjs scans every public file; any canonical record, provenance ID, evidence note,
evidence directory, source map or secret → build fails and dist/ is deleted.
```

## 2. Data matrix (after)

| Data | Where | Access |
|---|---|---|
| Headline score, confidence, component display values (0–100), missing components, confidence reasons, gaps, dataset labels (name + resolution), disclaimer | `/data/public/summaries.json` | Free |
| `farmId`, `period`, `dataHash`, attestation tx/block | `/data/index.json`, summaries | Free (public verification handle) |
| Strategy model (4 options, texts, modeled water m³/ha/yr, soil/income indices, default priorities, engine pick) | `/data/strategies.json` | Free (farmer tool). Monthly water series removed (unused). |
| Season strip: 12 monthly Sentinel-2 NDVI medians, bare threshold, frost climatology | `/data/season.json` | Free (farmer tool). Observation counts removed (unused). |
| Field marker coordinates, labels, crop, ha, elevation | `/data/farms.json` | Free (map) |
| Legacy dashboard derived climatology / model outputs and headline indicator values (value, dataset, scale, stat) | `/legacy/*.js` | Free, sanitized at build: no granules, items, scenes, evidence file links |
| Paid score: component **inputs**, **weights**, sub-scores, notes + proof + receipt | `GET /v1/field/:id/score` | x402 (0.02 test USDC) |
| **Complete canonical evidence record** (indicators with granules/pixels/methods, `_context`, engine, extensions as packaged) + dataHash + proof + receipt | `GET /v1/field/:id/evidence`, alias `/v1/earth/:farm/:period` | x402 (0.05 test USDC) |
| `/v1/farms`, `/health` | Function | Free, sanitized (no evidence, no secrets) |

**Honest overlap.** Several values inside a full record are also public in summary form (e.g. the month's NDVI
median in the season strip, headline indicator values in the legacy dashboard, soil/frost context). What is sold is
the complete, canonical, provenance-carrying package whose hash is anchored on-chain, delivered on demand with a
payment receipt, not exclusive access to NASA numbers.

## 3. Limits that do not go away

- The 12 current records are **already public**: they are in this public Git repository (`avalanche/oracle/evidence/`)
  and in past Netlify deploys and caches. This change stops the *current* site from distributing them; it does not
  make them private. Do not describe them as exclusive.
- `field-score.mjs` (the formula) is open source. The browser no longer downloads it, but it is not a secret.
- The registry proves **integrity of the attested bytes**, not that the measurements are scientifically correct.
- Prices are Fuji **testnet demo** amounts in test USDC. Commercial pricing is not set.

## 4. The on-chain URI of algarrobal/202610

The anchored attestation (tx `0x9bd56d2d…9f21`) records the URI
`https://ceres-ventures-preview.netlify.app/data/evidence/algarrobal-202610.json`. After release that URL answers
**410** with a bilingual page (`/evidence-moved/`) that explains the Evidence API and the free hash check. The
`dataHash` is unaffected. If the owner wants the URI itself to point elsewhere, a revision-1 attestation can correct it;
that is an on-chain write and needs owner approval.

## 5. Future private records (P2)

1. Keep new commercial evidence **outside this repo** (private repo or object store). Build with
   `CERES_EVIDENCE_DIR=/path/to/private/evidence`; the build fails if the directory is missing or has no real records.
2. In Netlify, run the build from a private source or fetch the records at build time with a token held in Netlify
   env vars (never in Git). The function bundle is generated into `netlify/functions/_x402/` (gitignored) and is
   server-only.
3. Next step when volume grows: move the function's evidence source to Netlify Blobs (server-side read) instead of
   bundling; public summaries stay a build artifact.
4. CI uses the already-public demo records; never substitute fabricated "real-looking" data.

## 6. Tests

```bash
cd avalanche && forge test                      # 28/28
cd avalanche/x402 && npm ci && npm test         # 27/27 (10 boundary tests + anvil e2e + score)
cd ceres-web && npm ci && npm test              # 8/8 (fresh guarded build + leak audit + negative controls + function wrapper)
```

The x402 boundary tests prove: anonymous → 402 with no premium bytes on every paid route; malformed / invalid /
settlement-failed / crashed paths fail closed; a settled payment returns the exact record whose hash equals the
on-chain value; replay and concurrent reuse of one authorization serve at most once; `no-store` on every response;
tamper test (one changed field breaks the hash). End-to-end on real Fuji: owner payment settled in tx
`0xb461ca0ec62f5aedcf81cafd9f9afade107f6eb0e6cc3943b1ce7d9e1df6ba09` (block 61089659, 0.05 test USDC to the treasury).

## 7. Release checklist (owner approval required)

1. Enable **form detection** on both Netlify sites (Forms → enable) so the enterprise inquiry form is processed.
   Until then the form shows an error state, never a false success.
2. Merge `feat/ceres-commercial-data-boundary` into `feat/ceres-web-integration` (this also brings the branding
   commit). Both sites rebuild automatically.
3. Verify **both** sites: `curl -I` each old URL (`/data/evidence/algarrobal-202610.json`,
   `/legacy/evidence/algarrobal-202610.json`) → 410 page, not JSON; anonymous `/v1/field/algarrobal/evidence` → 402;
   `/app/`, `/verify/<hash>`, `#pricing` EN/ES render; submit one test inquiry and confirm it appears in Netlify Forms.
4. Old deploy permalinks (`<deploy-id>--site.netlify.app`) still serve the old files. Delete or lock old deploys in
   Netlify if needed; this does not revoke copies already downloaded.

## 8. Rollback

Reverting the merge restores the public evidence files (it re-publishes the leak). Prefer a forward fix. If a rollback
is unavoidable, accept that `/data/evidence/*` becomes public again and re-apply this change as soon as possible.
