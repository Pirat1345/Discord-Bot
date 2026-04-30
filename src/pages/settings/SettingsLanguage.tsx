import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/lib/apiClient';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { setLanguage } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, Download, Globe, Loader2, Plus, Search, Trash2, Upload } from 'lucide-react';
import { PageShell } from './_shared';

interface LanguageInfo {
  code: string;
  name: string;
  isDefault?: boolean;
}

export function SettingsLanguage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === 'admin';

  const [languages, setLanguages] = useState<LanguageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState(user?.language || 'de');
  const [savingLanguage, setSavingLanguage] = useState(false);
  const [search, setSearch] = useState('');
  const normalizedSearch = search.trim().toLowerCase();

  // Upload dialog
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadCode, setUploadCode] = useState('');
  const [uploadTranslations, setUploadTranslations] = useState<Record<string, unknown> | null>(null);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploading, setUploading] = useState(false);

  const [deletingCode, setDeletingCode] = useState<string | null>(null);

  useEffect(() => {
    loadLanguages();
  }, []);

  useEffect(() => {
    setSelectedLanguage(user?.language || 'de');
  }, [user?.language]);

  const loadLanguages = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ languages: LanguageInfo[] }>('/languages');
      setLanguages(data.languages);
    } catch {
      toast({ title: t('common.error'), description: t('common.languagePacksLoadError'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageChange = async (code: string) => {
    setSelectedLanguage(code);
    setSavingLanguage(true);
    try {
      await setLanguage(code);
      await apiFetch('/account/language', {
        method: 'PATCH',
        body: JSON.stringify({ language: code }),
      });
      const langInfo = languages.find((l) => l.code === code);
      toast({
        title: t('settingsLanguage.languageChanged'),
        description: t('settingsLanguage.languageChangedDescription', { name: langInfo?.name || code }),
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : t('common.unknownError');
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    } finally {
      setSavingLanguage(false);
    }
  };

  const handleDownload = async (code: string) => {
    try {
      const translations = await apiFetch<Record<string, unknown>>(`/languages/${code}`);
      const blob = new Blob([JSON.stringify(translations, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${code}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      const msg = error instanceof Error ? error.message : t('common.unknownError');
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    }
  };

  const handleDelete = async (code: string) => {
    const lang = languages.find((l) => l.code === code);
    if (!lang) return;

    if (lang.isDefault) {
      toast({ title: t('common.error'), description: t('settingsLanguage.deleteNotAllowed'), variant: 'destructive' });
      return;
    }

    if (languages.length <= 1) {
      toast({ title: t('common.error'), description: t('settingsLanguage.lastLanguage'), variant: 'destructive' });
      return;
    }

    const confirmed = window.confirm(t('settingsLanguage.deleteConfirm', { name: lang.name }));
    if (!confirmed) return;

    setDeletingCode(code);
    try {
      await apiFetch(`/languages/${code}`, { method: 'DELETE' });
      setLanguages((prev) => prev.filter((l) => l.code !== code));

      // If deleted language was active, switch to default
      if (selectedLanguage === code) {
        const defaultLang = languages.find((l) => l.isDefault)?.code || 'de';
        await handleLanguageChange(defaultLang);
      }

      toast({
        title: t('settingsLanguage.deleted'),
        description: t('settingsLanguage.deletedDescription', { name: lang.name }),
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : t('common.unknownError');
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    } finally {
      setDeletingCode(null);
    }
  };

  const handleFileChange = (file: File | null) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          toast({ title: t('common.error'), description: t('settingsLanguage.uploadError'), variant: 'destructive' });
          return;
        }
        setUploadTranslations(parsed);
        setUploadFileName(file.name);
      } catch {
        toast({ title: t('common.error'), description: t('settingsLanguage.uploadError'), variant: 'destructive' });
      }
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (!uploadName.trim() || !uploadCode.trim() || !uploadTranslations) {
      toast({ title: t('common.error'), description: t('settingsLanguage.uploadFieldsRequired'), variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const result = await apiFetch<{ language: LanguageInfo }>('/languages', {
        method: 'POST',
        body: JSON.stringify({
          code: uploadCode.trim().toLowerCase(),
          name: uploadName.trim(),
          translations: uploadTranslations,
        }),
      });

      // Refresh language list
      await loadLanguages();

      // Load the new translations into i18next
      await setLanguage(selectedLanguage);

      setUploadOpen(false);
      setUploadName('');
      setUploadCode('');
      setUploadTranslations(null);
      setUploadFileName('');

      toast({
        title: t('settingsLanguage.uploaded'),
        description: t('settingsLanguage.uploadedDescription', { name: result.language.name }),
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : t('common.unknownError');
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const filteredLanguages = languages.filter((lang) => {
    if (!normalizedSearch) return true;
    return `${lang.name} ${lang.code}`.toLowerCase().includes(normalizedSearch);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageShell
      title={t('settingsLanguage.title')}
      description={t('settingsLanguage.description')}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder={t('settingsLanguage.searchPlaceholder')}
    >
      {/* Language selector */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">{t('settingsLanguage.currentLanguage')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Globe className="h-8 w-8 text-primary" />
            <div className="flex-1">
              <Select value={selectedLanguage} onValueChange={handleLanguageChange} disabled={savingLanguage}>
                <SelectTrigger className="bg-secondary border-border text-foreground max-w-xs">
                  <SelectValue placeholder={t('settingsLanguage.selectLanguage')} />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.name} ({lang.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {savingLanguage && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          </div>
        </CardContent>
      </Card>

      {/* Language packs list */}
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-foreground">{t('settingsLanguage.languagePacks')}</CardTitle>
              <CardDescription className="text-muted-foreground">{t('settingsLanguage.languagePacksDescription')}</CardDescription>
            </div>
            {isAdmin && (
              <Button onClick={() => setUploadOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                {t('settingsLanguage.uploadButton')}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {filteredLanguages.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('settingsLanguage.noResults')}</p>
          ) : (
            filteredLanguages.map((lang) => (
              <div
                key={lang.code}
                className="flex items-center justify-between rounded-md border border-border bg-secondary px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-foreground">{lang.name}</span>
                  <span className="text-xs text-muted-foreground uppercase">{lang.code}</span>
                  {lang.isDefault && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {t('settingsLanguage.defaultLanguage')}
                    </span>
                  )}
                  {selectedLanguage === lang.code && (
                    <Check className="h-4 w-4 text-green-500" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownload(lang.code)}
                    className="gap-1"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {t('settingsLanguage.download')}
                  </Button>
                  {isAdmin && !lang.isDefault && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(lang.code)}
                      disabled={deletingCode === lang.code}
                      className="gap-1"
                    >
                      {deletingCode === lang.code ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      {t('settingsLanguage.deleteLanguage')}
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settingsLanguage.uploadTitle')}</DialogTitle>
            <DialogDescription>{t('settingsLanguage.uploadDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('settingsLanguage.uploadName')}</Label>
              <Input
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                placeholder={t('settingsLanguage.uploadNamePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('settingsLanguage.uploadCode')}</Label>
              <Input
                value={uploadCode}
                onChange={(e) => setUploadCode(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 5))}
                placeholder={t('settingsLanguage.uploadCodePlaceholder')}
                maxLength={5}
              />
              <p className="text-xs text-muted-foreground">{t('settingsLanguage.uploadCodeHint')}</p>
            </div>
            <div className="space-y-2">
              <Label>{t('settingsLanguage.uploadFile')}</Label>
              <Input
                type="file"
                accept=".json"
                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                className="bg-secondary border-border text-foreground"
              />
              {uploadFileName && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Check className="h-3 w-3 text-green-500" />
                  {uploadFileName}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleUpload} disabled={uploading || !uploadTranslations || !uploadName.trim() || !uploadCode.trim()}>
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {t('settingsLanguage.uploadButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
