import { IsArray, IsString } from 'class-validator';

export class WorkflowDefinition {
  @IsArray()
  @IsString({ each: true })
  steps: string[];
}

export class Workflow {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly definition: WorkflowDefinition,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
