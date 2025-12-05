export interface QueuePort {
  publish(topic: string, message: any): Promise<void>;
}
