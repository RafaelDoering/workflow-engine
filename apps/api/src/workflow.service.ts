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

export interface InstanceWithTasks {
  instance: WorkflowInstance;
  tasks: Task[];
}

@Injectable()
export class WorkflowService {
  constructor(
    @Inject('WorkflowInstanceRepository')
    private instanceRepository: WorkflowInstanceRepositoryPort,
    @Inject('TaskRepository') private taskRepository: TaskRepositoryPort,
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

    await this.instanceRepository.saveWorkflowInstance(instance);

    const taskId = uuidv4();
    const task = new Task(
      taskId,
      instanceId,
      'fetch-orders',
      payload,
      TaskStatus.PENDING,
      0,
      3,
      `${instanceId}-fetch-orders`,
      new Date(),
      null,
      null,
      null,
    );

    await this.taskRepository.saveTask(task);
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

  async getInstances(workflowId: string): Promise<WorkflowInstance[]> {
    return this.instanceRepository.findByWorkflowId(workflowId);
  }

  async getInstance(instanceId: string): Promise<InstanceWithTasks | null> {
    const instance =
      await this.instanceRepository.findWorkflowInstanceById(instanceId);
    if (!instance) return null;

    const tasks = await this.taskRepository.findByInstanceId(instanceId);
    return { instance, tasks };
  }
}
