import { color_pallet } from '@/styles/colors';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import type { ComponentProps } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LiquidGlassTabBar } from './LiquidGlassTabBar';

type IoniconName = ComponentProps<typeof Ionicons>['name'];
type SFSymbolSource = ComponentProps<typeof Icon>['sf'];

type RoleTab = {
  name: string;
  title: string;
  androidIcon: IoniconName;
  sfSymbol: SFSymbolSource;
};

const OWNER_TABS: RoleTab[] = [
  {
    name: 'overview',
    title: 'Overview',
    androidIcon: 'stats-chart',
    sfSymbol: { default: 'chart.bar', selected: 'chart.bar.fill' },
  },
  {
    name: 'analytics',
    title: 'Reports',
    androidIcon: 'bar-chart',
    sfSymbol: { default: 'chart.xyaxis.line', selected: 'chart.xyaxis.line' },
  },
  {
    name: 'portfolio',
    title: 'Portfolio',
    androidIcon: 'business',
    sfSymbol: { default: 'building.2', selected: 'building.2.fill' },
  },
  {
    name: 'menu',
    title: 'Menu',
    androidIcon: 'restaurant',
    sfSymbol: 'fork.knife',
  },
  {
    name: 'feedback',
    title: 'Complaints',
    androidIcon: 'alert-circle',
    sfSymbol: { default: 'exclamationmark.bubble', selected: 'exclamationmark.bubble.fill' },
  },
  {
    name: 'schedule',
    title: 'Schedule',
    androidIcon: 'calendar',
    sfSymbol: 'calendar',
  },
  {
    name: 'messages',
    title: 'Messages',
    androidIcon: 'chatbubbles',
    sfSymbol: { default: 'message', selected: 'message.fill' },
  },
  {
    name: 'settings',
    title: 'Settings',
    androidIcon: 'settings',
    sfSymbol: { default: 'gearshape', selected: 'gearshape.fill' },
  },
];

const EMPLOYEE_TABS: RoleTab[] = [
  {
    name: 'home',
    title: 'Home',
    androidIcon: 'home',
    sfSymbol: { default: 'house', selected: 'house.fill' },
  },
  {
    name: 'schedule',
    title: 'Schedule',
    androidIcon: 'calendar',
    sfSymbol: 'calendar',
  },
  {
    name: 'messages',
    title: 'Messages',
    androidIcon: 'chatbubbles',
    sfSymbol: { default: 'message', selected: 'message.fill' },
  },
  {
    name: 'more',
    title: 'More',
    androidIcon: 'ellipsis-horizontal-circle',
    sfSymbol: { default: 'ellipsis.circle', selected: 'ellipsis.circle.fill' },
  },
];

const RESELLER_TABS: RoleTab[] = [
  {
    name: 'overview',
    title: 'Overview',
    androidIcon: 'stats-chart',
    sfSymbol: { default: 'chart.bar', selected: 'chart.bar.fill' },
  },
  {
    name: 'portfolio',
    title: 'Stores',
    androidIcon: 'business',
    sfSymbol: { default: 'building.2', selected: 'building.2.fill' },
  },
  {
    name: 'menu',
    title: 'Menu',
    androidIcon: 'restaurant',
    sfSymbol: 'fork.knife',
  },
  {
    name: 'ui',
    title: 'UI',
    androidIcon: 'color-palette',
    sfSymbol: { default: 'paintpalette', selected: 'paintpalette.fill' },
  },
];

type RoleTabsLayoutProps = {
  variant: 'owner' | 'employee' | 'reseller';
};

const HIDDEN_TABS_BY_VARIANT: Record<RoleTabsLayoutProps['variant'], string[]> = {
  owner: ['scans'],
  employee: ['analytics', 'menu', 'scans'],
  reseller: ['reports'],
};

export function RoleTabsLayout({ variant }: RoleTabsLayoutProps) {
  const tabs = variant === 'owner' ? OWNER_TABS : variant === 'reseller' ? RESELLER_TABS : EMPLOYEE_TABS;
  const hiddenTabs = HIDDEN_TABS_BY_VARIANT[variant];
  const safeAreaEdges = Platform.OS === 'ios' ? (['top', 'bottom'] as const) : (['top'] as const);

  return (
    <SafeAreaView
      edges={safeAreaEdges}
      style={[styles.safeArea, Platform.OS === 'ios' && styles.iosNativeTabsLift]}
    >
      <View style={styles.content}>
        {Platform.OS === 'ios' ? (
          <IOSNativeTabs tabs={tabs} hiddenTabs={hiddenTabs} />
        ) : (
          <BottomTabs tabs={tabs} hiddenTabs={hiddenTabs} />
        )}
      </View>
    </SafeAreaView>
  );
}

function IOSNativeTabs({ tabs, hiddenTabs }: { tabs: RoleTab[]; hiddenTabs: string[] }) {
  return (
    <NativeTabs
      backgroundColor={null}
      blurEffect="systemUltraThinMaterialLight"
      disableTransparentOnScrollEdge={false}
      iconColor={{
        default: color_pallet.ink[500],
        selected: color_pallet.elevated.dark,
      }}
      labelStyle={{
        default: nativeLabelStyle,
        selected: {
          ...nativeLabelStyle,
          color: color_pallet.elevated.dark,
          fontWeight: '700',
        },
      }}
      minimizeBehavior="never"
      shadowColor="rgba(24,20,18,0.16)"
      tintColor={color_pallet.elevated.dark}
    >
      {tabs.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <Label>{tab.title}</Label>
          <Icon sf={tab.sfSymbol} />
        </NativeTabs.Trigger>
      ))}
      {hiddenTabs.map((name) => (
        <NativeTabs.Trigger key={name} name={name} hidden />
      ))}
    </NativeTabs>
  );
}

function BottomTabs({ tabs, hiddenTabs }: { tabs: RoleTab[]; hiddenTabs: string[] }) {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          backgroundColor: color_pallet.bg.DEFAULT,
        },
        tabBarStyle: {
          backgroundColor: color_pallet.bg.DEFAULT,
          paddingVertical: 5,
          paddingBottom: 0,
        },
      }}
      tabBar={(props) => (
        <LiquidGlassTabBar
          {...props}
          bottomOffset={Platform.OS === 'ios' ? 22 : 0}
          visibleRouteNames={tabs.map((tab) => tab.name)}
        />
      )}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name={tab.androidIcon} size={size} color={color} />
            ),
          }}
        />
      ))}
      {hiddenTabs.map((name) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            href: null,
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: color_pallet.bg.DEFAULT,
    justifyContent: 'flex-start',
  },
  iosNativeTabsLift: {
    paddingBottom: 18,
  },
  content: {
    flex: 1,
  },
});

const nativeLabelStyle = {
  color: color_pallet.ink[500],
  fontSize: 11,
  fontWeight: '600' as const,
};
