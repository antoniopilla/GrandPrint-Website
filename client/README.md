# GrandPrint — React Client

The customer ordering/payment UI and admin order workspace for GrandPrint. See the [project README](../README.md) for features, architecture, backend setup, environment requirements, deployment, and the order lifecycle.

## Local Development

Start the API using the root README, then run from this directory:

```bash
npm ci
cp .env.example .env
npm run dev
```

Copy the template only if `.env` does not already exist; in PowerShell, use `Copy-Item .env.example .env`. Vite's configured development port is `3000`. `VITE_API_URL` may be blank only for local development, which falls back to `http://localhost:5000`.

## Available Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start Vite development server |
| `npm run build` | Build production assets into `dist/` |
| `npm run preview` | Preview the built client locally |
| `npm run lint` | Run ESLint |

Builds and preview require an absolute HTTP(S) backend URL in `VITE_API_URL`; see [`.env.example`](.env.example). This is public browser configuration. The package has no `npm test` script; the backend regression command is documented in the [root scripts table](../README.md#available-scripts).
