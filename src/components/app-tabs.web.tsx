import { Tabs, TabList, TabTrigger, TabSlot } from 'expo-router/ui';

import { TabButton } from './app-tabs/tab-button';
import { CustomTabList } from './app-tabs/custom-tab-list';
import { TABS } from '@/constants/tabs';

export default function AppTabs() {
  return (
    <Tabs>
      {/* TabSlot is a third-party component (expo-router/ui) that doesn't support className for height */}
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          {TABS.map((tab) => (
            <TabTrigger
              key={tab.name}
              name={tab.name}
              href={tab.name === 'index' ? '/' : `/${tab.name}`}
              asChild
            >
              <TabButton icon={tab.symbolViewName} />
            </TabTrigger>
          ))}
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}
