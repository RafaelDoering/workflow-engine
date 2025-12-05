# Workflow Engine

A distributed workflow orchestration engine built with NestJS, Kafka, and PostgreSQL.

## Architecture

```
┌─────────┐     ┌───────────┐     ┌──────────┐
│   API   │────▶│   Kafka   │────▶│  Worker  │
└─────────┘     └───────────┘     └──────────┘
     │                                  │
     └──────────────┬───────────────────┘
                    ▼
              ┌──────────┐
              │ Postgres │
              └──────────┘
```

## Quick Start

```bash
# Start infrastructure
docker compose up -d

# Apply migrations
npx prisma migrate dev

# Seed database
npm run seed

# Start services (in separate terminals)
npm run start:dev api
npm run start:dev worker

# Test workflow
npm run test:workflow
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/workflows/:id/start` | Start workflow |
| GET | `/workflows/:id/instances` | List instances |
| GET | `/workflows/:id/instances/:instanceId` | Instance details |
| POST | `/workflows/:id/instances/:instanceId/cancel` | Cancel workflow |

## Features

- **Multi-step Workflows**: Tasks chain automatically (fetch-orders → create-invoice → pdf-process → send-email)
- **Retry with Backoff**: Failed tasks retry with exponential backoff
- **Idempotency**: Duplicate tasks are skipped
- **Dead Letter Queue**: Permanently failed tasks marked as `DEAD_LETTER`
- **Observability**: All state transitions logged to `TaskLog` table

## Project Structure

```
apps/
├── api/           # REST API
└── worker/        # Task processor
libs/
└── core/          # Domain, ports, adapters
prisma/
└── schema.prisma  # Database schema
```

## Tests

```bash
npm run test
npm run lint
```
