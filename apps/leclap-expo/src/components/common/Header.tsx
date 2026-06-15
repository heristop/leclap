import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, StatusBar, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, typography, spacing } from '@/src/styles/theme';
import logoImage from '@/assets/images/logo.png';

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

type ContainerStyle = {
  backgroundColor: string;
  borderBottomWidth: number;
  borderBottomColor?: string;
};

function getContainerStyles(variant: HeaderProps['variant']): ContainerStyle {
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
    default:
      return {
        backgroundColor: colors.primary,
        borderBottomWidth: 0,
      };
  }
}

function getTextColor(variant: HeaderProps['variant']): string {
  if (variant === 'light') {
    return colors.text;
  }

  if (variant === 'transparent') {
    return colors.surface;
  }

  return colors.accent;
}

function getSubtitleColor(variant: HeaderProps['variant']): string {
  return variant === 'light' ? colors.textSecondary : colors.surface;
}

function getStatusBarStyle(variant: HeaderProps['variant']): 'dark-content' | 'light-content' {
  return variant === 'light' ? 'dark-content' : 'light-content';
}

function getSafeAreaBackground(variant: HeaderProps['variant'], containerBackground: string): string {
  return variant === 'transparent' ? 'transparent' : containerBackground;
}

type ActionItem = {
  icon: string;
  onPress: () => void;
  color?: string;
};

function useLogoAnimation(): Animated.Value {
  const logoScaleAnim = useRef(new Animated.Value(1)).current;

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
      }),
    ]);

    Animated.loop(pulseAnimation, { iterations: 3 }).start();

    return () => {
      logoScaleAnim.stopAnimation();
    };
  }, [logoScaleAnim]);

  return logoScaleAnim;
}

function ActionButtons({
  actions,
  title,
  onNavigateToBrowseTemplates,
  textColor,
}: {
  actions: ActionItem[];
  title: string;
  onNavigateToBrowseTemplates: () => void;
  textColor: string;
}): React.ReactElement {
  const getActionHandler = (action: ActionItem): (() => void) => {
    if (action.icon === 'add-circle' && title === 'My Videos') {
      return onNavigateToBrowseTemplates;
    }

    if (action.icon === 'options-outline') {
      return () => {
        /* no-op: options not yet implemented */
      };
    }

    return action.onPress;
  };

  return (
    <>
      {actions.map((action, index) => (
        <TouchableOpacity key={`action-${index}`} style={styles.actionButton} onPress={getActionHandler(action)}>
          <Ionicons name={action.icon as keyof typeof Ionicons.glyphMap} size={24} color={action.color ?? textColor} />
        </TouchableOpacity>
      ))}
    </>
  );
}

export default function Header({
  title,
  showBackButton = false,
  showLogo = true,
  rightContent,
  onBackPress,
  showSlogan = true,
  variant = 'primary',
  actions = [],
}: HeaderProps) {
  const router = useRouter();
  const { t } = useTranslation('header');
  useLogoAnimation();

  const resolvedTitle = title ?? t('defaultTitle');

  const handleBackPress = (): void => {
    if (!onBackPress) {
      return;
    }

    onBackPress();
  };

  const handleNavigateToBrowseTemplates = (): void => {
    router.navigate('/(app)');
  };

  const containerStyles = getContainerStyles(variant);
  const textColor = getTextColor(variant);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: getSafeAreaBackground(variant, containerStyles.backgroundColor) }]}
    >
      <StatusBar barStyle={getStatusBarStyle(variant)} backgroundColor="transparent" translucent />
      <View style={[styles.container, containerStyles]}>
        <View style={styles.leftSection}>
          {showBackButton && (
            <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
              <Ionicons name="chevron-back" size={28} color={textColor} />
            </TouchableOpacity>
          )}

          {showLogo && (
            <View style={styles.logoContainer}>
              <Image source={logoImage} style={styles.logo} resizeMode="contain" />
            </View>
          )}

          <View style={styles.titleContainer}>
            <Text style={[styles.title, { color: textColor }]}>{resolvedTitle}</Text>
            {showSlogan && <Text style={[styles.subtitle, { color: getSubtitleColor(variant) }]}>{t('slogan')}</Text>}
          </View>
        </View>

        <View style={styles.rightSection}>
          <ActionButtons
            actions={actions}
            title={resolvedTitle}
            onNavigateToBrowseTemplates={handleNavigateToBrowseTemplates}
            textColor={textColor}
          />
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
  // The logo is a self-contained gradient disc — show it directly, no boxed backing/ring.
  logoContainer: {
    marginRight: spacing.s,
    width: 40,
    height: 40,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  logo: {
    width: 40,
    height: 40,
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
