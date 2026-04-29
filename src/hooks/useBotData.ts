import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type { Json } from '@/types/api';
import * as botApi from '@/lib/botApi';

export function useBotSettings() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['bot-settings', user?.id],
    queryFn: () => botApi.getOrCreateSettings(),
    enabled: !!user,
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (updates: Parameters<typeof botApi.updateSettings>[0]) =>
      botApi.updateSettings(updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bot-settings'] });
      qc.invalidateQueries({ queryKey: ['discord-bot-profile'] });
    },
  });
}

export function useBotFeatures() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['bot-features', user?.id],
    queryFn: () => botApi.getFeatures(),
    enabled: !!user,
  });
}

export function useUpdateFeature() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: { enabled?: boolean; config?: Json } }) =>
      botApi.updateFeature(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bot-features'] }),
  });
}

export function useBotLogs() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['bot-logs', user?.id],
    queryFn: () => botApi.getLogs(),
    enabled: !!user,
    refetchInterval: 5000,
  });
}

export function useAddLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ level, message }: { level: string; message: string }) =>
      botApi.addLog(level, message),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bot-logs'] }),
  });
}

export function useSendDiscordMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ channelId, message, repeatCount, respectRateLimit }: { channelId: string; message: string; repeatCount?: number; respectRateLimit?: boolean }) =>
      botApi.sendDiscordMessage(channelId, message, repeatCount ?? 1, Boolean(respectRateLimit)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bot-logs'] }),
  });
}
