import { Injectable } from '@nestjs/common';
import {
  PrismaClient,
  TaskStatus as PrismaTaskStatus,
} from '@app/prisma/client';
import { plainToInstance } from 'class-transformer';
import { Task, TaskPayload, TaskStatus } from '../domain/task.entity';
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
        compensatedAt: task.compensatedAt,
      },
      create: {
        id: task.id,
        workflowInstanceId: task.instanceId,
        type: task.type,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        payload: task.payload as any,
        status: this.toPrismaStatus(task.status),
        attempt: task.attempt,
        maxAttempts: task.maxAttempts,
        idempotencyKey: task.idempotencyKey,
        scheduledAt: task.scheduledAt,
        startedAt: task.startedAt,
        finishedAt: task.finishedAt,
        lastError: task.lastError,
        compensatedAt: task.compensatedAt,
      },
    });
  }

  async findByInstanceId(instanceId: string): Promise<Task[]> {
    const records = await this.prisma.task.findMany({
      where: { workflowInstanceId: instanceId },
    });
    return records.map((record) => {
      const payload = plainToInstance(TaskPayload, record.payload);

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
        record.compensatedAt,
      );
    });
  }

  async findRetryableTasks(): Promise<Task[]> {
    const records = await this.prisma.task.findMany({
      where: {
        status: 'PENDING',
        scheduledAt: { lte: new Date() },
      },
    });
    return records.map((record) => {
      const payload = plainToInstance(TaskPayload, record.payload);

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
        record.compensatedAt,
      );
    });
  }
}
