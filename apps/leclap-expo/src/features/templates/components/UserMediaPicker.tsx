import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { MUSIC_LIBRARY, BACKGROUND_LIBRARY, backgroundAsset, type MediaCredit } from '@/src/data/mediaCatalog';
import { colors, spacing, typography, fonts } from '@/src/styles/theme';
import type { MediaChoice, MediaChoices } from '@/src/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserMediaPickerProps {
  /** Whether the modal is visible. */
  visible: boolean;
  /** Global options from the template descriptor. */
  allowedMusic?: string[];
  allowUploadMusic?: boolean;
  allowedBackgrounds?: string[];
  allowUploadBackground?: boolean;
  /** Current choices (controlled). */
  musicChoice: MediaChoice | null;
  backgroundChoice: MediaChoice | null;
  onMusicChange: (c: MediaChoice | null) => void;
  onBackgroundChange: (c: MediaChoice | null) => void;
  onClose: () => void;
}

// ─── Upload helpers ────────────────────────────────────────────────────────────

async function pickMusicFile(): Promise<MediaChoice | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'audio/*',
    copyToCacheDirectory: true,
  });

  if (result.canceled || result.assets.length === 0) return null;

  const asset = result.assets[0];

  return { kind: 'upload', uri: asset.uri, name: asset.name };
}

async function pickBackgroundImage(): Promise<MediaChoice | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.85,
    allowsEditing: false,
  });

  if (result.canceled || result.assets.length === 0) return null;

  const asset = result.assets[0];
  const name = asset.fileName ?? asset.uri.split('/').pop() ?? 'background.jpg';

  return { kind: 'upload', uri: asset.uri, name };
}

// ─── Allowed-list resolution ──────────────────────────────────────────────────

function resolveAllowedMusic(allowedIds: string[] | undefined): MediaCredit[] {
  if (!allowedIds?.length) return [];

  return allowedIds.flatMap((id) => {
    const entry = MUSIC_LIBRARY.find((m) => m.id === id);

    return entry ? [entry] : [];
  });
}

function resolveAllowedBackgrounds(allowedIds: string[] | undefined): MediaCredit[] {
  if (!allowedIds?.length) return [];

  return allowedIds.flatMap((id) => {
    const entry = BACKGROUND_LIBRARY.find((m) => m.id === id);

    return entry ? [entry] : [];
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface MusicCardProps {
  item: MediaCredit;
  selected: boolean;
  onPress: () => void;
}

function MusicCard({ item, selected, onPress }: MusicCardProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${item.title} by ${item.author}`}
      style={[st.card, selected && st.cardSelected]}
    >
      <View style={st.musicArt}>
        <Ionicons name="musical-notes" size={28} color={selected ? colors.primary : colors.textSecondary} />
        {selected && (
          <View style={st.checkBadge}>
            <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
          </View>
        )}
      </View>
      <Text style={st.cardTitle} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={st.cardAuthor} numberOfLines={1}>
        {item.author}
      </Text>
    </TouchableOpacity>
  );
}

interface PictureCardProps {
  item: MediaCredit;
  selected: boolean;
  onPress: () => void;
}

function PictureCard({ item, selected, onPress }: PictureCardProps) {
  const source = backgroundAsset(item.id);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${item.title} by ${item.author}`}
      style={[st.card, selected && st.cardSelected]}
    >
      <View style={st.pictureThumb}>
        {source === undefined ? (
          <View style={[st.thumbImage, st.thumbPlaceholder]}>
            <Ionicons name="image-outline" size={24} color={colors.textSecondary} />
          </View>
        ) : (
          <Image source={source} style={st.thumbImage} resizeMode="cover" accessibilityIgnoresInvertColors />
        )}
        {selected && (
          <View style={st.checkBadge}>
            <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
          </View>
        )}
      </View>
      <Text style={st.cardTitle} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={st.cardAuthor} numberOfLines={1}>
        {item.author}
      </Text>
    </TouchableOpacity>
  );
}

interface UploadRowProps {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  chosen: boolean;
  loading: boolean;
  onPress: () => void;
}

function UploadRow({ label, icon, chosen, loading, onPress }: UploadRowProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      style={[st.uploadRow, chosen && st.uploadRowSelected]}
    >
      <View style={st.uploadIcon}>
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons name={icon} size={24} color={chosen ? colors.primary : colors.textSecondary} />
        )}
      </View>
      <Text style={[st.uploadLabel, chosen && st.uploadLabelSelected]}>{label}</Text>
      {chosen && <Ionicons name="checkmark-circle" size={22} color={colors.primary} style={st.uploadCheck} />}
    </TouchableOpacity>
  );
}

// ─── Music section ────────────────────────────────────────────────────────────

interface MusicSectionProps {
  allowedIds?: string[];
  allowUpload?: boolean;
  choice: MediaChoice | null;
  onChange: (c: MediaChoice | null) => void;
}

