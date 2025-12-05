import { Injectable, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { TaskRepositoryPort } from '@app/core/ports/task-repository.port';
import type { QueuePort } from '@app/core/ports/queue.port';

@Injectable()
export class RetryScheduler {
  constructor(
    @Inject('TaskRepository') private taskRepository: TaskRepositoryPort,
    @Inject('QueuePort') private queue: QueuePort,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async pollRetryableTasks() {
    const tasks = await this.taskRepository.findRetryableTasks();

    for (const task of tasks) {
      console.log(
        `[RetryScheduler] Re-queuing task ${task.id} (attempt ${task.attempt})`,
      );

      await this.queue.publish('task-queue', {
        taskId: task.id,
        instanceId: task.instanceId,
        type: task.type,
        payload: task.payload,
        attempt: task.attempt,
        maxAttempts: task.maxAttempts,
        idempotencyKey: task.idempotencyKey,
        scheduledAt: task.scheduledAt?.getTime() ?? Date.now(),
      });

      task.scheduledAt = null;
      await this.taskRepository.saveTask(task);
    }

    if (tasks.length > 0) {
      console.log(`[RetryScheduler] Re-queued ${tasks.length} tasks`);
    }
  }
}
