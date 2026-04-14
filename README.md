# Neo Calculator

A better version of the Huawei Cloud pricing calculator. Uses the Huawei Cloud calculator API to fetch real-time pricing for 40+ Huawei Cloud products and presents them in a streamlined dashboard.

## Features

- Real-time pricing from the Huawei Cloud calculator API
- 40+ supported cloud services with declarative configuration
- Pay-per-use and yearly/monthly billing modes
- Save configurations into projects
- Clone carts across regions and billing modes
- Export projects as JSON or Excel
- Share projects via links

## Tech Stack

- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Runtime:** Bun
- **UI:** React + shadcn/ui + Tailwind CSS
- **Database:** SQLite (better-auth sessions)
- **Testing:** Bun test + Playwright (E2E)

## Getting Started

```bash
bun install
bun dev
```

Open [http://localhost:3000](http://localhost:3000).

## Running Tests

```bash
bun test
```

## Adding a New Service

Services are defined declaratively in `config/services/<service>/bundle.ts`. Each bundle contains:

1. **service** - UI field definitions, billing options, defaults
2. **pricing** - Rate sources and pricing metrics
3. **catalogDefinition** - How to fetch and parse raw Huawei API data
4. **runtime** - Reactive runtime logic for computed values, estimates, hydration

See `config/services/dcs/bundle.ts` as the reference implementation.

## Docker

```bash
docker build -t neo-calculator .
docker run -p 3000:3000 -e BETTER_AUTH_SECRET=your-secret-here neo-calculator
```

## Project Structure

| Directory | Purpose |
|---|---|
| `app/` | Next.js pages and API routes |
| `config/services/` | Declarative service bundles |
| `lib/` | Core engine, pricing, catalog fetchers |
| `components/` | UI components |
| `tests/` | Pricing and E2E tests |
