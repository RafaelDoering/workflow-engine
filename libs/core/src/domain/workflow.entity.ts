import { z } from 'zod';

export const WorkflowDefinitionSchema = z.object({
  steps: z.array(z.string()),
});

export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;

export class Workflow {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly definition: WorkflowDefinition,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
