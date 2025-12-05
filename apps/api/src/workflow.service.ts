import { Injectable, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

import {
  WorkflowInstance,
  WorkflowInstanceStatus,
} from '@app/core/domain/workflow-instance.entity';
import { Task, TaskStatus } from '@app/core/domain/task.entity';
import type { WorkflowInstanceRepositoryPort } from '@app/core/ports/workflow-instance-repository.port';
import type { TaskRepositoryPort } from '@app/core/ports/task-repository.port';
import type { QueuePort } from '@app/core/ports/queue.port';
import type { TaskPayload } from '@app/core';

@Injectable()
export class WorkflowService {
  constructor(
    @Inject('WorkflowInstanceRepository')
    private instanceRepo: WorkflowInstanceRepositoryPort,
    @Inject('TaskRepository') private taskRepo: TaskRepositoryPort,
    @Inject('QueuePort') private queue: QueuePort,
  ) {}

  async startWorkflow(
    workflowId: string,
    payload: TaskPayload,
  ): Promise<{ instanceId: string }> {
    const instanceId = uuidv4();
    const instance = new WorkflowInstance(
      instanceId,
      workflowId,
      WorkflowInstanceStatus.RUNNING,
      new Date(),
      new Date(),
    );

    await this.instanceRepo.saveWorkflowInstance(instance);

    const taskId = uuidv4();
    const task = new Task(
      taskId,
      instanceId,
      'fetch-orders',
      payload,
      TaskStatus.PENDING,
      0,
      3,
      uuidv4(), // Idempotency key
      new Date(), // Scheduled immediately
      null,
      null,
      null,
    );

    await this.taskRepo.saveTask(task);
    await this.queue.publish('task-queue', {
      taskId: task.id,
      instanceId: task.instanceId,
      type: task.type,
      payload: task.payload,
      attempt: task.attempt,
      maxAttempts: task.maxAttempts,
      idempotencyKey: task.idempotencyKey,
      scheduledAt: task.scheduledAt?.getTime(),
    });

    return { instanceId };
  }
}
