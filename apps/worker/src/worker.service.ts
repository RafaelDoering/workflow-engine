import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import type { TaskQueuePort } from '@app/core/ports/task-queue.port';
import { Task, TaskStatus } from '@app/core/domain/task.entity';
import { TaskExecutor } from './task-executor.service';
import { TaskStateService } from './task-state.service';
import { TaskChainService } from './task-chain.service';
import type { TaskRepositoryPort } from '@app/core/ports/task-repository.port';

@Injectable()
export class WorkerService implements OnModuleInit {
  constructor(
    @Inject('TaskQueuePort') private taskQueue: TaskQueuePort,
    private taskExecutor: TaskExecutor,
    private taskState: TaskStateService,
    private taskChain: TaskChainService,
    @Inject('TaskRepository') private taskRepository: TaskRepositoryPort,
  ) {}

  async onModuleInit() {
    await this.taskQueue.consume((msg) => this.processTask(msg));
    console.log('[WorkerService] Started consuming from task-queue');
  }

  private async processTask(message: Task): Promise<void> {
    console.log(
      `[WorkerService] Processing task ${message.id} (${message.type})`,
    );

    try {
      const tasks = await this.taskRepository.findByInstanceId(
        message.instanceId,
      );
      const task = tasks.find((t) => t.id === message.id);

      if (!task) {
        console.error(
          `[WorkerService] Task ${message.id} not found in database`,
        );
        return;
      }

      // Idempotency check - skip if already completed
      if (
        task.status === TaskStatus.SUCCEEDED ||
        task.status === TaskStatus.FAILED ||
        task.status === TaskStatus.DEAD_LETTER
      ) {
        console.log(
          `[WorkerService] Skipping task ${message.id} - already ${task.status}`,
        );
        return;
      }

      await this.taskState.markTaskRunning(task);
      const result = await this.taskExecutor.execute(
        message.type,
        message.payload,
      );
      await this.taskState.markTaskSucceeded(task);
      console.log(`[WorkerService] Task ${message.id} succeeded`);

      await this.taskChain.queueNextTask(task, result);
      await this.taskState.checkWorkflowCompletion(task.instanceId);
    } catch (error) {
      console.error(`[WorkerService] Task ${message.id} failed:`, error);

      const tasks = await this.taskRepository.findByInstanceId(
        message.instanceId,
      );
      const task = tasks.find((t) => t.id === message.id);
      if (!task) return;

      if (task.attempt < task.maxAttempts - 1) {
        await this.taskState.scheduleRetry(task, error as Error);
      } else {
        await this.taskState.markTaskDeadLetter(task, error as Error);
        console.log(
          `[WorkerService] Task ${message.id} moved to dead letter after ${task.attempt + 1} attempts`,
        );
      }
    }
  }
}
