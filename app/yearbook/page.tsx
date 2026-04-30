import YearbookClient from '@/components/YearbookClient';

export const dynamic = 'force-dynamic';

export default async function YearbookPage() {
  return <YearbookClient profiles={[]} gallery={[]} />;
}
