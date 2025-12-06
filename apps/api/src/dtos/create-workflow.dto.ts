import { IsString, IsNotEmpty, IsObject } from 'class-validator';
import type { WorkflowDefinition } from '@app/core/domain/workflow.entity';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWorkflowDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'The name for the workflow',
    example: 'invoice',
  })
  name: string;

  @IsObject()
  @IsNotEmpty()
  @ApiProperty({
    description: 'The definition for the workflow',
    example: {
      steps: ['fetch-orders', 'create-invoice', 'pdf-process', 'send-email'],
    }
  })
  definition: WorkflowDefinition;
}
