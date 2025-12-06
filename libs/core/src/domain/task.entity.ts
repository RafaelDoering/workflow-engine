import { z } from 'zod';

export const TaskPayloadSchema = z.object({
  orderId: z.string().optional(),
  orders: z
    .array(
      z.object({
        id: z.number(),
        amount: z.number(),
        items: z.number(),
      }),
    )
    .optional(),
  invoice: z
    .object({
      invoiceId: z.string(),
      customerId: z.string(),
      total: z.number(),
      createdAt: z.string(),
    })
    .optional(),
  pdf: z
    .object({
      pdfUrl: z.string(),
      size: z.number(),
      generatedAt: z.string(),
    })
    .optional(),
  email: z
    .object({
      messageId: z.string(),
      recipient: z.string(),
      subject: z.string(),
      sentAt: z.string(),
      status: z.string(),
    })
    .optional(),
});

export type TaskPayload = z.infer<typeof TaskPayloadSchema>;

export enum TaskStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  DEAD_LETTER = 'DEAD_LETTER',
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
    public readonly idempotencyKey: string,
    public scheduledAt: Date,
    public startedAt: Date | null,
    public finishedAt: Date | null,
    public lastError: string | null,
  ) {}
}
