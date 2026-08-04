# RecoverKit

> Abandoned cart recovery SaaS — automated email & SMS sequences that bring customers back.

![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-20-339933?style=flat-square&logo=node.js&logoColor=white)
![Gadget.dev](https://img.shields.io/badge/Gadget.dev-backend-7C3AED?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

---

## Overview

RecoverKit is a multi-tenant SaaS application that helps e-commerce stores recover revenue from abandoned shopping carts. Stores connect via OAuth, and RecoverKit automatically detects abandoned carts, triggers personalized email/SMS sequences, and tracks recovered revenue — all from a single dashboard.

**Live demo:** [recoverkit.dev](https://recoverkit.dev) · **API docs:** [docs.recoverkit.dev](https://docs.recoverkit.dev)

---

## Features

- **Automated recovery flows** — configurable multi-step email + SMS sequences with delay rules
- **Real-time cart tracking** — webhook-based ingestion, stores cart state in Postgres
- **Revenue analytics** — per-store dashboard with recovery rate, AOV, and daily revenue charts
- **Audience segmentation** — target by cart value, product category, customer history
- **A/B testing** — split-test subject lines and send times, auto-promote the winner
- **Multi-store** — one account manages multiple stores with isolated data per tenant
- **Webhook delivery** — send recovered-cart events to any external system (Klaviyo, Slack, etc.)

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, TanStack Query, Recharts |
| Backend | Node.js 20, TypeScript, Gadget.dev (API + background jobs) |
| Database | PostgreSQL (via Gadget managed DB) |
| Auth | OAuth 2.0 (store connection) + JWT (user sessions) |
| Queues | Gadget background actions (retry + exponential backoff) |
| Email | Resend API |
| SMS | Twilio |
| Infra | Gadget.dev (serverless, auto-scaling) |
| Testing | Vitest, Testing Library, Playwright (E2E) |
| CI/CD | GitHub Actions → Gadget deploy |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Store webhook                      │
│         (cart/create, cart/update events)            │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│              Gadget.dev backend                      │
│                                                      │
│  ┌─────────────────┐    ┌────────────────────────┐  │
│  │  Webhook action  │───▶│  Cart state machine     │  │
│  │  (ingest event)  │    │  idle → abandoned →    │  │
│  └─────────────────┘    │  in-sequence → closed  │  │
│                          └──────────┬─────────────┘  │
│                                     │                 │
│  ┌──────────────────────────────────▼─────────────┐  │
│  │           Sequence scheduler (cron)             │  │
│  │   Evaluates delay rules, dispatches send jobs   │  │
│  └──────────────────────────────────┬─────────────┘  │
│                                     │                 │
│            ┌────────────────────────▼──────────────┐ │
│            │        Send action (background)        │ │
│            │   Resend (email) · Twilio (SMS)        │ │
│            └───────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│              React dashboard (Vite)                  │
│   TanStack Query ← Gadget client SDK ← REST/GraphQL │
└─────────────────────────────────────────────────────┘
```

---

## Getting started

### Prerequisites

- Node.js 20+
- A [Gadget.dev](https://gadget.dev) account
- A Resend API key
- A Twilio account (optional, for SMS)

### 1. Clone the repo

```bash
git clone https://github.com/youruser/recoverkit.git
cd recoverkit
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

```env
# .env
GADGET_APP_ID=your-app-id
GADGET_ENV=development

RESEND_API_KEY=re_...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1555...

WEBHOOK_SECRET=your-webhook-signing-secret
```

### 3. Run locally

```bash
# Start the Gadget dev tunnel + frontend
npm run dev
```

The dashboard will be available at `http://localhost:3000`.

---

## Project structure

```
recoverkit/
├── web/                        # React frontend (Vite)
│   ├── components/
│   │   ├── dashboard/          # Metrics, charts, cart table
│   │   ├── flows/              # Flow builder UI
│   │   └── ui/                 # Shared design system components
│   ├── hooks/                  # TanStack Query hooks
│   ├── lib/                    # Gadget client, formatters, utils
│   └── pages/
├── api/                        # Gadget.dev backend
│   ├── models/
│   │   ├── cart/               # Cart model + state machine actions
│   │   ├── sequence/           # Sequence + step models
│   │   ├── store/              # Multi-tenant store model
│   │   └── message/            # Sent message log
│   ├── actions/
│   │   ├── ingestWebhook.ts    # Webhook receiver
│   │   ├── scheduleSequence.ts # Cron: evaluate pending carts
│   │   └── sendMessage.ts      # Background: email/SMS dispatch
│   └── routes/
│       └── webhook.ts          # POST /webhook/:storeId
├── tests/
│   ├── unit/
│   └── e2e/
└── .github/
    └── workflows/
        └── ci.yml
```

---

## Key implementation details

### Cart state machine

Each cart moves through a deterministic state machine managed in Gadget model actions:

```
idle → abandoned (after 30 min inactivity)
     → in_sequence (first message dispatched)
     → recovered (purchase detected)
     → closed (sequence exhausted, no purchase)
```

Transitions are triggered by webhooks and a cron job that runs every 5 minutes.

### Multi-tenant isolation

Every database query is scoped by `storeId` enforced at the Gadget model permission layer. API tokens are signed per-store, and the React app resolves the active store from the JWT claims — no cross-tenant data leakage is possible at the query level.

### Sequence scheduling

Background actions in Gadget support retry with exponential backoff. Each sequence step stores its `scheduledAt` timestamp; the cron job selects all steps where `scheduledAt <= now()` and `status = pending`, then dispatches individual send jobs — keeping the scheduler decoupled from delivery.

### A/B testing

Variants are stored as sibling steps at the same sequence position with a `weight` field. On dispatch, the scheduler samples a variant using weighted random selection and records the chosen variant on the `Message` record. Winner promotion runs automatically when one variant reaches statistical significance (χ² test, p < 0.05).

---

## API reference

| Method | Path | Description |
|---|---|---|
| `POST` | `/webhook/:storeId` | Receive cart events from the store |
| `GET` | `/api/carts` | List carts for the authenticated store |
| `GET` | `/api/analytics/summary` | Recovery metrics for date range |
| `POST` | `/api/sequences` | Create a recovery sequence |
| `PATCH` | `/api/sequences/:id` | Update sequence steps/delays |
| `GET` | `/api/messages` | Sent message log with open/click status |

Full OpenAPI spec at `docs/openapi.yaml`.

---

## Testing

```bash
# Unit tests
npm run test

# E2E tests (Playwright)
npm run test:e2e

# Coverage report
npm run test:coverage
```

---

## Roadmap

- [ ] WhatsApp channel via Meta Business API
- [ ] AI-generated subject line suggestions (Claude API)
- [ ] Shopify and WooCommerce native integrations
- [ ] Discount code injection per sequence step
- [ ] Revenue attribution with multi-touch model

---

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/your-feature`)
3. Commit with conventional commits (`feat:`, `fix:`, `chore:`)
4. Open a PR against `main`

---

## License

MIT © 2025 — built with [Gadget.dev](https://gadget.dev)
