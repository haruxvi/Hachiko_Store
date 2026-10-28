import { getSession } from '@/src/lib/auth/session';
import { redirect } from 'next/navigation';
import PanelSidebar from '@/src/components/panel/PanelSidebar';
import SessionKeepAlive from '@/src/components/panel/SessionKeepAlive';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== 'SELLER') {
    redirect('/login');
  }

  return (
    <div className="flex min-h-screen flex-col bg-cream lg:flex-row">
      <SessionKeepAlive />
      <PanelSidebar email={session.email} />
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
