import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@app/prisma/client';
import { plainToInstance } from 'class-transformer';
import { Workflow, WorkflowDefinition } from '../domain/workflow.entity';
import { WorkflowRepositoryPort } from '../ports/workflow-repository.port';

@Injectable()
export class PrismaWorkflowRepository implements WorkflowRepositoryPort {
  constructor(private prisma: PrismaClient) {}

  async saveWorkflow(workflow: Workflow): Promise<void> {
    await this.prisma.workflow.upsert({
      where: { id: workflow.id },
      update: {
        name: workflow.name,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        definition: workflow.definition as any, // Cast to any to bypass strict JSON type check for class instance
        updatedAt: workflow.updatedAt,
      },
      create: {
        id: workflow.id,
        name: workflow.name,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        definition: workflow.definition as any,
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
      },
    });
  }

  async findWorkflowById(id: string): Promise<Workflow | null> {
    const record = await this.prisma.workflow.findUnique({ where: { id } });
    if (!record) return null;

    const definition = plainToInstance(WorkflowDefinition, record.definition);

    return new Workflow(
      record.id,
      record.name,
      definition,
      record.createdAt,
      record.updatedAt,
    );
  }

  async findAllWorkflows(): Promise<Workflow[]> {
    const records = await this.prisma.workflow.findMany();
    return records.map((record) => {
      const definition = plainToInstance(WorkflowDefinition, record.definition);
      return new Workflow(
        record.id,
        record.name,
        definition,
        record.createdAt,
        record.updatedAt,
      );
    });
  }
}
