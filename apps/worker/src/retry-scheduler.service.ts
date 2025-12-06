import { Injectable, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { TaskRepositoryPort } from '@app/core/ports/task-repository.port';
import type { TaskQueuePort } from '@app/core/ports/task-queue.port';

@Injectable()
export class RetryScheduler {
  constructor(
    @Inject('TaskRepository') private taskRepository: TaskRepositoryPort,
    @Inject('TaskQueuePort') private taskQueue: TaskQueuePort,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async pollRetryableTasks() {
    const tasks = await this.taskRepository.findRetryableTasks();

    for (const task of tasks) {
      console.log(
        `[RetryScheduler] Re-queuing task ${task.id} (attempt ${task.attempt})`,
      );

      await this.taskQueue.publish(task);

      await this.taskRepository.saveTask(task);
    }

    if (tasks.length > 0) {
      console.log(`[RetryScheduler] Re-queued ${tasks.length} tasks`);
    }
  }
}
