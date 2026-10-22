import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@/config/env';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  send(message: MailMessage): void {
    if (this.config.get('MAIL_DRIVER', { infer: true }) === 'log') {
      // Только для разработки: письмо (с кодом или ссылкой) пишется в лог вместо отправки.
      this.logger.log(`Mail to ${message.to}: ${message.subject}\n${message.text}`);
      return;
    }
    // SMTP-отправка появится вместе с продакшн-настройкой почты (Q23).
    throw new Error('MAIL_DRIVER=smtp is not implemented yet');
  }
}
