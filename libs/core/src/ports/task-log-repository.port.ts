export interface TaskLogRepositoryPort {
  createLog(taskId: string, level: string, message: string): Promise<void>;
}
