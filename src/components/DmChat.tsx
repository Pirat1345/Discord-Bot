import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Send, MessageCircle, ArrowLeft, Plus, Search, FileIcon, X, Copy, Check, Repeat, ChevronDown, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import * as botApi from '@/lib/botApi';
import type { DmChannel, DmMessage, DmRecipient } from '@/lib/botApi';

function formatTimestamp(iso: string, t: (key: string, opts?: Record<string, unknown>) => string) {
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  if (isToday) return t('discord.dmChat.today', { time });
  if (isYesterday) return t('discord.dmChat.yesterday', { time });
  return `${date.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })} ${time}`;
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function MessageBubble({ message, previousMessage, t }: { message: DmMessage; previousMessage?: DmMessage; t: (key: string, opts?: Record<string, unknown>) => string }) {
  const isOwn = message.is_own;
  const showAuthor =
    !previousMessage ||
    previousMessage.author.id !== message.author.id ||
    new Date(message.timestamp).getTime() - new Date(previousMessage.timestamp).getTime() > 5 * 60 * 1000;

  return (
    <div className={cn('group flex gap-3 px-4', showAuthor ? 'mt-4' : 'mt-0.5')}>
      {showAuthor ? (
        <Avatar className="h-9 w-9 mt-0.5 shrink-0">
          <AvatarImage src={message.author.avatar_url || undefined} alt={message.author.display_name} />
          <AvatarFallback className="text-xs">{getInitials(message.author.display_name)}</AvatarFallback>
        </Avatar>
      ) : (
        <div className="w-9 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        {showAuthor && (
          <div className="mb-0.5 flex items-baseline gap-2">
            <span className={cn('text-sm font-semibold', isOwn ? 'text-primary' : 'text-foreground')}>
              {message.author.display_name}
              {message.author.is_bot && (
                <span className="ml-1.5 rounded bg-primary/20 px-1 py-0.5 text-[10px] font-medium uppercase text-primary">
                  Bot
                </span>
              )}
            </span>
            <span className="text-[11px] text-muted-foreground">{formatTimestamp(message.timestamp, t)}</span>
          </div>
        )}
        {message.content && (
          <p className="text-sm text-foreground whitespace-pre-wrap break-words">{message.content}</p>
        )}
        {message.attachments.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-2">
            {message.attachments.map((att) => {
              const isImage = att.content_type?.startsWith('image/');
              if (isImage) {
                return (
                  <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer" className="block">
                    <img
                      src={att.url}
                      alt={att.filename}
                      className="max-h-60 max-w-xs rounded-lg border border-border object-contain"
                    />
                  </a>
                );
              }
              return (
                <a
                  key={att.id}
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground hover:bg-secondary"
                >
                  <FileIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate max-w-[200px]">{att.filename}</span>
                  <span className="text-xs text-muted-foreground">
                    {att.size < 1024 ? `${att.size} B` : `${(att.size / 1024).toFixed(0)} KB`}
                  </span>
                </a>
              );
            })}
          </div>
        )}
        {message.embeds > 0 && !message.content && !message.attachments.length && (
          <p className="text-xs italic text-muted-foreground">[Embed]</p>
        )}
        {message.edited_timestamp && (
          <span className="text-[10px] text-muted-foreground">{t('discord.dmChat.edited')}</span>
        )}
      </div>
    </div>
  );
}

