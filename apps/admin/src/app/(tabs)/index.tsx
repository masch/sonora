import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { ScrollScreenWrapper } from '@/components/screen-wrapper';
import LoadingView from '@/components/loading-view';
import { TwView, TwText, TwPressable, TwTextInput } from '@/tw';
import { AdminApiClient } from '@/services/admin-api-client';
import { useTranslation } from 'react-i18next';
import { en, es } from '@sonora/shared';
import { useThemeColors } from '@/hooks/use-theme-colors';

type LocaleData = Record<string, string>;

// Helper to flatten a nested object to dot-notation keys
function flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      result[newKey] = value;
    } else if (typeof value === 'object' && value !== null) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, newKey));
    }
  }
  return result;
}

const LOCAL_TRANSLATIONS: Record<string, LocaleData> = {
  en: flattenObject(en),
  es: flattenObject(es),
};

export default function TranslationEditorScreen() {
  const router = useRouter();
  const [activeLang, setActiveLang] = useState<'en' | 'es'>('en');
  const [searchQuery, setSearchQuery] = useState('');
  const { t } = useTranslation();
  const colors = useThemeColors();

  // Remote overrides loaded from database
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  // In-memory edits that are not yet saved
  const [edits, setEdits] = useState<Record<string, string>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Load translations for the active language
  const loadTranslations = useCallback(
    async (lang: 'en' | 'es') => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await AdminApiClient.getTranslations(lang);
        setOverrides(data || {});
        setEdits({});
      } catch (err) {
        setError(err instanceof Error ? err.message : t('dashboard.errorLoading'));
      } finally {
        setIsLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      loadTranslations(activeLang);
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [activeLang, loadTranslations]);

  // Merge local static translations with remote overrides and active unsaved edits
  const tableData = useMemo(() => {
    const staticData = LOCAL_TRANSLATIONS[activeLang];
    return Object.keys(staticData).map((key) => {
      const original = staticData[key];
      const remoteOverride = overrides[key] || '';
      const currentVal = edits[key] !== undefined ? edits[key] : remoteOverride;

      return {
        key,
        original,
        override: remoteOverride,
        value: currentVal,
        isModified: edits[key] !== undefined && edits[key] !== remoteOverride,
        isOverrideActive: !!remoteOverride,
      };
    });
  }, [activeLang, overrides, edits]);

  // Filter based on search query
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return tableData;
    const query = searchQuery.toLowerCase();
    return tableData.filter(
      (item) =>
        item.key.toLowerCase().includes(query) ||
        item.original.toLowerCase().includes(query) ||
        item.value.toLowerCase().includes(query),
    );
  }, [tableData, searchQuery]);

  const handleEdit = (key: string, value: string) => {
    const remoteOverride = overrides[key] || '';
    if (value === remoteOverride) {
      const newEdits = { ...edits };
      delete newEdits[key];
      setEdits(newEdits);
    } else {
      setEdits({
        ...edits,
        [key]: value,
      });
    }
  };

  const handleSave = async () => {
    const changedKeys = Object.keys(edits);
    if (changedKeys.length === 0) return;

    setIsSaving(true);
    setError(null);
    setSaveStatus(t('dashboard.savingStatus'));

    // Construct payload of all final overrides
    // Send updated values, and include cleared overrides (value: "") to instruct the API to delete them
    const keysToSave = new Set([...Object.keys(overrides), ...Object.keys(edits)]);
    const payload = Array.from(keysToSave)
      .map((key) => {
        const remoteOverride = overrides[key] || '';
        const currentVal = edits[key] !== undefined ? edits[key] : remoteOverride;
        return {
          lang: activeLang,
          key,
          value: currentVal.trim(),
        };
      })
      .filter((entry) => entry.value !== '' || overrides[entry.key] !== undefined);

    if (payload.length === 0) {
      setEdits({});
      setSaveStatus(t('dashboard.savedSuccess'));
      setTimeout(() => setSaveStatus(null), 3000);
      return;
    }

    try {
      await AdminApiClient.setTranslations(payload);
      setSaveStatus(t('dashboard.savedSuccess'));
      // Reload translations from DB to refresh overrides state
      await loadTranslations(activeLang);
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dashboard.saveBtn'));
      setSaveStatus(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    AdminApiClient.clearAuthKey();
    router.replace('/login');
  };

  const unsavedCount = Object.keys(edits).length;

  return (
    <ScrollScreenWrapper>
      {/* Header bar */}
      <TwView className="w-full h-16 bg-backgroundElement border-b border-backgroundSelected flex-row items-center justify-between px-five">
        <TwView className="flex-row items-center">
          <TwText className="text-xl font-bold text-text">{t('dashboard.title')}</TwText>
          <TwView className="ml-three bg-backgroundSelected px-two py-[2px] rounded-md">
            <TwText className="text-xs font-semibold text-textSecondary">
              {t('dashboard.tag')}
            </TwText>
          </TwView>
        </TwView>
        <TwPressable
          className="bg-transparent border border-textSecondary px-three py-two rounded-lg hover:bg-backgroundSelected"
          onPress={handleLogout}
          accessibilityLabel={t('dashboard.logout')}
          testID="logout-button"
        >
          <TwText className="text-sm font-semibold text-textSecondary">
            {t('dashboard.logout')}
          </TwText>
        </TwPressable>
      </TwView>

      {/* Main workspace */}
      <TwView className="flex-1 p-five max-w-[1200px] w-full mx-auto">
        <TwView className="flex-row items-center justify-between mb-four flex-wrap gap-three">
          {/* Language Selector Tabs */}
          <TwView className="flex-row bg-backgroundElement p-[3px] rounded-lg border border-backgroundSelected">
            <TwPressable
              className={`px-four py-two rounded-md ${activeLang === 'en' ? 'bg-background shadow-sm' : ''}`}
              onPress={() => setActiveLang('en')}
              accessibilityLabel={t('dashboard.tabEn')}
              testID="lang-en-tab"
            >
              <TwText
                className={`text-sm font-bold ${activeLang === 'en' ? 'text-text' : 'text-textSecondary'}`}
              >
                {t('dashboard.tabEn')}
              </TwText>
            </TwPressable>
            <TwPressable
              className={`px-four py-two rounded-md ${activeLang === 'es' ? 'bg-background shadow-sm' : ''}`}
              onPress={() => setActiveLang('es')}
              accessibilityLabel={t('dashboard.tabEs')}
              testID="lang-es-tab"
            >
              <TwText
                className={`text-sm font-bold ${activeLang === 'es' ? 'text-text' : 'text-textSecondary'}`}
              >
                {t('dashboard.tabEs')}
              </TwText>
            </TwPressable>
          </TwView>

          {/* Search Input */}
          <TwTextInput
            className="w-full max-w-[300px] h-10 border border-backgroundSelected rounded-lg px-three text-text bg-background focus:border-link"
            placeholder={t('dashboard.searchPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            accessibilityLabel={t('dashboard.searchPlaceholder')}
            testID="search-input"
          />
        </TwView>

        {/* Feedback Messages */}
        {error && (
          <TwView className="bg-red-100 border border-red-200 rounded-lg p-three mb-four">
            <TwText className="text-sm text-red-700 font-medium">{error}</TwText>
          </TwView>
        )}

        {saveStatus && (
          <TwView className="bg-blue-100 border border-blue-200 rounded-lg p-three mb-four flex-row items-center justify-between">
            <TwText className="text-sm text-blue-700 font-medium">{saveStatus}</TwText>
          </TwView>
        )}

        {/* Translations Table Area */}
        <TwView className="flex-1 card-container rounded-xl overflow-hidden shadow-sm">
          {isLoading ? (
            <LoadingView message={t('dashboard.loading')} />
          ) : filteredData.length === 0 ? (
            <TwView className="flex-1 items-center justify-center py-six bg-background">
              <TwText className="text-base text-textSecondary font-medium">
                {t('dashboard.noResults')}
              </TwText>
            </TwView>
          ) : (
            <TwView className="flex-1 bg-background">
              {filteredData.map((item) => (
                <TwView
                  key={item.key}
                  className="p-four border-b border-[#dfd7c8] flex-col md:flex-row md:items-center justify-between gap-three hover:bg-backgroundElement/30"
                >
                  {/* Left Column: Key info */}
                  <TwView className="flex-1 max-w-[400px]">
                    <TwView className="flex-row items-center flex-wrap gap-two mb-one">
                      <TwText className="font-mono text-xs text-link font-semibold bg-backgroundElement px-[6px] py-[2px] rounded border border-[#dfd7c8]">
                        {item.key}
                      </TwText>
                      {item.isModified && (
                        <TwView className="bg-amber-100 border border-amber-200 px-[6px] py-[2px] rounded">
                          <TwText className="text-[10px] text-amber-700 font-bold">
                            {t('dashboard.unsavedEdits')}
                          </TwText>
                        </TwView>
                      )}
                      {item.isOverrideActive && !item.isModified && (
                        <TwView className="bg-green-100 border border-green-200 px-[6px] py-[2px] rounded">
                          <TwText className="text-[10px] text-green-700 font-bold">
                            {t('dashboard.overrideActive')}
                          </TwText>
                        </TwView>
                      )}
                    </TwView>
                    <TwText className="text-xs text-textSecondary mt-[2px]">
                      {t('dashboard.originalLabel')}
                      <TwText className="italic">{item.original}</TwText>
                    </TwText>
                  </TwView>

                  {/* Right Column: Editable field */}
                  <TwView className="flex-1 flex-row items-center gap-two min-w-[300px]">
                    <TwTextInput
                      className={`flex-1 h-10 border rounded-lg px-three text-text bg-background ${item.isModified ? 'border-amber-400 focus:border-amber-500' : 'border-[#dfd7c8] focus:border-link'}`}
                      value={item.value}
                      onChangeText={(val) => handleEdit(item.key, val)}
                      placeholder={item.original}
                      placeholderTextColor={colors.textSecondary}
                      accessibilityLabel={t('dashboard.translationFor', { key: item.key })}
                      testID={`input-${item.key.replace(/\./g, '-')}`}
                    />
                    {item.value !== '' && (
                      <TwPressable
                        className="h-10 w-10 items-center justify-center rounded-lg border border-[#dfd7c8] bg-background hover:bg-red-50"
                        onPress={() => handleEdit(item.key, '')}
                        accessibilityLabel={t('dashboard.clearOverrideAccess', { key: item.key })}
                        testID={`clear-${item.key.replace(/\./g, '-')}`}
                      >
                        <TwText className="text-xs text-red-500 font-bold">
                          {t('dashboard.clearBtn')}
                        </TwText>
                      </TwPressable>
                    )}
                  </TwView>
                </TwView>
              ))}
            </TwView>
          )}
        </TwView>

        {/* Sticky footer action bar */}
        {unsavedCount > 0 && (
          <TwView className="w-full mt-four bg-backgroundElement border border-backgroundSelected rounded-xl p-four flex-row items-center justify-between shadow-sm">
            <TwText className="text-sm font-bold text-text">
              {unsavedCount} {t('dashboard.modifiedStatus')}
            </TwText>
            <TwPressable
              className={`px-five py-two rounded-lg bg-link items-center justify-center ${isSaving ? 'opacity-80' : ''}`}
              onPress={handleSave}
              disabled={isSaving}
              accessibilityLabel={t('dashboard.saveBtnLabel')}
              testID="save-changes-button"
            >
              <TwText className="text-sm font-bold text-white">
                {isSaving ? t('dashboard.savingBtn') : t('dashboard.saveBtn')}
              </TwText>
            </TwPressable>
          </TwView>
        )}
      </TwView>
    </ScrollScreenWrapper>
  );
}
