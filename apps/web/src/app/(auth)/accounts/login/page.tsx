import { LoginForm } from '@/features/auth/components/login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return <LoginForm oauthFailed={error === 'oauth'} />;
}
