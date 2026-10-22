import { SettingsNav } from '@/features/settings/components/settings-nav';

// Раскладка настроек: слева разделы, справа содержимое (SCREENS §3.14).
export default function AccountsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[935px] flex-col md:min-h-screen md:flex-row">
      <SettingsNav />
      <div className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-8">{children}</div>
    </div>
  );
}
