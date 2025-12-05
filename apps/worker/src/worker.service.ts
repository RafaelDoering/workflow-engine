import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { KafkaConsumer } from '@app/core/adapters/kafka.consumer';
import { TaskPayload } from '@app/core/domain/task.entity';
import { TaskExecutor } from './task-executor.service';
import { TaskStateService } from './task-state.service';
import { TaskChainService } from './task-chain.service';
import type { TaskRepositoryPort } from '@app/core/ports/task-repository.port';

interface TaskMessage {
  taskId: string;
  instanceId: string;
  type: string;
  payload: TaskPayload;
  attempt: number;
  maxAttempts: number;
  idempotencyKey: string;
  scheduledAt: number;
}

@Injectable()
export class WorkerService implements OnModuleInit {
  constructor(
    private kafkaConsumer: KafkaConsumer,
    private taskExecutor: TaskExecutor,
    private taskState: TaskStateService,
    private taskChain: TaskChainService,
    @Inject('TaskRepository') private taskRepository: TaskRepositoryPort,
  ) {}

  async onModuleInit() {
    this.kafkaConsumer.setMessageHandler(
      this.processTask.bind(this) as (payload: unknown) => Promise<void>,
    );
    await this.kafkaConsumer.start();
    console.log('[WorkerService] Started consuming from task-queue');
  }

  private async processTask(payload: unknown): Promise<void> {
    const message = payload as TaskMessage;
    console.log(
      `[WorkerService] Processing task ${message.taskId} (${message.type})`,
    );

    try {
      const tasks = await this.taskRepository.findByInstanceId(
        message.instanceId,
      );
      const task = tasks.find((t) => t.id === message.taskId);

      if (!task) {
        console.error(
          `[WorkerService] Task ${message.taskId} not found in database`,
        );
        return;
      }

      await this.taskState.markTaskRunning(task);
      const result = await this.taskExecutor.execute(
        message.type,
        message.payload,
      );
      await this.taskState.markTaskSucceeded(task);
      console.log(`[WorkerService] Task ${message.taskId} succeeded`);

      await this.taskChain.queueNextTask(task, result);
    } catch (error) {
      console.error(`[WorkerService] Task ${message.taskId} failed:`, error);

      const tasks = await this.taskRepository.findByInstanceId(
        message.instanceId,
      );
      const task = tasks.find((t) => t.id === message.taskId);
      if (!task) return;

      if (task.attempt < task.maxAttempts - 1) {
        await this.taskState.scheduleRetry(task, error as Error);
      } else {
        await this.taskState.markTaskFailed(task, error as Error);
        console.log(
          `[WorkerService] Task ${message.taskId} failed permanently after ${task.attempt + 1} attempts`,
        );
      }
    }
  }
}
