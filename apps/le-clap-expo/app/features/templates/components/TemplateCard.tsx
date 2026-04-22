import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Card, Text, Image, YStack, XStack } from 'tamagui';
import type { Template } from '@/src/types';

interface TemplateCardProps {
  template: Template;
  onPress: (template: Template) => void;
}

const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  onPress,
}) => {
  const orientation = template.content.global?.orientation || 'portrait';
  const templateName = template.name.replace('.json', '');

  // Try to find a description from the first section
  const description = template.content.sections?.find(section =>
    section.description?.en
  )?.description?.en || 'Create a video using this template';

  return (
    <Card
      elevate
      size="$4"
      bordered
      animation="bouncy"
      scale={0.9}
      hoverStyle={{ scale: 0.925 }}
      pressStyle={{ scale: 0.875 }}
      onPress={() => onPress(template)}
      width="45%"
      margin="$s"
      overflow="hidden"
      backgroundColor="$backgroundStrong"
      borderColor="$borderColor"
      borderRadius="$4"
      shadowColor="$shadowColor"
      shadowOffset={{ width: 0, height: 1 }}
      shadowOpacity={0.05}
      shadowRadius={2}
    >
      <YStack>
        <Image
          source={{ uri: `http://localhost:3000/serve/${templateName}-thumbnail.jpg` }}
          width="100%"
          height={160}
          resizeMode="cover"
          backgroundColor="$color9"
        />

        <XStack
          position="absolute"
          top="$s"
          right="$s"
          backgroundColor="rgba(0,0,0,0.7)"
          paddingHorizontal="$s"
          paddingVertical="$xs"
          borderRadius={16}
          alignItems="center"
        >
          <Ionicons
            name={orientation === 'portrait' ? 'phone-portrait-outline' : 'phone-landscape-outline'}
            size={16}
            color="white"
          />
        </XStack>

        <YStack padding="$m" space="$xs">
          <Text
            fontSize="$6"
            fontWeight="600"
            color="$color"
            numberOfLines={1}
          >
            {templateName}
          </Text>
          <Text
            fontSize="$3"
            color="$colorTransparent"
            opacity={0.7}
            numberOfLines={2}
            lineHeight="$1"
          >
            {description}
          </Text>
        </YStack>
      </YStack>
    </Card>
  );
};

export default TemplateCard;