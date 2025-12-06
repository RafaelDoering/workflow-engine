import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { WorkflowService, InstanceWithTasks } from './workflow.service';
import { WorkflowInstance } from '@app/core/domain/workflow-instance.entity';
import { Workflow } from '@app/core/domain/workflow.entity';
import { StartWorkflowDto } from './dtos/start-workflow.dto';
import { CreateWorkflowDto } from './dtos/create-workflow.dto';

@Controller('workflows')
export class ApiController {
  constructor(private workflowService: WorkflowService) {}

  @Post()
  async createWorkflow(
    @Body() body: CreateWorkflowDto,
  ): Promise<{ id: string }> {
    return this.workflowService.createWorkflow(body);
  }

  @Get()
  async listWorkflows(): Promise<Workflow[]> {
    return this.workflowService.listWorkflows();
  }

  @Get(':id/instances')
  async getInstances(
    @Param('id') workflowId: string,
  ): Promise<WorkflowInstance[]> {
    return this.workflowService.getInstances(workflowId);
  }

  @Post(':id/start')
  async startWorkflow(
    @Param('id') id: string,
    @Body() body: StartWorkflowDto,
  ): Promise<{ instanceId: string }> {
    return this.workflowService.startWorkflow(id, body.payload);
  }

  @Get(':workflowId/instances/:instanceId')
  async getInstance(
    @Param('instanceId') instanceId: string,
  ): Promise<InstanceWithTasks | null> {
    return this.workflowService.getInstance(instanceId);
  }

  @Post(':workflowId/instances/:instanceId/cancel')
  async cancelInstance(
    @Param('instanceId') instanceId: string,
  ): Promise<{ success: boolean }> {
    return this.workflowService.cancelInstance(instanceId);
  }
}
