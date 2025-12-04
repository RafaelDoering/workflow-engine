import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Task } from '../domain/task.entity';
import { TaskRepositoryPort } from '../ports/task-repository.port';

@Injectable()
export class PrismaTaskRepository implements TaskRepositoryPort {
    constructor(private prisma: PrismaClient) { }

    async saveTask(task: Task): Promise<void> {
        await this.prisma.task.upsert({
            where: { id: task.id },
            update: {
                status: task.status,
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
                status: task.status,
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
        const records = await this.prisma.task.findMany({ where: { workflowInstanceId: instanceId } });
        return records.map(
            (record) =>
                new Task(
                    record.id,
                    record.workflowInstanceId,
                    record.type,
                    record.payload,
                    record.status as any,
                    record.attempt,
                    record.maxAttempts,
                    record.idempotencyKey,
                    record.scheduledAt,
                    record.startedAt,
                    record.finishedAt,
                    record.lastError,
                ),
        );
    }
}
