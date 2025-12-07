import { Injectable, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Task, TaskStatus, TaskPayload } from '@app/core/domain/task.entity';
import type { WorkflowRepositoryPort } from '@app/core/ports/workflow-repository.port';
import type { WorkflowInstanceRepositoryPort } from '@app/core/ports/workflow-instance-repository.port';
import type { TaskRepositoryPort } from '@app/core/ports/task-repository.port';
import type { TaskQueuePort } from '@app/core/ports/task-queue.port';

@Injectable()
export class TaskChainService {
  constructor(
    @Inject('WorkflowRepository')
    private workflowRepository: WorkflowRepositoryPort,
    @Inject('WorkflowInstanceRepository')
    private workflowInstanceRepository: WorkflowInstanceRepositoryPort,
    @Inject('TaskRepository')
    private taskRepository: TaskRepositoryPort,
    @Inject('TaskQueuePort')
    private taskQueue: TaskQueuePort,
  ) { }

  async queueNextTask(
    completedTask: Task,
    result: TaskPayload,
  ): Promise<Task | null> {
    const instance =
      await this.workflowInstanceRepository.findWorkflowInstanceById(
        completedTask.instanceId,
      );
    if (!instance) {
      console.error(
        `[TaskChainService] Instance ${completedTask.instanceId} not found`,
      );
      return null;
    }

    const workflow = await this.workflowRepository.findWorkflowById(
      instance.workflowId,
    );
    if (!workflow) {
      console.error(
        `[TaskChainService] Workflow ${instance.workflowId} not found`,
      );
      return null;
    }

    // Find current step index
    const steps = workflow.definition.steps;
    const currentIndex = steps.indexOf(completedTask.type);
    if (currentIndex === -1) {
      console.error(
        `[TaskChainService] Task type ${completedTask.type} not found in workflow steps`,
      );
      return null;
    }

    const nextIndex = currentIndex + 1;
    if (nextIndex >= steps.length) {
      console.log('[TaskChainService] No more steps - workflow complete');
      return null;
    }

    const nextType = steps[nextIndex];
    console.log(
      `[TaskChainService] Chaining to next task: ${completedTask.type} -> ${nextType}`,
    );

    const nextTask = new Task(
      uuidv4(),
      completedTask.instanceId,
      nextType,
      result,
      TaskStatus.PENDING,
      0,
      3,
      `${completedTask.instanceId}-${nextType}`,
      new Date(),
      null,
      null,
      null,
    );

    await this.taskRepository.saveTask(nextTask);

    await this.taskQueue.publish(nextTask);

    console.log(`[TaskChainService] Queued next task: ${nextTask.id}`);
    return nextTask;
  }
}
