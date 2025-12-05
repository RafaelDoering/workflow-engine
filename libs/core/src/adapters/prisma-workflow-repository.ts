import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Workflow, WorkflowDefinitionSchema } from '../domain/workflow.entity';
import { WorkflowRepositoryPort } from '../ports/workflow-repository.port';

@Injectable()
export class PrismaWorkflowRepository implements WorkflowRepositoryPort {
  constructor(private prisma: PrismaClient) {}

  async saveWorkflow(workflow: Workflow): Promise<void> {
    await this.prisma.workflow.upsert({
      where: { id: workflow.id },
      update: {
        name: workflow.name,
        definition: workflow.definition,
        updatedAt: workflow.updatedAt,
      },
      create: {
        id: workflow.id,
        name: workflow.name,
        definition: workflow.definition,
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
      },
    });
  }

  async findWorkflowById(id: string): Promise<Workflow | null> {
    const record = await this.prisma.workflow.findUnique({ where: { id } });
    if (!record) return null;

    const definition = WorkflowDefinitionSchema.parse(record.definition);

    return new Workflow(
      record.id,
      record.name,
      definition,
      record.createdAt,
      record.updatedAt,
    );
  }
}
