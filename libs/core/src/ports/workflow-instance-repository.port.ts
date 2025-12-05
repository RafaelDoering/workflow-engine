import { WorkflowInstance } from '../domain/workflow-instance.entity';

export interface WorkflowInstanceRepositoryPort {
  saveWorkflowInstance(instance: WorkflowInstance): Promise<void>;
  findWorkflowInstanceById(id: string): Promise<WorkflowInstance | null>;
  findByWorkflowId(workflowId: string): Promise<WorkflowInstance[]>;
}
