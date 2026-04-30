import { LayoutDashboard, Bot, LogOut, Settings, Gamepad2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DiscordIcon } from '@/components/icons/DiscordIcon';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { createAvatarDataUrl } from '@/lib/avatar';
import { SettingsSidebar } from '@/components/SettingsSidebar';
import { useQuery } from '@tanstack/react-query';
import { getAppBranding } from '@/lib/botApi';
import { useIsMobile } from '@/hooks/use-mobile';

const navItems = [
  { titleKey: 'nav.dashboard', url: '/', icon: LayoutDashboard },
  { titleKey: 'nav.discord', url: '/discord', icon: DiscordIcon },
  { titleKey: 'nav.games', url: '/games', icon: Gamepad2 },
];

export function AppSidebar() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { pathname } = useLocation();
  const isSettingsRoute = pathname.startsWith('/settings');
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { data: branding } = useQuery({
    queryKey: ['app-branding'],
    queryFn: getAppBranding,
  });
  const avatarSrc = user?.avatar_url || createAvatarDataUrl(user?.display_name ?? user?.username ?? 'User');
  const avatarFallback = (user?.display_name ?? user?.username ?? 'U')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <Sidebar collapsible={isMobile ? 'offcanvas' : 'none'} className="border-r border-sidebar-border">
      <SidebarHeader className="p-2 pb-1">
        <div className="px-0 pt-0 pb-2">
          <Link
            to="/"
            title={branding?.app_name || 'BotPanel'}
            className={cn('flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-sidebar-accent')}
          >
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-sidebar-border bg-sidebar-primary/10 shadow-sm">
              {branding?.icon_url ? (
                <img src={branding.icon_url} alt={branding.app_name} className="h-full w-full object-cover" />
              ) : (
                <Bot className="h-7 w-7 text-primary" />
              )}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <span className="block truncate text-[1.05rem] font-bold text-sidebar-foreground">{branding?.app_name || 'BotPanel'}</span>
            </div>
          </Link>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {isSettingsRoute ? (
          <SettingsSidebar />
        ) : (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground">
              <span className="sr-only">Navigation</span>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.titleKey}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === '/'}
                        className="hover:bg-sidebar-accent/50"
                        activeClassName="bg-sidebar-accent text-primary font-medium"
                      >
                        <item.icon className="mr-3 h-5 w-5" />
                        <span>{t(item.titleKey)}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="h-auto justify-start gap-3 px-3 py-3 text-sidebar-foreground hover:bg-sidebar-accent"
                  tooltip={user?.username ? t('appSidebar.profileOf', { username: user.username }) : t('appSidebar.profile')}
                >
                  <Avatar className="h-10 w-10 border border-sidebar-border">
                    <AvatarImage src={avatarSrc} alt={user?.username ?? 'User'} />
                    <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground">{avatarFallback}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="truncate text-sm font-semibold text-sidebar-foreground">
                      {user?.display_name ?? user?.username ?? 'User'}
                    </div>
                    <div className="truncate text-xs text-sidebar-foreground/60">
                      {user?.role === 'admin' ? t('appSidebar.admin') : t('appSidebar.user')}
                    </div>
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" sideOffset={8} className="mb-2 w-[18.5rem] max-w-[calc(100vw-1rem)]">
                <DropdownMenuLabel className="flex items-center gap-3 p-2">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={avatarSrc} alt={user?.username ?? 'User'} />
                    <AvatarFallback>{avatarFallback}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{user?.display_name ?? user?.username ?? 'User'}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {user?.role === 'admin' ? t('appSidebar.admin') : t('appSidebar.user')}
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate('/settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  {t('appSidebar.settings')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => signOut()} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  {t('appSidebar.signOut')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
