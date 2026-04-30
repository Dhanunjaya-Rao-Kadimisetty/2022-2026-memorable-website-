import PeopleClient from '@/components/PeopleClient';

export const dynamic = 'force-dynamic';

export default async function PeoplePage() {
  return <PeopleClient profiles={[]} gallery={[]} />;
}
