# Project Apollo

Screenplay knowledge graph system for AI-assisted narrative development.

## Requirements

- Node.js 20+
- npm 10+

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables and set at least one AI provider key:

```bash
cp .env.example .env
```

3. Start the API and UI together:

```bash
npm run dev
```

Services:

- UI: `http://localhost:5173`
- API: `http://localhost:3000`
- API health check: `http://localhost:3000/health`

Notes:

- The UI lives in `packages/ui`.
- `packages/web` is an older placeholder package and is not the active frontend.
- The root `dev` script performs an initial build for the API packages, then runs the API in watch mode alongside the Vite UI dev server.

## Other Commands

```bash
npm run build
npm run test
npm run typecheck
npm run lint
```
