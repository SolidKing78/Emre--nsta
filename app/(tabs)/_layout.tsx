import { Tabs } from 'expo-router';
import React from 'react';

import { TabBar } from '@/components/navigation/TabBar';
import { useTheme } from '@/hooks/useTheme';

/** Instagram tab order: Home · Reels · Messages (activity) · Search · Profile */
export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        lazy: true,
      }}
      backBehavior="initialRoute"
      initialRouteName="home"
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="reels" />
      <Tabs.Screen name="activity" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
