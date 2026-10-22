'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { getApiError, showApiError } from '@/lib/api/errors';
import {
  useDisableTwoFactorMutation,
  useEnableTwoFactorMutation,
  useSetupTwoFactorMutation,
} from '../api';
import { Section, SettingsHeading, TextField } from './fields';

type Step = 'idle' | 'code' | 'codes';

export function TwoFactorSettings() {
  const [setup, { data: setupData, isLoading: isSettingUp }] = useSetupTwoFactorMutation();
  const [enable, { isLoading: isEnabling }] = useEnableTwoFactorMutation();
  const [disable, { isLoading: isDisabling }] = useDisableTwoFactorMutation();

  const [step, setStep] = useState<Step>('idle');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string>();
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string>();

  async function handleSetup() {
    try {
      await setup().unwrap();
      setStep('code');
    } catch (error) {
      if (getApiError(error).status === 409) toast.info('Двухфакторная защита уже включена');
      else showApiError(error);
    }
  }

  async function handleEnable(e: React.FormEvent) {
    e.preventDefault();
    setCodeError(undefined);
    try {
      const result = await enable(code.trim()).unwrap();
      setBackupCodes(result.backupCodes);
      setCode('');
      setStep('codes');
    } catch (error) {
      if (getApiError(error).status === 400) setCodeError('Неверный код');
      else showApiError(error);
    }
  }

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(undefined);
    try {
      await disable(password).unwrap();
      setPassword('');
      toast.success('Двухфакторная защита отключена');
    } catch (error) {
      if (getApiError(error).status === 400) setPasswordError('Неверный пароль');
      else showApiError(error);
    }
  }

  return (
    <div>
      <SettingsHeading>Двухфакторная защита</SettingsHeading>

      <Section title="Включить">
        {step === 'idle' && (
          <>
            <p className="text-14 text-muted-foreground">
              При входе потребуется код из приложения-аутентификатора.
            </p>
            <Button onClick={handleSetup} disabled={isSettingUp}>
              Настроить
            </Button>
          </>
        )}

        {step === 'code' && setupData && (
          <form onSubmit={handleEnable} className="max-w-[400px] space-y-4">
            <p className="text-14">
              Добавьте аккаунт в приложение-аутентификатор: отсканируйте QR-код из ссылки ниже или
              введите секрет вручную.
            </p>
            <a
              href={setupData.otpauthUrl}
              className="block text-14 break-all text-link-profile"
              rel="noopener nofollow"
            >
              Открыть в приложении-аутентификаторе
            </a>
            <div className="rounded-lg bg-background-secondary p-3 text-14">
              Секрет: <code className="font-mono font-semibold break-all">{setupData.secret}</code>
            </div>
            <TextField
              label="Код из приложения"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              error={codeError}
            />
            <Button type="submit" disabled={isEnabling || code.trim().length !== 6}>
              Включить
            </Button>
          </form>
        )}

        {step === 'codes' && (
          <div className="space-y-3">
            <p className="text-14">
              Двухфакторная защита включена. Сохраните резервные коды — они показываются один раз.
            </p>
            <ul className="grid max-w-[400px] grid-cols-2 gap-2 rounded-lg bg-background-secondary p-3 font-mono text-14">
              {backupCodes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <Button variant="secondary" onClick={() => setStep('idle')}>
              Готово
            </Button>
          </div>
        )}
      </Section>

      <Section title="Отключить">
        <form onSubmit={handleDisable} className="max-w-[400px] space-y-4">
          <TextField
            label="Текущий пароль"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={passwordError}
          />
          <Button type="submit" variant="destructive" disabled={isDisabling || !password}>
            Отключить двухфакторную защиту
          </Button>
        </form>
      </Section>
    </div>
  );
}
