import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Bot, Languages, Settings2, User, Users } from 'lucide-react';
import { includesSearch, PageShell } from './_shared';

export function SettingsHome() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [search, setSearch] = useState('');
  const normalizedSearch = search.trim().toLowerCase();

  const cards = [
    {
      title: t('settings.cards.profile.title'),
      description: t('settings.cards.profile.description'),
      icon: User,
      url: '/settings/profile',
      aliases: ['profil', 'profile', 'avatar', 'anzeigename', 'display name', 'login', 'benutzername', 'passwort', 'account'],
      show: true,
    },
    {
      title: t('settings.cards.users.title'),
      description: t('settings.cards.users.description'),
      icon: Users,
      url: '/settings/users',
      aliases: ['benutzer', 'user', 'accounts', 'rollen', 'admin'],
      show: isAdmin,
    },
    {
      title: t('settings.cards.configuration.title'),
      description: t('settings.cards.configuration.description'),
      icon: Settings2,
      url: '/settings/configuration/general',
      aliases: ['konfiguration', 'allgemein', 'branding', 'app icon', 'app name'],
      show: true,
    },
    {
      title: t('settings.cards.discord.title'),
      description: t('settings.cards.discord.description'),
      icon: Bot,
      url: '/settings/configuration/discord',
      state: { highlight: 'discord-token' },
      aliases: ['discord', 'bot', 'token', 'prefix', 'bot token'],
      show: true,
    },
    {
      title: t('settings.cards.language.title'),
      description: t('settings.cards.language.description'),
      icon: Languages,
      url: '/settings/language',
      aliases: ['sprache', 'language', 'übersetzung', 'translation', 'i18n', 'deutsch', 'english'],
      show: true,
    },
  ].filter((card) => card.show && (!normalizedSearch || includesSearch(normalizedSearch, [card.title, card.description, ...card.aliases])));

  return (
    <PageShell
      title={t('settings.title')}
      description={t('settings.description')}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder={t('settings.searchAll')}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.length ? (
          cards.map((card) => (
            <Button
              key={card.title}
              asChild
              variant="outline"
              className="h-36 flex-col items-center justify-center gap-3 rounded-xl border-border bg-card px-4 py-6 text-center shadow-sm transition-transform hover:-translate-y-0.5 hover:border-primary/40"
            >
              <NavLink to={card.url} state={card.state} className="flex h-full w-full flex-col items-center justify-center gap-3">
                <card.icon className="h-8 w-8" />
                <div className="space-y-1">
                  <div className="text-base font-semibold">{card.title}</div>
                  <div className="text-xs text-muted-foreground">{card.description}</div>
                </div>
              </NavLink>
            </Button>
          ))
        ) : (
          <div className="space-y-3 sm:col-span-2 xl:col-span-3">
            <Card className="border-border bg-card">
              <CardContent className="py-8 text-sm text-muted-foreground">{t('settings.noResults')}</CardContent>
            </Card>
          </div>
        )}
      </div>
    </PageShell>
  );
}
