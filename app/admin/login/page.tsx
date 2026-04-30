import AdminLoginClient from './AdminLoginClient';

export const dynamic = 'force-dynamic';

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const nextParam = resolvedSearchParams.next;
  const nextPath = Array.isArray(nextParam) ? nextParam[0] : nextParam || '/admin';

  return <AdminLoginClient nextPath={nextPath} />;
}
