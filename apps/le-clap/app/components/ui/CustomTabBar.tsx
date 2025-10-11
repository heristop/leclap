import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/app/styles/theme';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';

export default function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.tabBar}>
        {state.routes.slice(0, 2).map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.title !== undefined ? options.title : route.name;
          const isFocused = state.index === index;
          
          let iconName: keyof typeof Ionicons.glyphMap | undefined;
          if (route.name === 'index') {
            iconName = isFocused ? 'film' : 'film-outline';
          } else if (route.name === 'videos/index') {
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
    height: 80,
    paddingBottom: 12,
    paddingTop: 12,
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
    padding: 8,
    borderRadius: 12,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inactiveIconContainer: {
    padding: 8,
    borderRadius: 12,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
