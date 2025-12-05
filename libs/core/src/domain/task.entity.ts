import { z } from 'zod';

export const TaskPayloadSchema = z.object({
  orderId: z.string(),
});

export type TaskPayload = z.infer<typeof TaskPayloadSchema>;

export enum TaskStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
}

export class Task {
  constructor(
    public readonly id: string,
    public readonly instanceId: string,
    public readonly type: string,
    public readonly payload: TaskPayload,
    public status: TaskStatus,
    public attempt: number,
    public readonly maxAttempts: number,
    public readonly idempotencyKey: string | null,
    public scheduledAt: Date | null,
    public startedAt: Date | null,
    public finishedAt: Date | null,
    public lastError: string | null,
  ) {}
}
