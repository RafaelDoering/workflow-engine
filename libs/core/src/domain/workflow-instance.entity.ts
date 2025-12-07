export enum WorkflowInstanceStatus {
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  DEAD_LETTER = 'DEAD_LETTER',
}

export class WorkflowInstance {
  constructor(
    public readonly id: string,
    public readonly workflowId: string,
    public status: WorkflowInstanceStatus,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
