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
docker compose up
```

After that, you can access the API Swagger UI at `http://localhost:3000/api` and:
- Create a workflow
- Start a workflow
- Get a workflow instance and view its status and tasks

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/workflows` | Create workflow |
| POST | `/workflows/:id/start` | Start workflow |
| GET | `/workflows/:id/instances/:instanceId` | Instance details |

You can find the full API documentation at: `http://localhost:3000/api`

## Features

- **Multi-step Workflows**: Tasks execute in sequence (fetch-orders → create-invoice → pdf-process → send-email)
- **Retry with Backoff**: Failed tasks are retried with exponential backoff
- **Idempotency**: Duplicate tasks are automatically skipped
- **Compensation**: When a task fails, the compensation process starts (SAGA pattern)
- **Dead Letter Queue**: Permanently failed tasks are marked as `DEAD_LETTER`
- **Observability**: All state transitions are logged in the `TaskLog` table

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

## Technical Choices

### Queue: Redpanda (Kafka without Zookeeper)
- At-least-once + idempotency.
- Redpanda is Zookeeper-less: simpler DX, fast startup, fully Kafka-compatible.
- Horizontal scalability and partitions demonstrate real worker scaling.

### Database: PostgreSQL
- Strong consistency for workflow states.
- Easy to extend into production-grade schema.

### NestJS
- Supports domain-driven organization and dependency injection.

### Clean Architecture / Ports & Adapters
- Infrastructure (DB, Kafka) is replaceable (less coupling).

## Tests

```bash
npm run test
```

## Lint

```bash
npm run lint
```

## Future Evolution

- Add a workflow DSL (JSON or declarative YAML).
- Introduce cron-based scheduler.
- Implement dead letter queue.
- Real integrations.