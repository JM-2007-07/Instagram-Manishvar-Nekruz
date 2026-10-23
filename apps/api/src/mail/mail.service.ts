import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { Env } from '@/config/env';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

// Письма: MAIL_DRIVER=log — в журнал сервера (разработка), smtp — настоящая отправка через SMTP
// (например, Gmail с паролем приложения). Данные SMTP — только в apps/api/.env, в коде их нет.
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService<Env, true>) {}

  async send(message: MailMessage): Promise<void> {
    if (this.config.get('MAIL_DRIVER', { infer: true }) === 'log') {
      // Только для разработки: письмо (с кодом или ссылкой) пишется в лог вместо отправки.
      this.logger.log(`Mail to ${message.to}: ${message.subject}
${message.text}`);
      return;
    }
    await this.smtp().sendMail({
      from: this.config.get('MAIL_FROM', { infer: true }),
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
    this.logger.log(`Mail sent to ${message.to}: ${message.subject}`); // без текста: в нём код
  }

  // Подключение создаётся один раз, при первом письме.
  private smtp(): Transporter {
    if (!this.transporter) {
      const port = this.config.get('SMTP_PORT', { infer: true }) ?? 587;
      const user = this.config.get('SMTP_USER', { infer: true });
      const pass = this.config.get('SMTP_PASSWORD', { infer: true });
      this.transporter = createTransport({
        host: this.config.get('SMTP_HOST', { infer: true }),
        port,
        secure: port === 465,
        auth: user ? { user, pass } : undefined,
      });
    }
    return this.transporter;
  }
}
