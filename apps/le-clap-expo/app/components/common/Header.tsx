import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
  Animated,
  Easing
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from 'expo-router';
import { colors, typography, spacing } from '@/src/styles/theme';

interface HeaderProps {
  title?: string;
  showBackButton?: boolean;
  showLogo?: boolean;
  rightContent?: React.ReactNode;
  onBackPress?: () => void;
  showSlogan?: boolean;
  variant?: 'primary' | 'transparent' | 'light';
  actions?: {
    icon: string;
    onPress: () => void;
    color?: string;
  }[];
}

export default function Header({ 
  title = 'LeClap', 
  showBackButton = false, 
  showLogo = true,
  rightContent,
  onBackPress,
  showSlogan = true,
  variant = 'primary',
  actions = [],
}: HeaderProps) {
  const navigation = useNavigation();
  const logoScaleAnim = useRef(new Animated.Value(1)).current;
  
  // Get proper navigation actions
  const getActionHandler = (action: {icon: string; onPress: () => void}) => {
    // Special case for common actions
    if (action.icon === 'add-circle' && title === 'My Videos') {
      return () => navigation.navigate('BrowseTemplates');
    }
    if (action.icon === 'options-outline') {
      return () => console.log('Options pressed');
    }
    
    // Default to the provided handler
    return action.onPress;
  };

  // Logo pulse animation for first render
  useEffect(() => {
    const pulseAnimation = Animated.sequence([
      Animated.timing(logoScaleAnim, {
        toValue: 1.1,
        duration: 700,
        useNativeDriver: true,
        easing: Easing.ease,
      }),
      Animated.timing(logoScaleAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
        easing: Easing.ease,
      })
    ]);

    // Create a loop
    Animated.loop(
      pulseAnimation, 
      { iterations: 3 }
    ).start();

    return () => {
      logoScaleAnim.stopAnimation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- logoScaleAnim is a stable ref value
  }, []);

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
        } else {
      return () => {}; // Replace with empty function
    }
  };

  const getContainerStyles = () => {
    switch (variant) {
      case 'transparent':
        return {
          backgroundColor: 'transparent',
          borderBottomWidth: 0,
        };
      case 'light':
        return {
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.divider,
        };
      case 'primary':
      default:
        return {
          backgroundColor: colors.primary,
          borderBottomWidth: 0,
        };
    }
  };

  const getTextColor = () => {
    return variant === 'light' ? colors.text : variant === 'transparent' ? colors.surface : colors.accent;
  };

  const getSubtitleColor = () => {
    return variant === 'light' ? colors.textSecondary : colors.surface;
  };

  const getStatusBarStyle = () => {
    return variant === 'light' ? 'dark-content' : 'light-content';
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: variant === 'transparent' ? 'transparent' : getContainerStyles().backgroundColor }]}>
      <StatusBar 
        barStyle={getStatusBarStyle()} 
        backgroundColor="transparent" 
        translucent={true} 
      />
      <View style={[styles.container, getContainerStyles()]}>
        <View style={styles.leftSection}>
          {showBackButton && (
            <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
              <Ionicons name="chevron-back" size={28} color={getTextColor()} />
            </TouchableOpacity>
          )}
          
          {showLogo && (
            <View style={[styles.logoContainer, { borderColor: variant === 'light' ? colors.primary : colors.accent }]}>
              <Image 
                source={require('@/assets/images/logo.png')} 
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
          )}
          
          <View style={styles.titleContainer}>
            <Text style={[styles.title, { color: getTextColor() }]}>{title}</Text>
            {showSlogan && (
              <Text style={[styles.subtitle, { color: getSubtitleColor() }]}>Your story. Your scenes. Your clap.</Text>
            )}
          </View>
        </View>
        
        <View style={styles.rightSection}>
          {actions.map((action, index) => (
            <TouchableOpacity 
              key={`action-${index}`} 
              style={styles.actionButton}
              onPress={getActionHandler(action)}
            >
              <Ionicons
                name={action.icon as keyof typeof Ionicons.glyphMap}
                size={24}
                color={action.color || getTextColor()}
              />
            </TouchableOpacity>
          ))}
          {rightContent}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.primary,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 3,
  },
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    minHeight: 70,
    zIndex: 10,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginRight: spacing.s,
    padding: spacing.xs,
  },
  logoContainer: {
    marginRight: spacing.s,
    backgroundColor: colors.surface,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  logo: {
    width: 30,
    height: 30,
  },
  titleContainer: {
    justifyContent: 'center',
    flex: 1,
  },
  title: {
    ...typography.title,
    fontSize: 22,
  },
  subtitle: {
    ...typography.smallText,
    marginTop: 2,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: spacing.s,
    marginLeft: spacing.xs,
  },
});
