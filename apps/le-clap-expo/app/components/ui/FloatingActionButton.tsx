import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { colors } from '@/src/styles/theme';

const { width: _width } = Dimensions.get('window');

interface FloatingActionButtonProps {
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  showMenu?: boolean;
  menuItems?: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
  }[];
}

export default function FloatingActionButton({
  onPress,
  icon = 'add',
  showMenu = false,
  menuItems = [],
}: FloatingActionButtonProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const menuItemAnims = useRef(
    menuItems.map(() => ({
      scale: new Animated.Value(0),
      opacity: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    // Initial entrance animation
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 40,
      useNativeDriver: true,
    }).start();

    // Continuous pulse animation
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    pulseAnimation.start();

    return () => {
      pulseAnimation.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scaleAnim and pulseAnim are stable ref values
  }, []);

  const toggleMenu = () => {
    const toValue = isMenuOpen ? 0 : 1;

    // Rotate the plus icon
    Animated.timing(rotateAnim, {
      toValue,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // Animate menu items
    if (showMenu && menuItems.length > 0) {
      const animations = menuItemAnims.map((anim, index) =>
        Animated.parallel([
          Animated.spring(anim.scale, {
            toValue,
            friction: 5,
            tension: 40,
            delay: index * 50,
            useNativeDriver: true,
          }),
          Animated.timing(anim.opacity, {
            toValue,
            duration: 200,
            delay: index * 50,
            useNativeDriver: true,
          }),
        ])
      );

      Animated.stagger(50, animations).start();
      setIsMenuOpen(!isMenuOpen);
    }
  };

  const handlePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Quick press animation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    if (showMenu) {
      toggleMenu();
    } else {
      onPress();
    }
  };

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  return (
    <View style={styles.container}>
      {/* Menu items */}
      {showMenu && menuItems.map((item, index) => {
        const translateY = menuItemAnims[index].scale.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -(75 * (index + 1))],
        });

        return (
          <Animated.View
            key={index}
            style={[
              styles.menuItem,
              {
                opacity: menuItemAnims[index].opacity,
                transform: [
                  { scale: menuItemAnims[index].scale },
                  { translateY },
                ],
              },
            ]}
          >
            <TouchableOpacity
              style={styles.menuItemButton}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                item.onPress();
                toggleMenu();
              }}
            >
              <Ionicons name={item.icon} size={24} color={colors.primary} />
            </TouchableOpacity>
          </Animated.View>
        );
      })}

      {/* Main FAB */}
      <Animated.View
        style={[
          styles.fabContainer,
          {
            transform: [
              { scale: Animated.multiply(scaleAnim, pulseAnim) },
              { rotate: showMenu ? rotateInterpolate : '0deg' },
            ],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.touchable}
          onPress={handlePress}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          >
            <View style={styles.innerCircle}>
              <Ionicons name={icon} size={28} color="white" />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* Ripple effect */}
      {!isMenuOpen && (
        <Animated.View
          style={[
            styles.ripple,
            {
              transform: [{ scale: pulseAnim }],
              opacity: pulseAnim.interpolate({
                inputRange: [1, 1.1],
                outputRange: [0.3, 0],
              }),
            },
          ]}
          pointerEvents="none"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    alignItems: 'center',
    zIndex: 1000,
  },
  fabContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    elevation: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  touchable: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ripple: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    zIndex: -1,
  },
  menuItem: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: colors.divider,
  },
});