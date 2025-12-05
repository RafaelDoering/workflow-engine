import { Injectable, Inject } from '@nestjs/common';
import { Task, TaskStatus } from '@app/core/domain/task.entity';
import { WorkflowInstanceStatus } from '@app/core/domain/workflow-instance.entity';
import type { TaskRepositoryPort } from '@app/core/ports/task-repository.port';
import type { WorkflowInstanceRepositoryPort } from '@app/core/ports/workflow-instance-repository.port';
import type { TaskLogRepositoryPort } from '@app/core/ports/task-log-repository.port';

@Injectable()
export class TaskStateService {
  constructor(
    @Inject('TaskRepository') private taskRepository: TaskRepositoryPort,
    @Inject('WorkflowInstanceRepository')
    private instanceRepository: WorkflowInstanceRepositoryPort,
    @Inject('TaskLogRepository')
    private taskLogRepository: TaskLogRepositoryPort,
  ) {}

  async markTaskRunning(task: Task): Promise<void> {
    task.status = TaskStatus.RUNNING;
    task.startedAt = new Date();
    await this.taskRepository.saveTask(task);
    await this.taskLogRepository.createLog(
      task.id,
      'INFO',
      `Task started (attempt ${task.attempt + 1})`,
    );
  }

  async markTaskSucceeded(task: Task): Promise<void> {
    task.status = TaskStatus.SUCCEEDED;
    task.finishedAt = new Date();
    await this.taskRepository.saveTask(task);
    await this.taskLogRepository.createLog(task.id, 'INFO', 'Task succeeded');
    await this.checkWorkflowCompletion(task.instanceId);
  }

  async markTaskFailed(task: Task, error: Error): Promise<void> {
    task.status = TaskStatus.FAILED;
    task.finishedAt = new Date();
    task.lastError = error.message;
    await this.taskRepository.saveTask(task);
    await this.taskLogRepository.createLog(
      task.id,
      'ERROR',
      `Task failed: ${error.message}`,
    );

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
    await this.taskLogRepository.createLog(
      task.id,
      'WARN',
      `Scheduled retry ${task.attempt}/${task.maxAttempts}, delay: ${delaySeconds}s`,
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
      }
    }
  }

  async markTaskDeadLetter(task: Task, error: Error): Promise<void> {
    task.status = TaskStatus.DEAD_LETTER;
    task.finishedAt = new Date();
    task.lastError = error.message;
    await this.taskRepository.saveTask(task);
    await this.taskLogRepository.createLog(
      task.id,
      'ERROR',
      `Moved to dead letter: ${error.message}`,
    );

    const instance = await this.instanceRepository.findWorkflowInstanceById(
      task.instanceId,
    );
    if (instance) {
      instance.status = WorkflowInstanceStatus.FAILED;
      await this.instanceRepository.saveWorkflowInstance(instance);
    }
  }
}
