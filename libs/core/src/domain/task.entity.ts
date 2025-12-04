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
        public readonly payload: any,
        public status: TaskStatus,
        public attempt: number,
        public readonly maxAttempts: number,
        public readonly idempotencyKey: string | null,
        public scheduledAt: Date | null,
        public startedAt: Date | null,
        public finishedAt: Date | null,
        public lastError: string | null,
    ) { }
}
