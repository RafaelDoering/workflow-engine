import { Workflow } from '../domain/workflow.entity';

export interface WorkflowRepositoryPort {
  saveWorkflow(workflow: Workflow): Promise<void>;
  findWorkflowById(id: string): Promise<Workflow | null>;
}
