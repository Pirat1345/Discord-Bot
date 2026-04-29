import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Loader2 } from 'lucide-react';

export default function AppLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (user.must_change_password) return <Navigate to="/setup" replace />;

  return (
    <SidebarProvider>
      <div className="flex h-svh w-full overflow-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="flex h-16 items-center justify-between border-b border-border px-4 md:border-b-0">
            <SidebarTrigger className="text-muted-foreground md:hidden" />
          </header>
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
