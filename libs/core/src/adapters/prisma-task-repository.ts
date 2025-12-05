import { Injectable } from '@nestjs/common';
import { PrismaClient, TaskStatus as PrismaTaskStatus } from '@prisma/client';
import { Task, TaskPayloadSchema, TaskStatus } from '../domain/task.entity';
import { TaskRepositoryPort } from '../ports/task-repository.port';

@Injectable()
export class PrismaTaskRepository implements TaskRepositoryPort {
  constructor(private prisma: PrismaClient) {}

  private toDomainStatus(prismaStatus: PrismaTaskStatus): TaskStatus {
    return prismaStatus as unknown as TaskStatus;
  }

  private toPrismaStatus(domainStatus: TaskStatus): PrismaTaskStatus {
    return domainStatus as unknown as PrismaTaskStatus;
  }

  async saveTask(task: Task): Promise<void> {
    await this.prisma.task.upsert({
      where: { id: task.id },
      update: {
        status: this.toPrismaStatus(task.status),
        attempt: task.attempt,
        scheduledAt: task.scheduledAt,
        startedAt: task.startedAt,
        finishedAt: task.finishedAt,
        lastError: task.lastError,
      },
      create: {
        id: task.id,
        workflowInstanceId: task.instanceId,
        type: task.type,
        payload: task.payload,
        status: this.toPrismaStatus(task.status),
        attempt: task.attempt,
        maxAttempts: task.maxAttempts,
        idempotencyKey: task.idempotencyKey,
        scheduledAt: task.scheduledAt,
        startedAt: task.startedAt,
        finishedAt: task.finishedAt,
        lastError: task.lastError,
      },
    });
  }

  async findByInstanceId(instanceId: string): Promise<Task[]> {
    const records = await this.prisma.task.findMany({
      where: { workflowInstanceId: instanceId },
    });
    return records.map((record) => {
      const payload = TaskPayloadSchema.parse(record.payload);

      return new Task(
        record.id,
        record.workflowInstanceId,
        record.type,
        payload,
        this.toDomainStatus(record.status),
        record.attempt,
        record.maxAttempts,
        record.idempotencyKey,
        record.scheduledAt,
        record.startedAt,
        record.finishedAt,
        record.lastError,
      );
    });
  }
}
