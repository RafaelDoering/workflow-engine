import { Injectable, Inject } from '@nestjs/common';
import { Task, TaskStatus } from '@app/core/domain/task.entity';
import { WorkflowInstanceStatus } from '@app/core/domain/workflow-instance.entity';
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
  ) {}

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
        const result = await this.compensateTask(task);
        if (result === 'DEAD_LETTER') {
          console.error(
            `[CompensationService] Task ${task.id} reached DEAD_LETTER, stopping compensation for instance ${instanceId}`,
          );
          instance.status = WorkflowInstanceStatus.DEAD_LETTER;
          await this.instanceRepository.saveWorkflowInstance(instance);
          return;
        }
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

  async compensateTask(task: Task): Promise<'SUCCESS' | 'DEAD_LETTER'> {
    if (task.status === TaskStatus.DEAD_LETTER) {
      return 'DEAD_LETTER';
    }

    while (task.compensationAttempt < task.maxCompensationAttempts) {
      console.log(
        `[CompensationService] Compensating task ${task.id} (${task.type}) - attempt ${task.compensationAttempt + 1}/${task.maxCompensationAttempts}`,
      );

      task.status = TaskStatus.COMPENSATING;
      await this.taskRepository.saveTask(task);
      await this.taskLogRepository.createLog(
        task.id,
        'INFO',
        `Starting compensation attempt ${task.compensationAttempt + 1}/${task.maxCompensationAttempts}`,
      );

      try {
        const compensationPayload = task.result ?? task.payload;
        await this.taskExecutor.compensate(task.type, compensationPayload);

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
        return 'SUCCESS';
      } catch (error) {
        task.compensationAttempt += 1;
        const errorMessage = (error as Error).message;

        console.error(
          `[CompensationService] Compensation attempt ${task.compensationAttempt}/${task.maxCompensationAttempts} failed for task ${task.id}:`,
          error,
        );

        if (task.compensationAttempt >= task.maxCompensationAttempts) {
          task.status = TaskStatus.DEAD_LETTER;
          task.lastError = `Compensation failed after ${task.maxCompensationAttempts} attempts: ${errorMessage}`;
          task.finishedAt = new Date();
          await this.taskRepository.saveTask(task);
          await this.taskLogRepository.createLog(
            task.id,
            'ERROR',
            `Compensation failed after ${task.maxCompensationAttempts} attempts, marked as DEAD_LETTER: ${errorMessage}`,
          );

          console.error(
            `[CompensationService] Task ${task.id} marked as DEAD_LETTER after ${task.maxCompensationAttempts} failed compensation attempts`,
          );
          return 'DEAD_LETTER';
        }

        task.status = TaskStatus.FAILED;
        task.lastError = `Compensation attempt ${task.compensationAttempt}/${task.maxCompensationAttempts} failed: ${errorMessage}`;
        await this.taskRepository.saveTask(task);
        await this.taskLogRepository.createLog(
          task.id,
          'WARN',
          `Compensation attempt ${task.compensationAttempt}/${task.maxCompensationAttempts} failed: ${errorMessage}`,
        );

        const delayMs = Math.pow(2, task.compensationAttempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return 'DEAD_LETTER';
  }
}
