import { Injectable, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

import {
  WorkflowInstance,
  WorkflowInstanceStatus,
} from '@app/core/domain/workflow-instance.entity';
import { Workflow } from '@app/core/domain/workflow.entity';
import { Task, TaskStatus } from '@app/core/domain/task.entity';
import type { WorkflowInstanceRepositoryPort } from '@app/core/ports/workflow-instance-repository.port';
import type { TaskRepositoryPort } from '@app/core/ports/task-repository.port';
import type { TaskQueuePort } from '@app/core/ports/task-queue.port';
import type { WorkflowRepositoryPort } from '@app/core/ports/workflow-repository.port';
import type { TaskPayload } from '@app/core';
import type { CreateWorkflowDto } from './dtos/create-workflow.dto';

export interface InstanceWithTasks {
  instance: WorkflowInstance;
  tasks: Task[];
}

@Injectable()
export class WorkflowService {
  constructor(
    @Inject('WorkflowInstanceRepository')
    private instanceRepository: WorkflowInstanceRepositoryPort,
    @Inject('WorkflowRepository')
    private workflowRepository: WorkflowRepositoryPort,
    @Inject('TaskRepository') private taskRepository: TaskRepositoryPort,
    @Inject('TaskQueuePort') private taskQueue: TaskQueuePort,
  ) {}

  async createWorkflow(dto: CreateWorkflowDto): Promise<{ id: string }> {
    const id = uuidv4();
    const now = new Date();
    const workflow = new Workflow(id, dto.name, dto.definition, now, now);

    await this.workflowRepository.saveWorkflow(workflow);

    return { id };
  }

  async listWorkflows(): Promise<Workflow[]> {
    return this.workflowRepository.findAllWorkflows();
  }

  async startWorkflow(
    workflowId: string,
    payload: TaskPayload,
  ): Promise<{ instanceId: string }> {
    const workflow = await this.workflowRepository.findWorkflowById(workflowId);
    if (!workflow) {
      throw new Error(`Workflow definition not found for id: ${workflowId}`);
    }

    if (!workflow.definition.steps.length) {
      throw new Error(`Workflow ${workflowId} has no steps defined`);
    }

    const firstStepType = workflow.definition.steps[0];

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
      firstStepType,
      payload,
      TaskStatus.PENDING,
      0,
      3,
      `${instanceId}-${firstStepType}`,
      new Date(),
      null,
      null,
      null,
      null,
    );

    await this.taskRepository.saveTask(task);
    await this.taskQueue.publish(task);

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

  async cancelInstance(instanceId: string): Promise<{ success: boolean }> {
    const instance =
      await this.instanceRepository.findWorkflowInstanceById(instanceId);
    if (!instance) return { success: false };

    if (instance.status !== WorkflowInstanceStatus.RUNNING) {
      return { success: false };
    }

    instance.status = WorkflowInstanceStatus.CANCELLED;
    await this.instanceRepository.saveWorkflowInstance(instance);

    return { success: true };
  }
}
