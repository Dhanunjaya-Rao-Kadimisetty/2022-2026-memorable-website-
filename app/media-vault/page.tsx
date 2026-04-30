import MediaVaultClient from '@/components/MediaVaultClient';

export const dynamic = 'force-dynamic';

export default async function MediaVaultPage() {
  return <MediaVaultClient images={[]} />;
}
