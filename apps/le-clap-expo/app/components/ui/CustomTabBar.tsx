import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { Tabs } from 'expo-router';
import { colors } from '@/src/styles/theme';

// SDK 56: expo-router no longer ships react-navigation as a direct dependency.
// Derive the tab bar props from expo-router's own Tabs component instead of
// importing from '@react-navigation/bottom-tabs'.
type BottomTabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

export default function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.tabBar}>
        {state.routes.slice(0, 2).map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.title ?? route.name;
          const isFocused = state.index === index;
          
          let iconName: keyof typeof Ionicons.glyphMap | undefined;

          if (route.name === 'index') {
            iconName = isFocused ? 'film' : 'film-outline';
          }

          if (route.name === 'videos/index') {
            iconName = isFocused ? 'videocam' : 'videocam-outline';
          }
          
          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };
          
          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={styles.tabItem}
              activeOpacity={0.7}
            >
              <View style={isFocused ? styles.activeIconContainer : styles.inactiveIconContainer}>
                <Ionicons 
                  name={iconName as keyof typeof Ionicons.glyphMap}
                  size={24} 
                  color={isFocused ? colors.primary : '#888888'} 
                />
              </View>
              <Text style={[
                styles.tabLabel,
                { color: isFocused ? colors.primary : '#888888' }
              ]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  tabBar: {
    flexDirection: 'row',
    height: 60,
    paddingBottom: 6,
    paddingTop: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  activeIconContainer: {
    backgroundColor: `${colors.primary}15`,
    padding: 6,
    borderRadius: 10,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inactiveIconContainer: {
    padding: 6,
    borderRadius: 10,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
