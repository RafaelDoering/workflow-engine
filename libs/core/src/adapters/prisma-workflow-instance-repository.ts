import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { WorkflowInstance } from '../domain/workflow-instance.entity';
import { WorkflowInstanceRepositoryPort } from '../ports/workflow-instance-repository.port';

@Injectable()
export class PrismaWorkflowInstanceRepository implements WorkflowInstanceRepositoryPort {
    constructor(private prisma: PrismaClient) { }

    async saveWorkflowInstance(instance: WorkflowInstance): Promise<void> {
        await this.prisma.workflowInstance.upsert({
            where: { id: instance.id },
            update: {
                status: instance.status,
                updatedAt: instance.updatedAt,
            },
            create: {
                id: instance.id,
                workflowId: instance.workflowId,
                status: instance.status,
                createdAt: instance.createdAt,
                updatedAt: instance.updatedAt,
            },
        });
    }

    async findWorkflowInstanceById(id: string): Promise<WorkflowInstance | null> {
        const record = await this.prisma.workflowInstance.findUnique({ where: { id } });
        if (!record) return null;
        return new WorkflowInstance(
            record.id,
            record.workflowId,
            record.status as any,
            record.createdAt,
            record.updatedAt,
        );
    }
}
