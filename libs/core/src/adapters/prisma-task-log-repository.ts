import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import {
  TaskLogRepositoryPort,
  TaskLog,
} from '../ports/task-log-repository.port';

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

  async findByTaskId(taskId: string): Promise<TaskLog[]> {
    const records = await this.prisma.taskLog.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
    });
    return records.map((record) => ({
      id: record.id,
      taskId: record.taskId,
      level: record.level,
      message: record.message,
      createdAt: record.createdAt,
    }));
  }
}
