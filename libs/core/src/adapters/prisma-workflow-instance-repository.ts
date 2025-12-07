import { Injectable } from '@nestjs/common';
import {
  PrismaClient,
  WorkflowInstanceStatus as PrismaWorkflowInstanceStatus,
} from '@app/prisma/client';
import {
  WorkflowInstance,
  WorkflowInstanceStatus,
} from '../domain/workflow-instance.entity';
import { WorkflowInstanceRepositoryPort } from '../ports/workflow-instance-repository.port';

@Injectable()
export class PrismaWorkflowInstanceRepository implements WorkflowInstanceRepositoryPort {
  constructor(private prisma: PrismaClient) {}

  private toDomainStatus(
    prismaStatus: PrismaWorkflowInstanceStatus,
  ): WorkflowInstanceStatus {
    return prismaStatus as unknown as WorkflowInstanceStatus;
  }

  private toPrismaStatus(
    domainStatus: WorkflowInstanceStatus,
  ): PrismaWorkflowInstanceStatus {
    return domainStatus as unknown as PrismaWorkflowInstanceStatus;
  }

  async saveWorkflowInstance(instance: WorkflowInstance): Promise<void> {
    await this.prisma.workflowInstance.upsert({
      where: { id: instance.id },
      update: {
        status: this.toPrismaStatus(instance.status),
        updatedAt: instance.updatedAt,
      },
      create: {
        id: instance.id,
        workflowId: instance.workflowId,
        status: this.toPrismaStatus(instance.status),
        createdAt: instance.createdAt,
        updatedAt: instance.updatedAt,
      },
    });
  }

  async findWorkflowInstanceById(id: string): Promise<WorkflowInstance | null> {
    const record = await this.prisma.workflowInstance.findUnique({
      where: { id },
    });
    if (!record) return null;
    return new WorkflowInstance(
      record.id,
      record.workflowId,
      this.toDomainStatus(record.status),
      record.createdAt,
      record.updatedAt,
    );
  }

  async findByWorkflowId(workflowId: string): Promise<WorkflowInstance[]> {
    const records = await this.prisma.workflowInstance.findMany({
      where: { workflowId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map(
      (record) =>
        new WorkflowInstance(
          record.id,
          record.workflowId,
          this.toDomainStatus(record.status),
          record.createdAt,
          record.updatedAt,
        ),
    );
  }

  async findByStatus(
    status: WorkflowInstanceStatus,
  ): Promise<WorkflowInstance[]> {
    const records = await this.prisma.workflowInstance.findMany({
      where: { status: this.toPrismaStatus(status) },
      orderBy: { createdAt: 'desc' },
    });
    return records.map(
      (record) =>
        new WorkflowInstance(
          record.id,
          record.workflowId,
          this.toDomainStatus(record.status),
          record.createdAt,
          record.updatedAt,
        ),
    );
  }
}
