import { Tabs, TabList, TabTrigger, TabSlot } from 'expo-router/ui';
import { useTranslation } from 'react-i18next';

import { TabButton } from './app-tabs/tab-button';
import { CustomTabList } from './app-tabs/custom-tab-list';
import { TABS } from '@/constants/tabs';

export default function AppTabs() {
  const { t } = useTranslation();
  const visible = TABS.filter((tab) => !tab.hidden);
  const triggers = visible.map((tab) => (
    <TabTrigger
      key={tab.name}
      name={tab.name}
      href={tab.name === 'index' ? '/' : `/${tab.name}`}
      asChild
    >
      <TabButton icon={tab.symbolViewName} label={t(tab.labelKey)} />
    </TabTrigger>
  ));

  return (
    <Tabs>
      {/* TabSlot is a third-party component (expo-router/ui) that doesn't support className for height */}
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>{triggers}</CustomTabList>
      </TabList>
    </Tabs>
  );
}
