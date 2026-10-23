import { SettingsNav } from '@/features/settings/components/settings-nav';

// Раскладка настроек: слева разделы, справа содержимое (SCREENS §3.14).
export default function AccountsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[1094px] flex-col md:min-h-screen md:flex-row">
      <SettingsNav className="hidden md:flex" />
      <div className="min-w-0 flex-1 px-3 pb-6 md:max-w-[694px] md:pt-12 md:pr-0 md:pl-[84px]">
        {children}
      </div>
    </div>
  );
}
