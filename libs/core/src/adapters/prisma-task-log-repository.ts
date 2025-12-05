import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { TaskLogRepositoryPort } from '../ports/task-log-repository.port';

@Injectable()
export class PrismaTaskLogRepository implements TaskLogRepositoryPort {
  constructor(private prisma: PrismaClient) {}

  async createLog(
    taskId: string,
    level: string,
    message: string,
  ): Promise<void> {
    await this.prisma.taskLog.create({
      data: {
        id: uuidv4(),
        taskId,
        level,
        message,
      },
    });
  }
}
