import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { type Tabs } from 'expo-router';
import { colors, spacing, typography, withAlpha } from '@/src/styles/theme';

type BottomTabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

export default function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.container}>
      <View style={styles.tabBar}>
        {state.routes.map((route, index) => {
          const label = descriptors[route.key].options.title ?? route.name;
          const selected = state.index === index;
          const icons: Record<string, readonly [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
            index: ['film-outline', 'film'],
            'videos/index': ['videocam-outline', 'videocam'],
          };
          const icon = (icons[route.name] ?? icons.index)[selected ? 1 : 0];

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected }}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });

                if (!selected && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              style={({ pressed }) => [styles.tabItem, pressed && styles.pressed]}
            >
              <View style={[styles.iconWrap, selected && styles.selected]}>
                <Ionicons name={icon} size={24} color={selected ? colors.primaryDark : colors.textSecondary} />
              </View>
              <Text style={[styles.label, selected && styles.selectedText]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  tabBar: { flexDirection: 'row', paddingVertical: spacing.s, minHeight: 68 },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    gap: spacing.xs,
    paddingHorizontal: spacing.s,
  },
  label: { ...typography.smallText, color: colors.textSecondary, fontWeight: '600', textAlign: 'center' },
  selectedText: { color: colors.primaryDark },
  iconWrap: { paddingHorizontal: spacing.l, paddingVertical: spacing.xs, borderRadius: 12 },
  selected: { backgroundColor: withAlpha(colors.primary, 0.12) },
  pressed: { opacity: 0.65 },
});
