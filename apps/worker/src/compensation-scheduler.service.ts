import { Injectable, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WorkflowInstanceStatus } from '@app/core/domain/workflow-instance.entity';
import type { WorkflowInstanceRepositoryPort } from '@app/core/ports/workflow-instance-repository.port';
import type { TaskRepositoryPort } from '@app/core/ports/task-repository.port';
import { TaskStatus } from '@app/core/domain/task.entity';
import { CompensationService } from './compensation.service';

@Injectable()
export class CompensationScheduler {
  constructor(
    @Inject('WorkflowInstanceRepository')
    private instanceRepository: WorkflowInstanceRepositoryPort,
    @Inject('TaskRepository') private taskRepository: TaskRepositoryPort,
    private compensationService: CompensationService,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async checkForCompensationNeeded() {
    const cancelledInstances = await this.instanceRepository.findByStatus(
      WorkflowInstanceStatus.CANCELLED,
    );
    const failedInstances = await this.instanceRepository.findByStatus(
      WorkflowInstanceStatus.FAILED,
    );

    const instancesToCompensate = [...cancelledInstances, ...failedInstances];

    for (const instance of instancesToCompensate) {
      const tasks = await this.taskRepository.findByInstanceId(instance.id);
      const needsCompensation = tasks.some(
        (t) => t.status === TaskStatus.SUCCEEDED,
      );

      if (needsCompensation) {
        console.log(
          `[CompensationScheduler] Found instance ${instance.id} that needs compensation`,
        );
        try {
          await this.compensationService.compensateWorkflow(instance.id);
        } catch (error) {
          console.error(
            `[CompensationScheduler] Failed to compensate instance ${instance.id}:`,
            error,
          );
        }
      }
    }
  }
}
