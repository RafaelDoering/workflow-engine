import { Injectable, Inject } from '@nestjs/common';
import { Task, TaskStatus } from '@app/core/domain/task.entity';
import { WorkflowInstanceStatus } from '@app/core/domain/workflow-instance.entity';
import type { TaskRepositoryPort } from '@app/core/ports/task-repository.port';
import type { WorkflowInstanceRepositoryPort } from '@app/core/ports/workflow-instance-repository.port';

@Injectable()
export class TaskStateService {
  constructor(
    @Inject('TaskRepository') private taskRepository: TaskRepositoryPort,
    @Inject('WorkflowInstanceRepository')
    private instanceRepository: WorkflowInstanceRepositoryPort,
  ) {}

  async markTaskRunning(task: Task): Promise<void> {
    task.status = TaskStatus.RUNNING;
    task.startedAt = new Date();
    await this.taskRepository.saveTask(task);
  }

  async markTaskSucceeded(task: Task): Promise<void> {
    task.status = TaskStatus.SUCCEEDED;
    task.finishedAt = new Date();
    await this.taskRepository.saveTask(task);
    await this.checkWorkflowCompletion(task.instanceId);
  }

  async markTaskFailed(task: Task, error: Error): Promise<void> {
    task.status = TaskStatus.FAILED;
    task.finishedAt = new Date();
    task.lastError = error.message;
    await this.taskRepository.saveTask(task);

    const instance = await this.instanceRepository.findWorkflowInstanceById(
      task.instanceId,
    );
    if (instance) {
      instance.status = WorkflowInstanceStatus.FAILED;
      await this.instanceRepository.saveWorkflowInstance(instance);
    }
  }

  async scheduleRetry(task: Task, error: Error): Promise<void> {
    task.attempt += 1;
    task.lastError = error.message;
    task.status = TaskStatus.PENDING;
    const delaySeconds = Math.pow(2, task.attempt);
    task.scheduledAt = new Date(Date.now() + delaySeconds * 1000);
    await this.taskRepository.saveTask(task);
    console.log(
      `[TaskStateService] Scheduled retry for task ${task.id}, attempt ${task.attempt}/${task.maxAttempts}, delay: ${delaySeconds}s`,
    );
  }

  private async checkWorkflowCompletion(instanceId: string): Promise<void> {
    const tasks = await this.taskRepository.findByInstanceId(instanceId);
    const allSucceeded = tasks.every((t) => t.status === TaskStatus.SUCCEEDED);

    if (allSucceeded) {
      const instance =
        await this.instanceRepository.findWorkflowInstanceById(instanceId);
      if (instance) {
        instance.status = WorkflowInstanceStatus.SUCCEEDED;
        await this.instanceRepository.saveWorkflowInstance(instance);
        console.log(
          `[TaskStateService] Workflow instance ${instanceId} completed successfully`,
        );
      }
    }
  }
}
