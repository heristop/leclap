import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Share, StyleSheet, Alert } from 'react-native';
import { Asset } from 'expo-media-library';
import { Sheet } from '@/src/features/templates/components/Sheet';
import { requestMediaLibraryPermission } from '@/src/utils/permissions';
import { colors, spacing, typography, withAlpha } from '@/src/styles/theme';

interface ExportSheetProps {
  visible: boolean;
  videoUri: string;
  onClose: () => void;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type UploadState = 'idle' | 'uploading' | 'done' | 'error';

function useSaveToGallery() {
  const [state, setState] = useState<SaveState>('idle');

  const save = async (uri: string) => {
    setState('saving');
    const granted = await requestMediaLibraryPermission();

    if (!granted) {
      setState('idle');

      return;
    }

    try {
      await Asset.create(uri);
      setState('saved');
    } catch {
      setState('error');
      Alert.alert('Save failed', 'Could not save the video to your gallery.');
    }
  };

  return { state, save };
}

function useUpload() {
  const [state, setState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [url, setUrl] = useState('');

  const upload = async (videoUri: string) => {
    if (!url.trim()) {
      Alert.alert('Missing URL', 'Enter an upload URL first.');

      return;
    }

    setState('uploading');
    setProgress(0);

    try {
      const body = new FormData();
      body.append('file', { uri: videoUri, name: 'video.mp4', type: 'video/mp4' } as unknown as Blob);

      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      await new Promise<void>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();

            return;
          }

          reject(new Error(`HTTP ${xhr.status}`));
        };
        xhr.onerror = () => {
          reject(new Error('Network error'));
        };
        xhr.open('POST', url.trim());
        xhr.send(body);
      });

      setState('done');
    } catch (error) {
      setState('error');
      const message = error instanceof Error ? error.message : 'Upload failed';
      Alert.alert('Upload failed', message);
    }
  };

  return { state, progress, url, setUrl, upload };
}

interface ActionRowProps {
  label: string;
  sublabel?: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
}

const ActionRow = ({ label, sublabel, onPress, disabled, busy }: ActionRowProps) => (
  <TouchableOpacity
    style={[styles.actionRow, disabled && styles.actionRowDisabled]}
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    <View style={styles.actionRowText}>
      <Text style={styles.actionLabel}>{label}</Text>
      {sublabel ? <Text style={styles.actionSublabel}>{sublabel}</Text> : null}
    </View>
    {busy ? <ActivityIndicator size="small" color={colors.primary} /> : null}
  </TouchableOpacity>
);

const saveLabel = (state: SaveState): string => {
  if (state === 'saving') return 'Saving…';

  if (state === 'saved') return 'Saved to gallery';

  if (state === 'error') return 'Save failed — tap to retry';

  return 'Save to gallery';
};

const uploadLabel = (state: UploadState, progress: number): string => {
  if (state === 'uploading') return `Uploading… ${progress}%`;

  if (state === 'done') return 'Upload complete';

  if (state === 'error') return 'Upload failed — tap to retry';

  return 'Upload';
};

export const ExportSheet = ({ visible, videoUri, onClose }: ExportSheetProps) => {
  const { state: saveState, save } = useSaveToGallery();
  const { state: uploadState, progress, url, setUrl, upload } = useUpload();

  const handleShare = () => {
    Share.share({ url: videoUri, title: 'My LeClap video' }).catch(() => {});
  };

  return (
    <Sheet visible={visible} title="Export video" onClose={onClose}>
      <View style={styles.content}>
        <ActionRow
          label={saveLabel(saveState)}
          sublabel="Save a copy to your Photos library"
          onPress={() => {
            save(videoUri).catch(() => {});
          }}
          disabled={saveState === 'saving' || saveState === 'saved'}
          busy={saveState === 'saving'}
        />

        <ActionRow label="Share" sublabel="Open the system share sheet" onPress={handleShare} />

        <View style={styles.uploadSection}>
          <Text style={styles.uploadTitle}>Upload to URL</Text>
          <TextInput
            style={styles.urlInput}
            placeholder="https://example.com/upload"
            placeholderTextColor={colors.textSecondary}
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            editable={uploadState !== 'uploading'}
          />
          {uploadState === 'uploading' ? (
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
          ) : null}
          <TouchableOpacity
            style={[
              styles.uploadBtn,
              (!url.trim() || uploadState === 'uploading' || uploadState === 'done') && styles.uploadBtnDisabled,
            ]}
            onPress={() => {
              upload(videoUri).catch(() => {});
            }}
            disabled={!url.trim() || uploadState === 'uploading' || uploadState === 'done'}
            accessibilityRole="button"
            accessibilityLabel={uploadLabel(uploadState, progress)}
          >
            {uploadState === 'uploading' ? <ActivityIndicator size="small" color="white" /> : null}
            <Text style={styles.uploadBtnText}>{uploadLabel(uploadState, progress)}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  content: { paddingTop: spacing.s, gap: spacing.s },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: withAlpha(colors.primary, 0.06),
    borderRadius: 12,
    padding: spacing.m,
  },
  actionRowDisabled: { opacity: 0.5 },
  actionRowText: { flex: 1 },
  actionLabel: { ...typography.body, color: colors.text, fontWeight: '600' },
  actionSublabel: { ...typography.caption, marginTop: 2 },
  uploadSection: { gap: spacing.s, marginTop: spacing.s },
  uploadTitle: { ...typography.body, color: colors.text, fontWeight: '600' },
  urlInput: {
    ...typography.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 10,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    backgroundColor: colors.surface,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.divider,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: spacing.m,
  },
  uploadBtnDisabled: { opacity: 0.5 },
  uploadBtnText: { ...typography.button, color: 'white' },
});
