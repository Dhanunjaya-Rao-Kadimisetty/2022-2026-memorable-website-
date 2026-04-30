import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function YearbookProfilePage({ params }: Props) {
  await params;
  redirect('/yearbook');
}
