import { Controller, Post, Body, Param } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { TaskPayload } from '@app/core';

type StartWorkflowRequest = { payload: TaskPayload };

@Controller('workflows')
export class ApiController {
  constructor(private workflowService: WorkflowService) { }

  @Post(':id/start')
  async startWorkflow(
    @Param('id') id: string,
    @Body() body: StartWorkflowRequest,
  ) {
    return this.workflowService.startWorkflow(id, body.payload);
  }
}
