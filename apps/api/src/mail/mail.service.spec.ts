import type { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import type { Env } from '@/config/env';
import { MailService } from './mail.service';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

const sendMail = jest.fn().mockResolvedValue({});
(createTransport as jest.Mock).mockReturnValue({ sendMail });

function service(env: Partial<Env>): MailService {
  const config = { get: (key: keyof Env) => env[key] } as unknown as ConfigService<Env, true>;
  return new MailService(config);
}

const message = { to: 'a@example.test', subject: 'Код', text: 'Ваш код: 123456' };

describe('MailService', () => {
  beforeEach(() => {
    sendMail.mockClear();
    (createTransport as jest.Mock).mockClear();
  });

  it('log: письмо не отправляется по SMTP', async () => {
    await service({ MAIL_DRIVER: 'log' }).send(message);
    expect(createTransport).not.toHaveBeenCalled();
  });

  it('smtp: отправляет письмо от MAIL_FROM; 465 — сразу TLS; подключение создаётся один раз', async () => {
    const mail = service({
      MAIL_DRIVER: 'smtp',
      MAIL_FROM: 'App <app@example.test>',
      SMTP_HOST: 'smtp.example.test',
      SMTP_PORT: 465,
      SMTP_USER: 'app@example.test',
      SMTP_PASSWORD: 'secret',
    });
    await mail.send(message);
    await mail.send(message);
    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.test',
      port: 465,
      secure: true,
      auth: { user: 'app@example.test', pass: 'secret' },
    });
    expect(sendMail).toHaveBeenCalledWith({ from: 'App <app@example.test>', ...message });
  });

  it('smtp: ошибка отправки доходит до вызывающего кода', async () => {
    sendMail.mockRejectedValueOnce(new Error('auth failed'));
    const mail = service({ MAIL_DRIVER: 'smtp', SMTP_HOST: 'h', SMTP_PORT: 587 });
    await expect(mail.send(message)).rejects.toThrow('auth failed');
  });
});
