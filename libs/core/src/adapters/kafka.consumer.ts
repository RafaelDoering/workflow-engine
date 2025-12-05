import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { Task } from '@app/core/domain/task.entity';

export type MessageHandler = (payload: Task) => Promise<void>;

@Injectable()
export class KafkaConsumer implements OnModuleInit, OnModuleDestroy {
  private kafka: Kafka;
  private consumer: Consumer;
  private messageHandler: MessageHandler | null = null;

  constructor() {
    this.kafka = new Kafka({
      clientId: 'workflow-worker',
      brokers: ['localhost:19092'],
    });
    this.consumer = this.kafka.consumer({ groupId: 'workflow-workers' });
  }

  async onModuleInit() {
    await this.consumer.connect();
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
  }

  setMessageHandler(handler: MessageHandler) {
    this.messageHandler = handler;
  }

  async start() {
    await this.consumer.subscribe({
      topic: 'task-queue',
      fromBeginning: false,
    });
    await this.consumer.run({
      eachMessage: async (payload: EachMessagePayload) => {
        const { message } = payload;
        if (!message.value) return;

        try {
          const data = JSON.parse(message.value.toString()) as Task;
          if (this.messageHandler) {
            await this.messageHandler(data);
          }
        } catch (error) {
          console.error('Error processing message:', error);
        }
      },
    });
  }
}
