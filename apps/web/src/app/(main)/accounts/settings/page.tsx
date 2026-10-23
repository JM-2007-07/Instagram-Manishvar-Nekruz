import { EditProfileForm } from '@/features/settings/components/edit-profile-form';
import { SettingsNav } from '@/features/settings/components/settings-nav';

// Как у Instagram: на телефоне здесь список разделов, на компьютере — «Редактировать профиль».
export default function Page() {
  return (
    <>
      <SettingsNav className="-mx-3 md:hidden" />
      <div className="hidden md:block">
        <EditProfileForm />
      </div>
    </>
  );
}
