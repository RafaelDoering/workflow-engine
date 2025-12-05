export interface TaskLog {
  id: string;
  taskId: string;
  level: string;
  message: string;
  createdAt: Date;
}

export interface TaskLogRepositoryPort {
  createLog(taskId: string, level: string, message: string): Promise<void>;
  findByTaskId(taskId: string): Promise<TaskLog[]>;
}
