import { Controller, Post, Body, Param } from '@nestjs/common';
import { WorkflowService } from './workflow.service';

@Controller('workflows')
export class ApiController {
  constructor(private readonly workflowService: WorkflowService) { }

  @Post(':id/start')
  async startWorkflow(@Param('id') id: string, @Body() body: { payload: any }) {
    return this.workflowService.startWorkflow(id, body.payload);
  }
}
