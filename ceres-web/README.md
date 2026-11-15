# ceres-web: Ceres Ventures website

Landing (`/`), Google Maps field dashboard (`/app/`), judge x402 page (`/pagar/`), API docs (`/api-docs/`), record check (`/verify/`),
and the x402 field API as a Netlify Function (`/v1/*`, `/health`). Full design: `../space-apps-2026/mentor/ceres-system-design.md`.

```bash
npm ci
npm run build              # → dist/ (publish dir) + netlify/functions/_x402/ (function bundle)
node scripts/serve.mjs     # → http://localhost:8888, static + function, like Netlify
```

The Maps key is read at build from `GOOGLE_MAPS_API_KEY` (env), `.env.local` (gitignored) or `../space-apps-2026/.secrets/google-maps.env`,
and written only into `dist/assets/config.js`. It is a browser key: restrict it by HTTP referrer in Google Cloud.

## Deploy (Chris approves)

```bash
npx netlify-cli login
npx netlify-cli link --id 50fa1f38-e2e8-4b7c-97bc-fd1d613720eb       # gleaming-sunflower-16cdde
npx netlify-cli deploy --dir dist --functions netlify/functions      # draft URL: review it
npx netlify-cli deploy --dir dist --functions netlify/functions --prod   # replaces the live site
```

Netlify env vars: `GOOGLE_MAPS_API_KEY`, `X402_PAY_TO`, `FACILITATOR_PRIVATE_KEY` (secret), `WATERPROOF_REGISTRY`, optional
`GOOGLE_MAPS_MAP_ID`, `ALLOWED_ORIGINS`. Without them the site still works; paid routes answer 503 with the reason.

Drag-and-drop of `dist/` also works for everything except `/v1/*` (Drop does not deploy functions).

After anchoring a month on Fuji, add it to `attestations.json` and rebuild.
