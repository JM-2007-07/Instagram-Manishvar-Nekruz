import type { Metadata } from 'next';
import { LocationPage } from '@/features/explore/components/location-page';

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: 'Место' };

export default async function Page({ params }: Props) {
  const { id } = await params;
  return <LocationPage id={id} />;
}
