import React, { useState, useEffect } from 'react';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { XStack, YStack, Text, Card } from 'tamagui';
import { useOffline } from '@/src/providers/OfflineProvider';
import { useTemplatesSyncStatus } from '@/src/hooks/useTemplates';
import * as Haptics from 'expo-haptics';

interface NetworkStatusIndicatorProps {
  showWhenOnline?: boolean;
  compact?: boolean;
  expandable?: boolean;
  showSyncStatus?: boolean;
}

function NetworkStatusIndicator({
  showWhenOnline = false,
  compact = false,
  expandable = true,
  showSyncStatus = true
}: NetworkStatusIndicatorProps) {
  const { isOnline, isOffline, networkType, hasInternet } = useOffline();
  const { data: syncStatus } = useTemplatesSyncStatus();
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastStatusChange, setLastStatusChange] = useState<Date | null>(null);

  // Track status changes for auto-expand
  useEffect(() => {
    setLastStatusChange(new Date());
    if (!isOnline) {
      // Auto-expand when going offline
      setIsExpanded(true);
    }
  }, [isOnline]);

  // Auto-collapse after 5 seconds when online
  useEffect(() => {
    if (isOnline && isExpanded && !showWhenOnline) {
      const timer = setTimeout(() => {
        setIsExpanded(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, isExpanded, showWhenOnline]);

  // Don't show when online unless explicitly requested
  if (isOnline && !showWhenOnline) {
    return null;
  }

  const handleToggleExpand = async () => {
    if (!expandable) return;

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExpanded(!isExpanded);
  };

  const getConnectionIcon = () => {
    if (isOffline) return 'wifi-outline';
    if (networkType === 'wifi') return 'wifi';
    if (networkType === 'cellular') return 'cellular';
    return 'globe-outline';
  };

  const getConnectionColor = () => {
    if (isOffline) return '$error';
    if (hasInternet) return '$success';
    return '$warning';
  };

  const getStatusText = () => {
    if (isOffline) return 'Offline';
    if (!hasInternet) return 'No Internet';
    return 'Online';
  };

  if (compact) {
    return (
      <XStack padding="$xs">
        <Ionicons
          name={getConnectionIcon()}
          size={16}
          color={getConnectionColor()}
        />
      </XStack>
    );
  }

  return (
    <TouchableOpacity
      onPress={handleToggleExpand}
      disabled={!expandable}
      activeOpacity={0.8}
    >
      <Card
        margin="$s"
        overflow="hidden"
        backgroundColor="$backgroundStrong"
        borderColor="$borderColor"
        borderRadius="$3"
      >
        <XStack alignItems="center" justifyContent="space-between" space="$m">
          <XStack alignItems="center" space="$s" flex={1}>
            <XStack alignItems="center" space="$xs">
              <Ionicons
                name={getConnectionIcon()}
                size={20}
                color={getConnectionColor()}
              />

              {/* Connection quality bars for mobile networks */}
              {networkType === 'cellular' && hasInternet && (
                <XStack alignItems="flex-end" space={1}>
                  {[1, 2, 3, 4].map((bar) => (
                    <YStack
                      key={bar}
                      width={3}
                      height={bar * 3 + 6}
                      backgroundColor={bar <= 3 ? '$success' : '$color9'}
                      borderRadius={1}
                    />
                  ))}
                </XStack>
              )}
            </XStack>

            <YStack flex={1}>
              <Text
                fontSize="$4"
                fontWeight="600"
                color="$color"
              >
                {getStatusText()}
              </Text>
              {networkType && isOnline && (
                <Text
                  fontSize="$2"
                  color="$colorTransparent"
                  opacity={0.7}
                >
                  {networkType.toUpperCase()}
                </Text>
              )}
            </YStack>
          </XStack>

          {expandable && (
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color="$colorTransparent"
            />
          )}
        </XStack>

        {isExpanded && showSyncStatus && syncStatus && (
          <YStack marginTop="$s" space="$xs">
            <XStack justifyContent="space-between" alignItems="center">
              <Text
                fontSize="$2"
                color="$colorTransparent"
                opacity={0.7}
              >
                Cache:
              </Text>
              <Text
                fontSize="$2"
                color="$color"
                fontWeight="500"
              >
                {syncStatus.hasCache ? '✅' : '❌'} {syncStatus.hasCache ? 'Available' : 'Empty'}
              </Text>
            </XStack>

            <XStack justifyContent="space-between" alignItems="center">
              <Text
                fontSize="$2"
                color="$colorTransparent"
                opacity={0.7}
              >
                Status:
              </Text>
              <Text
                fontSize="$2"
                color="$color"
                fontWeight="500"
              >
                {syncStatus.isCacheStale ? '⚠️ Stale' : '✅ Fresh'}
              </Text>
            </XStack>

            {syncStatus.needsSync && (
              <XStack justifyContent="space-between" alignItems="center">
                <Text
                  fontSize="$2"
                  color="$colorTransparent"
                  opacity={0.7}
                >
                  Sync:
                </Text>
                <Text
                  fontSize="$2"
                  color="$warning"
                  fontWeight="500"
                >
                  📡 Pending
                </Text>
              </XStack>
            )}
          </YStack>
        )}
      </Card>
    </TouchableOpacity>
  );
}

export default NetworkStatusIndicator;
export { NetworkStatusIndicator };