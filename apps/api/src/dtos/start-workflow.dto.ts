import { ApiProperty } from '@nestjs/swagger';
import type { TaskPayload } from '@app/core';

export class StartWorkflowDto {
  @ApiProperty({
    description: 'The initial payload for the workflow',
    example: { orderId: '123' },
  })
  payload: TaskPayload;
}
