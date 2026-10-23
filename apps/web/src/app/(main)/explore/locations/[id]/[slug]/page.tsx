import type { Metadata } from 'next';
import { LocationPage } from '@/features/explore/components/location-page';

type Props = { params: Promise<{ id: string; slug: string }> };

export const metadata: Metadata = { title: 'Место' };

// Тот же экран, что и /explore/locations/{id}/ — slug нужен только для красивого адреса.
export default async function Page({ params }: Props) {
  const { id } = await params;
  return <LocationPage id={id} />;
}
