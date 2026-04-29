import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronDown, Bot, Globe, Home, User, Users } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/hooks/useAuth';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

const PROFILE_OPEN_KEY = 'settings-sidebar:profile-open';
const CONFIGURATION_OPEN_KEY = 'settings-sidebar:configuration-open';

function readStoredOpenState(key: string) {
  if (typeof window === 'undefined') return false;

  try {
    return window.localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

function writeStoredOpenState(key: string, value: boolean) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Ignore storage errors.
  }
}

export function SettingsSidebar() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const isAdmin = user?.role === 'admin';
  const [profileOpen, setProfileOpen] = useState(() => readStoredOpenState(PROFILE_OPEN_KEY));
  const [configurationOpen, setConfigurationOpen] = useState(() => readStoredOpenState(CONFIGURATION_OPEN_KEY));

  const handleProfileOpenChange = (open: boolean) => {
    setProfileOpen(open);
    writeStoredOpenState(PROFILE_OPEN_KEY, open);
  };

  const handleConfigurationOpenChange = (open: boolean) => {
    setConfigurationOpen(open);
    writeStoredOpenState(CONFIGURATION_OPEN_KEY, open);
  };

  useEffect(() => {
    if (pathname.startsWith('/settings/profile') || pathname.startsWith('/settings/users')) {
      setProfileOpen(true);
      writeStoredOpenState(PROFILE_OPEN_KEY, true);
    }

    if (pathname.startsWith('/settings/configuration')) {
      setConfigurationOpen(true);
      writeStoredOpenState(CONFIGURATION_OPEN_KEY, true);
    }
  }, [pathname]);
  const profileLinks = [
    { title: 'Mein Profil', url: '/settings/profile', icon: User },
    ...(isAdmin ? [{ title: 'Benutzerverwaltung', url: '/settings/users', icon: Users }] : []),
  ];

  const configurationLinks = [
    { title: 'Allgemein', url: '/settings/configuration/general', icon: Globe },
    { title: 'Discord Bot', url: '/settings/configuration/discord', icon: Bot },
  ];

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild className="bg-sidebar-accent/40 hover:bg-sidebar-accent">
                <NavLink
                  to="/settings"
                  end
                  className="hover:bg-sidebar-accent/50"
                  activeClassName="bg-sidebar-accent text-primary font-medium"
                >
                  <Home className="mr-3 h-5 w-5" />
                  <span>Alle Einstellungen</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <Collapsible open={profileOpen} onOpenChange={handleProfileOpenChange}>
        <SidebarGroup>
          <CollapsibleTrigger asChild>
            <SidebarGroupLabel asChild className="cursor-pointer">
              <button type="button" className="flex w-full items-center justify-between px-2 text-sm uppercase tracking-wider text-muted-foreground">
                <span>Profil</span>
                <ChevronDown className={`h-5 w-5 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
              </button>
            </SidebarGroupLabel>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarGroupContent>
              <SidebarMenu>
                {profileLinks.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="hover:bg-sidebar-accent/50"
                        activeClassName="bg-sidebar-accent text-primary font-medium"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </CollapsibleContent>
        </SidebarGroup>
      </Collapsible>

      <Collapsible open={configurationOpen} onOpenChange={handleConfigurationOpenChange}>
        <SidebarGroup>
          <CollapsibleTrigger asChild>
            <SidebarGroupLabel asChild className="cursor-pointer">
              <button type="button" className="flex w-full items-center justify-between px-2 text-sm uppercase tracking-wider text-muted-foreground">
                <span>Konfiguration</span>
                <ChevronDown className={`h-5 w-5 transition-transform ${configurationOpen ? 'rotate-180' : ''}`} />
              </button>
            </SidebarGroupLabel>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarGroupContent>
              <SidebarMenu>
                {configurationLinks.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="hover:bg-sidebar-accent/50"
                        activeClassName="bg-sidebar-accent text-primary font-medium"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </CollapsibleContent>
        </SidebarGroup>
      </Collapsible>
    </>
  );
}