function MusicSection({ allowedIds, allowUpload, choice, onChange }: MusicSectionProps) {
  const [uploading, setUploading] = useState(false);
  const items = resolveAllowedMusic(allowedIds);

  const handleUpload = async () => {
    setUploading(true);

    try {
      const picked = await pickMusicFile();

      if (picked) onChange(picked);
    } finally {
      setUploading(false);
    }
  };

  const isUploadSelected = choice?.kind === 'upload';
  const uploadLabel = choice?.kind === 'upload' ? choice.name : 'Upload a track…';

  return (
    <View style={st.section}>
      <Text style={st.sectionLabel}>Music</Text>
      {items.length > 0 && (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={st.row}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <MusicCard
              item={item}
              selected={choice?.kind === 'library' && choice.id === item.id}
              onPress={() => {
                onChange({ kind: 'library', id: item.id });
              }}
            />
          )}
        />
      )}
      {allowUpload && (
        <UploadRow
          label={uploadLabel}
          icon="cloud-upload-outline"
          chosen={isUploadSelected}
          loading={uploading}
          onPress={() => {
            handleUpload().catch(() => {});
          }}
        />
      )}
    </View>
  );
}

// ─── Background section ───────────────────────────────────────────────────────

interface BackgroundSectionProps {
  allowedIds?: string[];
  allowUpload?: boolean;
  choice: MediaChoice | null;
  onChange: (c: MediaChoice | null) => void;
}

function BackgroundSection({ allowedIds, allowUpload, choice, onChange }: BackgroundSectionProps) {
  const [uploading, setUploading] = useState(false);
  const items = resolveAllowedBackgrounds(allowedIds);

  const handleUpload = async () => {
    setUploading(true);

    try {
      const picked = await pickBackgroundImage();

      if (picked) onChange(picked);
    } finally {
      setUploading(false);
    }
  };

  const isUploadSelected = choice?.kind === 'upload';
  const uploadLabel = choice?.kind === 'upload' ? choice.name : 'Upload a photo…';

  return (
    <View style={st.section}>
      <Text style={st.sectionLabel}>Background Image</Text>
      {items.length > 0 && (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={st.row}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <PictureCard
              item={item}
              selected={choice?.kind === 'library' && choice.id === item.id}
              onPress={() => {
                onChange({ kind: 'library', id: item.id });
              }}
            />
          )}
        />
      )}
      {allowUpload && (
        <UploadRow
          label={uploadLabel}
          icon="image-outline"
          chosen={isUploadSelected}
          loading={uploading}
          onPress={() => {
            handleUpload().catch(() => {});
          }}
        />
      )}
    </View>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function UserMediaPicker({
  visible,
  allowedMusic,
  allowUploadMusic,
  allowedBackgrounds,
  allowUploadBackground,
  musicChoice,
  backgroundChoice,
  onMusicChange,
  onBackgroundChange,
  onClose,
}: UserMediaPickerProps) {
  const showMusic = (allowedMusic?.length ?? 0) > 0 || Boolean(allowUploadMusic);
  const showBackground = (allowedBackgrounds?.length ?? 0) > 0 || Boolean(allowUploadBackground);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <SafeAreaView style={st.container} edges={['top', 'bottom']}>
          <View style={st.header}>
            <Text style={st.title}>Music &amp; Background</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close">
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={[]}
            keyExtractor={() => ''}
            renderItem={null}
            ListHeaderComponent={
              <>
                {showMusic && (
                  <MusicSection
                    allowedIds={allowedMusic}
                    allowUpload={allowUploadMusic}
                    choice={musicChoice}
                    onChange={onMusicChange}
                  />
                )}
                {showBackground && (
                  <BackgroundSection
                    allowedIds={allowedBackgrounds}
                    allowUpload={allowUploadBackground}
                    choice={backgroundChoice}
                    onChange={onBackgroundChange}
                  />
                )}
              </>
            }
            contentContainerStyle={st.scrollContent}
          />

          <View style={st.footer}>
            <TouchableOpacity style={st.doneButton} onPress={onClose} accessibilityRole="button">
              <Text style={st.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const CARD_GAP = spacing.s;

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  title: { ...typography.title, flex: 1, marginRight: spacing.m },
  scrollContent: { padding: spacing.m, paddingBottom: spacing.xxl },
  section: { marginBottom: spacing.l },
  sectionLabel: {
    fontFamily: fonts.poppins.semiBold,
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.m,
  },
  row: { gap: CARD_GAP, marginBottom: CARD_GAP },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.divider,
    padding: spacing.s,
    overflow: 'hidden',
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(124,131,253,0.06)',
  },
  musicArt: {
    height: 72,
    borderRadius: 8,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.s,
    position: 'relative',
  },
  pictureThumb: {
    height: 72,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: spacing.s,
    position: 'relative',
    backgroundColor: colors.background,
  },
  thumbImage: { width: '100%', height: '100%', borderRadius: 8 },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  checkBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: colors.surface, borderRadius: 10 },
  cardTitle: { ...typography.caption, color: colors.text, fontWeight: '600', marginBottom: 2 },
  cardAuthor: { ...typography.smallText, color: colors.textSecondary },
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.divider,
    borderStyle: 'dashed',
    padding: spacing.m,
    marginTop: spacing.s,
  },
  uploadRowSelected: { borderColor: colors.primary, borderStyle: 'solid' },
  uploadIcon: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  uploadLabel: { flex: 1, ...typography.body, color: colors.textSecondary, marginLeft: spacing.s },
  uploadLabelSelected: { color: colors.text },
  uploadCheck: { marginLeft: spacing.s },
  footer: {
    padding: spacing.m,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
  },
  doneButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.m,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  doneButtonText: {
    color: 'white',
    fontFamily: fonts.poppins.semiBold,
    fontSize: 17,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});

export type { MediaChoices };
