import { ForgotPasswordForm } from '@/features/auth/components/forgot-password-form';
import { ResetPasswordForm } from '@/features/auth/components/reset-password-form';

// Без token — запрос ссылки; с token (ссылка из письма) — ввод нового пароля.
export default async function PasswordResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return token ? <ResetPasswordForm token={token} /> : <ForgotPasswordForm />;
}