export function DmChat({ activeBotProfileId }: { activeBotProfileId?: string | null }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [selectedRecipient, setSelectedRecipient] = useState<DmRecipient | null>(null);
  const [newDmUserId, setNewDmUserId] = useState('');
  const [messageText, setMessageText] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [showTools, setShowTools] = useState(false);
  const [repeatCount, setRepeatCount] = useState('1');
  const [copiedId, setCopiedId] = useState(false);

  // Reset selection when bot profile changes
  useEffect(() => {
    setSelectedChannelId(null);
    setSelectedRecipient(null);
  }, [activeBotProfileId]);

  // Fetch DM channel list (per bot profile)
  const { data: dmChannels, isLoading: channelsLoading } = useQuery({
    queryKey: ['dm-channels', activeBotProfileId ?? '_default'],
    queryFn: () => botApi.getDmChannels(),
    refetchInterval: 10000,
  });

  // Fetch messages for selected channel
  const { data: messagesData, isLoading: messagesLoading, refetch: refetchMessages } = useQuery({
    queryKey: ['dm-messages', activeBotProfileId ?? '_default', selectedChannelId],
    queryFn: () => botApi.getDmMessages(selectedChannelId!),
    enabled: !!selectedChannelId,
    refetchInterval: 3000,
  });

  const messages = messagesData?.messages || [];
  const sortedMessages = [...messages].reverse(); // API returns newest first, we want oldest first

  // Send DM
  const sendDm = useMutation({
    mutationFn: ({ userId, message, repeat, rateLimit }: { userId: string; message: string; repeat?: number; rateLimit?: boolean }) =>
      botApi.sendDiscordDm(userId, message, repeat ?? 1, Boolean(rateLimit)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dm-messages', activeBotProfileId ?? '_default', selectedChannelId] });
      qc.invalidateQueries({ queryKey: ['dm-channels', activeBotProfileId ?? '_default'] });
      qc.invalidateQueries({ queryKey: ['bot-logs'] });
    },
  });

  // Open new DM channel
  const openDm = useMutation({
    mutationFn: (recipientId: string) => botApi.openDmChannel(recipientId),
    onSuccess: async (data) => {
      if (data.recipient) {
        setSelectedRecipient(data.recipient);
      }
      setSelectedChannelId(data.id);
      setNewDmUserId('');
      await qc.refetchQueries({ queryKey: ['dm-channels', activeBotProfileId ?? '_default'] });
    },
  });

  // Delete DM channel from list
  const deleteDm = useMutation({
    mutationFn: (channelId: string) => botApi.deleteDmChannel(channelId),
    onSuccess: (_data, channelId) => {
      if (selectedChannelId === channelId) {
        setSelectedChannelId(null);
        setSelectedRecipient(null);
      }
      qc.invalidateQueries({ queryKey: ['dm-channels', activeBotProfileId ?? '_default'] });
    },
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (shouldAutoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [sortedMessages.length, shouldAutoScroll]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 80;
    setShouldAutoScroll(isNearBottom);
  }, []);

  const handleSendMessage = async (options?: { rateLimit?: boolean }) => {
    const text = messageText.trim();
    if (!text || !selectedRecipient) return;
    const repeat = Math.max(1, Number.parseInt(repeatCount || '1', 10) || 1);

    try {
      await sendDm.mutateAsync({ userId: selectedRecipient.id, message: text, repeat, rateLimit: options?.rateLimit });
      setMessageText('');
      setShouldAutoScroll(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('discord.dmChat.sendError');
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    }
  };

  const handleCopyUserId = async () => {
    if (!selectedRecipient) return;
    try {
      await navigator.clipboard.writeText(selectedRecipient.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      toast({ title: t('common.error'), description: t('discord.dmChat.copyError'), variant: 'destructive' });
    }
  };

  const handleOpenNewDm = async () => {
    const id = newDmUserId.trim();
    if (!id) return;
    try {
      await openDm.mutateAsync(id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('discord.dmChat.dmOpenError');
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    }
  };

  const handleSelectChannel = (channel: DmChannel) => {
    const recipient = channel.recipients[0] || null;
    setSelectedRecipient(recipient);
    setSelectedChannelId(channel.id);
    setShouldAutoScroll(true);
  };

  const filteredChannels = (dmChannels || []).filter((ch) => {
    if (!contactSearch.trim()) return true;
    const search = contactSearch.toLowerCase();
    return ch.recipients.some(
      (r) =>
        r.username.toLowerCase().includes(search) ||
        r.display_name.toLowerCase().includes(search) ||
        r.id.includes(search)
    );
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]" style={{ height: 'calc(100svh - 13rem)' }}>
      {/* Sidebar: DM contacts */}
      <Card className="bg-card border-border flex flex-col overflow-hidden">
        <div className="p-3 pb-2 space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
              placeholder={t('discord.dmChat.searchPlaceholder')}
              className="bg-secondary border-border pl-9 text-foreground text-sm h-9"
            />
          </div>
          <div className="flex gap-2">
            <Input
              value={newDmUserId}
              onChange={(e) => setNewDmUserId(e.target.value)}
              placeholder={t('discord.dmChat.userIdPlaceholder')}
              className="bg-secondary border-border text-foreground text-sm h-9 flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleOpenNewDm();
              }}
            />
            <Button
              size="sm"
              className="h-9 gap-1"
              disabled={!newDmUserId.trim() || openDm.isPending}
              onClick={handleOpenNewDm}
            >
              {openDm.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {channelsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !filteredChannels.length ? (
            <div className="px-4 py-8 text-center">
              <MessageCircle className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <p className="mt-2 text-sm text-muted-foreground">
                {contactSearch ? t('discord.dmChat.noResults') : t('discord.dmChat.noDms')}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('discord.dmChat.noDmsHint')}
              </p>
            </div>
          ) : (
            <div className="space-y-0.5 p-1">
              {filteredChannels.map((channel) => {
                const recipient = channel.recipients[0];
                if (!recipient) return null;
                const isActive = selectedChannelId === channel.id;

                return (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => handleSelectChannel(channel)}
                    className={cn(
                      'group/item w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                      isActive
                        ? 'bg-primary/10 text-foreground'
                        : 'text-foreground hover:bg-secondary/70'
                    )}
                  >
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarImage src={recipient.avatar_url || undefined} alt={recipient.display_name} />
                      <AvatarFallback className="text-xs">{getInitials(recipient.display_name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{recipient.display_name}</p>
                      <p className="truncate text-xs text-muted-foreground">@{recipient.username}</p>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/20 hover:text-destructive group-hover/item:opacity-100"
                      title={t('discord.dmChat.removeConversation')}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteDm.mutate(channel.id);
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Chat area */}
      <Card className="bg-card border-border flex flex-col overflow-hidden">
        {!selectedChannelId ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <MessageCircle className="mx-auto h-12 w-12 text-muted-foreground/30" />
              <p className="mt-3 text-sm font-medium text-foreground">{t('discord.dmChat.selectConversation')}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('discord.dmChat.selectConversationHint')}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="border-b border-border">
              <div className="flex items-center gap-3 px-4 py-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden h-8 w-8"
                  onClick={() => {
                    setSelectedChannelId(null);
                    setSelectedRecipient(null);
                    setShowTools(false);
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                {selectedRecipient && (
                  <>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={selectedRecipient.avatar_url || undefined} alt={selectedRecipient.display_name} />
                      <AvatarFallback className="text-xs">{getInitials(selectedRecipient.display_name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{selectedRecipient.display_name}</p>
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-xs text-muted-foreground">@{selectedRecipient.username}</p>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="font-mono text-[11px] text-muted-foreground">{selectedRecipient.id}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title={t('discord.dmChat.copyUserId')}
                        onClick={handleCopyUserId}
                      >
                        {copiedId ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant={showTools ? 'secondary' : 'ghost'}
                        size="icon"
                        className="h-8 w-8"
                        title="Tools"
                        onClick={() => setShowTools((v) => !v)}
                      >
                        <ChevronDown className={cn('h-4 w-4 transition-transform', showTools && 'rotate-180')} />
                      </Button>
                    </div>
                  </>
                )}
              </div>

              {/* Tools panel */}
              {showTools && selectedRecipient && (
                <div className="border-t border-border/50 bg-secondary/30 px-4 py-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{t('discord.dmChat.repeatCount')}</span>
                    </div>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={repeatCount}
                      onChange={(e) => setRepeatCount(e.target.value)}
                      className="bg-secondary border-border text-foreground h-8 w-20 text-sm"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 gap-1.5 text-xs"
                      disabled={sendDm.isPending || !messageText.trim()}
                      onClick={() => handleSendMessage({ rateLimit: true })}
                    >
                      {sendDm.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                      {t('discord.dmChat.rateLimitSend')}
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-mono text-xs text-muted-foreground">Channel: {selectedChannelId}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      title={t('discord.dmChat.copyChannelId')}
                      onClick={async () => {
                        if (!selectedChannelId) return;
                        try {
                          await navigator.clipboard.writeText(selectedChannelId);
                          toast({ title: t('discord.dmChat.channelIdCopied') });
                        } catch {
                          // ignore
                        }
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Messages */}
            <div
              ref={scrollAreaRef}
              className="flex-1 overflow-y-auto py-2"
              onScroll={handleScroll}
            >
              {messagesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : sortedMessages.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-center">
                  <div>
                    <MessageCircle className="mx-auto h-8 w-8 text-muted-foreground/30" />
                    <p className="mt-2 text-sm text-muted-foreground">{t('discord.dmChat.noMessages')}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('discord.dmChat.noMessagesHint')}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="pb-2">
                  {sortedMessages.map((msg, i) => (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      previousMessage={i > 0 ? sortedMessages[i - 1] : undefined}
                      t={t}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Message input */}
            <div className="border-t border-border p-3">
              <div className="flex gap-2">
                <Input
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder={selectedRecipient ? t('discord.dmChat.messageTo', { name: selectedRecipient.display_name }) : t('discord.dmChat.messagePlaceholder')}
                  className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={sendDm.isPending}
                />
                <Button
                  onClick={() => handleSendMessage()}
                  disabled={sendDm.isPending || !messageText.trim()}
                  className="gap-2 shrink-0"
                >
                  {sendDm.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
