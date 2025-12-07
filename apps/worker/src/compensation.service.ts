import { Injectable, Inject } from '@nestjs/common';
import { Task, TaskStatus } from '@app/core/domain/task.entity';
import type { TaskRepositoryPort } from '@app/core/ports/task-repository.port';
import type { WorkflowRepositoryPort } from '@app/core/ports/workflow-repository.port';
import type { WorkflowInstanceRepositoryPort } from '@app/core/ports/workflow-instance-repository.port';
import type { TaskLogRepositoryPort } from '@app/core/ports/task-log-repository.port';
import { TaskExecutor } from './task-executor.service';

@Injectable()
export class CompensationService {
  constructor(
    @Inject('TaskRepository') private taskRepository: TaskRepositoryPort,
    @Inject('WorkflowRepository')
    private workflowRepository: WorkflowRepositoryPort,
    @Inject('WorkflowInstanceRepository')
    private instanceRepository: WorkflowInstanceRepositoryPort,
    @Inject('TaskLogRepository')
    private taskLogRepository: TaskLogRepositoryPort,
    private taskExecutor: TaskExecutor,
  ) { }

  async compensateWorkflow(instanceId: string): Promise<void> {
    console.log(
      `[CompensationService] Starting compensation for instance ${instanceId}`,
    );

    const instance =
      await this.instanceRepository.findWorkflowInstanceById(instanceId);
    if (!instance) {
      console.error(`[CompensationService] Instance ${instanceId} not found`);
      return;
    }

    const workflow = await this.workflowRepository.findWorkflowById(
      instance.workflowId,
    );
    if (!workflow) {
      console.error(
        `[CompensationService] Workflow ${instance.workflowId} not found`,
      );
      return;
    }

    const tasks = await this.taskRepository.findByInstanceId(instanceId);

    const succeededTasks = tasks.filter(
      (t) => t.status === TaskStatus.SUCCEEDED,
    );

    if (succeededTasks.length === 0) {
      console.log(
        `[CompensationService] No tasks to compensate for instance ${instanceId}`,
      );
      return;
    }

    const steps = workflow.definition.steps;
    const sortedTasks = succeededTasks.sort((a, b) => {
      const indexA = steps.indexOf(a.type);
      const indexB = steps.indexOf(b.type);
      return indexB - indexA;
    });

    console.log(
      `[CompensationService] Compensating ${sortedTasks.length} tasks in reverse order`,
    );

    try {
      for (const task of sortedTasks) {
        await this.compensateTask(task);
      }

      console.log(
        `[CompensationService] Compensation complete for instance ${instanceId}`,
      );
    } catch (error) {
      console.error(
        `[CompensationService] Compensation stopped due to failure for instance ${instanceId}:`,
        error,
      );
      throw error;
    }
  }

  async compensateTask(task: Task): Promise<void> {
    console.log(
      `[CompensationService] Compensating task ${task.id} (${task.type})`,
    );

    task.status = TaskStatus.COMPENSATING;
    await this.taskRepository.saveTask(task);
    await this.taskLogRepository.createLog(
      task.id,
      'INFO',
      'Starting compensation',
    );

    try {
      await this.taskExecutor.compensate(task.type, task.payload);

      task.status = TaskStatus.COMPENSATED;
      task.compensatedAt = new Date();
      await this.taskRepository.saveTask(task);
      await this.taskLogRepository.createLog(
        task.id,
        'INFO',
        'Compensation completed successfully',
      );

      console.log(
        `[CompensationService] Task ${task.id} compensated successfully`,
      );
    } catch (error) {
      console.error(
        `[CompensationService] Compensation failed for task ${task.id}:`,
        error,
      );
      task.status = TaskStatus.FAILED;
      task.lastError = `Compensation error: ${(error as Error).message}`;
      await this.taskRepository.saveTask(task);
      await this.taskLogRepository.createLog(
        task.id,
        'ERROR',
        `Compensation failed: ${(error as Error).message}`,
      );
      throw error;
    }
  }
}
