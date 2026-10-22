import { Injectable, Logger } from '@nestjs/common';
import type { NotificationType } from '@/generated/prisma/client';

export interface CreateNotificationInput {
  recipientId: string;
  actorId: string;
  type: NotificationType;
  postId?: string;
  commentId?: string;
  storyId?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  // Заглушка до T2.A2: поведение — запись в лог (без текста контента), в БД ничего не пишет.
  // Вызывать только после успешной транзакции основного действия.
  create(input: CreateNotificationInput): Promise<void> {
    this.logger.log(
      `notification ${input.type} actor=${input.actorId} recipient=${input.recipientId}`,
    );
    return Promise.resolve();
  }
}
