import { createAvatarDataUrl } from '@/lib/avatar';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

export function avatarInfo(username?: string | null) {
  const name = username?.trim() || 'User';
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return {
    src: createAvatarDataUrl(name),
    initials,
    name,
  };
}

export function includesSearch(search: string, values: string[]) {
  if (!search) return true;
  return values.some((value) => value.toLowerCase().includes(search));
}

export function PageShell({
  title,
  description,
  children,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search settings...',
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        {onSearchChange && (
          <div className="relative max-w-xl pt-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchValue ?? ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="bg-card border-border pl-9 text-foreground"
            />
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
