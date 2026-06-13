import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import FormSection from '@/src/features/editor/components/FormSection';
import type { Template, Section, Project, MediaChoice, MediaChoices } from '@/src/types';
import { colors } from '@/src/styles/theme';
import { styles } from './TemplateDetailScreen.styles';
import { useTemplate } from '@/src/hooks/useTemplates';
import { useProject, useSaveProject } from '@/src/hooks/useProjects';
import { useQueueVideoCompilation } from '@/src/hooks/useCompilationQueue';
import { useOffline } from '@/src/providers/OfflineProvider';
import { useCompileMode, useWizardMode, useSetWizardMode, type WizardMode } from '@/src/stores/useSettingsStore';
import { UserMediaPicker } from '@/src/features/templates/components/UserMediaPicker';
import { needsMediaStep } from '@/src/services/media/mediaStepHelpers';
import { MUSIC_LIBRARY, findMusic } from '@/src/data/mediaCatalog';

const EDITABLE_TYPES = ['project_video', 'form', 'music', 'picture'] as const;
const SECTION_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  project_video: 'videocam',
  form: 'document-text',
  music: 'musical-notes',
  picture: 'image',
};

function getSectionIcon(s: Section): keyof typeof Ionicons.glyphMap {
  return SECTION_ICONS[s.type] ?? 'document';
}

function isSectionCompleted(section: Section, project: Project): boolean {
  if (section.type === 'project_video' || section.type === 'picture') {
    return Boolean(project.recordedVideos[section.name]);
  }

  if (section.type === 'form') return (section.options?.fields ?? []).every((f) => Boolean(project.formData[f.name]));

  if (section.type === 'music') return Boolean(project.formData[`music_${section.name}`]);

  return false;
}

function getSectionInfo(t: Template | undefined, p: Project | null): { filtered: Section[]; completed: number } {
  const filtered = (t?.content.sections ?? []).filter((s) => (EDITABLE_TYPES as readonly string[]).includes(s.type));

  return { filtered, completed: p ? filtered.filter((s) => isSectionCompleted(s, p)).length : 0 };
}

// The currently-stored track id for a music section (or undefined when none chosen yet).
function activeMusicSelection(project: Project, section: Section | null): string | undefined {
  if (!section) return undefined;

  return project.formData[`music_${section.name}`] as string | undefined;
}

function compileTemplate(content: Template['content'], formData: Project['formData']): Record<string, unknown> {
  let str = JSON.stringify(JSON.parse(JSON.stringify(content)) as unknown);

  for (const [key, value] of Object.entries(formData)) {
    str = str.replace(new RegExp(`{{ ${key} }}`.replace(/[-\\^$*+?.()|[\]{}]/g, String.raw`\$&`), 'g'), String(value));
  }

  return JSON.parse(str) as Record<string, unknown>;
}

function getButtonLabel(isPending: boolean, willQueue: boolean, t: TFunction<'detail'>): string {
  if (!isPending) return t('button.create');

  return willQueue ? t('button.addingToQueue') : t('button.creating');
}

function isCompileDisabled(allDone: boolean, isPending: boolean): boolean {
  return !allDone || isPending;
}

// Template detail is a root-stack screen reached by push (from the lists) or replace (after
// recording the last section / finishing the preview). A replace-entry can have an empty back
// stack, so fall back to the tabs rather than letting router.back() throw "GO_BACK not handled".
function makeGoBack(router: ReturnType<typeof useRouter>): () => void {
  return () => {
    if (router.canGoBack()) {
      router.back();

      return;
    }

    router.replace('/(app)');
  };
}

type FormModalProps = {
  section: Section | null;
  formData: Project['formData'];
  onFormDataChange: (f: string, v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};
const FormModal = ({ section, formData, onFormDataChange, onClose, onSubmit }: FormModalProps) => {
  const { t } = useTranslation('common');

  if (!section) return null;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.formModalContainer}>
        <View style={styles.formHeader}>
          <Text style={styles.formTitle}>{section.title?.en ?? section.name}</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <ScrollView>
          <FormSection
            section={section}
            formData={formData as Record<string, string>}
            onFormDataChange={onFormDataChange}
          />
        </ScrollView>
        <View style={styles.formFooter}>
          <TouchableOpacity style={styles.formSubmitButton} onPress={onSubmit}>
            <Text style={styles.formSubmitButtonText}>{t('actions.done')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

type MusicModalProps = {
  section: Section | null;
  allowedMusic: string[] | undefined;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  onClose: () => void;
  onUseDefault: () => void;
};
// Per-section music chooser. The viewer picks one allowed track (or the default soundtrack); the
// choice is stored as project.formData[`music_<name>`]. Allowed track ids come from the template's
// global.allowedMusic; an empty/absent list falls back to the whole music library.
const MusicModal = ({ section, allowedMusic, selectedId, onSelect, onClose, onUseDefault }: MusicModalProps) => {
  const { t } = useTranslation('detail');

  if (!section) return null;

  const allowed = allowedMusic && allowedMusic.length > 0 ? allowedMusic : undefined;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.formModalContainer}>
        <View style={styles.formHeader}>
          <Text style={styles.formTitle}>{section.title?.en ?? section.name}</Text>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel={t('music.done')}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.musicScroll}>
          <Text style={styles.musicHint}>{t('music.pick')}</Text>
          <TouchableOpacity
            accessibilityRole="radio"
            accessibilityState={{ selected: selectedId === 'default' }}
            onPress={() => {
              onSelect('default');
            }}
            style={[styles.musicDefaultRow, selectedId === 'default' && styles.musicDefaultRowActive]}
          >
            <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
            <Text style={styles.musicDefaultText}>{t('music.defaultOption')}</Text>
            {selectedId === 'default' ? <Ionicons name="checkmark-circle" size={20} color={colors.primary} /> : null}
          </TouchableOpacity>
          <MusicSectionPicker allowed={allowed} selectedId={selectedId} onSelect={onSelect} />
          <TouchableOpacity style={styles.tempCompleteButton} onPress={onUseDefault}>
            <Text style={styles.tempCompleteButtonText}>{t('music.done')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

// Single-select track list. `allowed` (when set) restricts the library to the template's allowed ids.
type MusicSectionPickerProps = {
  allowed: string[] | undefined;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
};
const MusicSectionPicker = ({ allowed, selectedId, onSelect }: MusicSectionPickerProps) => {
  const ids = allowed ?? MUSIC_LIBRARY.map((m) => m.id);

  return (
    <View>
      {ids.map((id) => {
        const track = findMusic(id);
        const selected = selectedId === id;

        return (
          <TouchableOpacity
            key={id}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={track?.title ?? id}
            onPress={() => {
              onSelect(id);
            }}
            style={[styles.musicTrackRow, selected && styles.musicTrackRowActive]}
          >
            <Ionicons name="musical-note" size={18} color={selected ? colors.primary : colors.textSecondary} />
            <View style={styles.musicTrackText}>
              <Text style={styles.musicTrackTitle}>{track?.title ?? id}</Text>
              {track?.author ? <Text style={styles.musicTrackAuthor}>{track.author}</Text> : null}
            </View>
            {selected ? <Ionicons name="checkmark-circle" size={20} color={colors.primary} /> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

type SectionItemProps = { section: Section; project: Project; onPress: () => void; onPreview: () => void };
const SectionItem = ({ section, project, onPress, onPreview }: SectionItemProps) => {
  const { t } = useTranslation('detail');
  const completed = isSectionCompleted(section, project);

  return (
    <TouchableOpacity style={styles.sectionItem} onPress={onPress}>
      <View style={styles.sectionItemContent}>
        <View style={styles.sectionTypeIcon}>
          <Ionicons name={getSectionIcon(section)} size={24} color={colors.primary} />
        </View>
        <View style={styles.sectionItemText}>
          <Text style={styles.sectionItemTitle}>{section.title?.en ?? section.name}</Text>
          {section.description?.en ? (
            <Text style={styles.sectionItemDescription} numberOfLines={1}>
              {section.description.en}
            </Text>
          ) : null}
        </View>
        <View style={styles.sectionItemStatus}>
          {completed ? (
            <Ionicons name="checkmark-circle" size={24} color={colors.success} />
          ) : (
            <Ionicons name="ellipse-outline" size={24} color={colors.divider} />
          )}
        </View>
      </View>
      {completed && (section.type === 'project_video' || section.type === 'picture') && (
        <View style={styles.sectionItemActions}>
          <TouchableOpacity
            style={styles.previewButton}
            onPress={(e) => {
              e.stopPropagation();
              onPreview();
            }}
          >
            <Ionicons name="play" size={16} color={colors.primary} />
            <Text style={styles.previewButtonText}>{t('preview')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
};

type HandlerCtx = {
  project: Project | null;
  template: Template | undefined;
  activeFormSection: Section | null;
  activeMusicSection: Section | null;
  setProject: (p: Project) => void;
  setActiveFormSection: (s: Section | null) => void;
  setActiveMusicSection: (s: Section | null) => void;
  saveProjectMutation: ReturnType<typeof useSaveProject>;
  router: ReturnType<typeof useRouter>;
};

function useSectionHandlers(ctx: HandlerCtx) {
  const { t } = useTranslation('detail');
  const {
    project,
    template,
    activeFormSection,
    activeMusicSection,
    setProject,
    setActiveFormSection,
    setActiveMusicSection,
    saveProjectMutation,
    router,
  } = ctx;
  const handleFormDataChange = (field: string, value: string) => {
    if (!project) return;
    setProject({ ...project, formData: { ...project.formData, [field]: value }, updatedAt: new Date().toISOString() });
    saveProjectMutation.mutate({
      ...project,
      formData: { ...project.formData, [field]: value },
      updatedAt: new Date().toISOString(),
    });
  };
  const handleFormSubmit = () => {
    if (!activeFormSection || !project) return;
    const done = (activeFormSection.options?.fields ?? []).every((f) => Boolean(project.formData[f.name]));

    if (done) {
      setActiveFormSection(null);

      return;
    }

    Alert.alert(t('alerts.incompleteForm.title'), t('alerts.incompleteForm.message'));
  };
  const handlePreviewVideo = (section: Section) => {
    if (project?.recordedVideos[section.name] && template?.content.global?.orientation) {
      router.push({
        pathname: '/(fullscreen)/preview',
        params: {
          projectId: project.id,
          videoUri: project.recordedVideos[section.name].path,
          orientation: template.content.global.orientation,
          sectionName: section.name,
        },
      });

      return;
    }
    console.error('Cannot preview video: Missing project, video, or orientation data.');
    Alert.alert(t('alerts.error.title'), t('alerts.error.message'));
  };
  const handleSectionPress = (section: Section) => {
    if (!project || !template) return;

    if (section.type === 'project_video' || section.type === 'picture') {
      router.push({
        pathname: '/(fullscreen)/record-section',
        params: {
          projectId: project.id,
          sectionJson: JSON.stringify(section),
          orientation: template.content.global?.orientation ?? 'portrait',
          existingVideoPath: project.recordedVideos[section.name]?.path,
        },
      });

      return;
    }

    if (section.type === 'form') {
      setActiveFormSection(section);

      return;
    }

    if (section.type === 'music') {
      setActiveMusicSection(section);

      return;
    }

    Alert.alert(t('alerts.unsupported.title'), t('alerts.unsupported.message'));
  };
  // Persist the chosen track id (or 'default') for the active music section, keeping the modal open
  // so the selection's checkmark updates in place — the user dismisses with Done/close.
  const selectMusic = (id: string) => {
    if (!project || !activeMusicSection) return;

    const updated = {
      ...project,
      formData: { ...project.formData, [`music_${activeMusicSection.name}`]: id },
      updatedAt: new Date().toISOString(),
    };
    setProject(updated);
    saveProjectMutation.mutate(updated);
  };

  const handleMusicSelect = (id: string) => {
    selectMusic(id);
  };

  const handleMusicUseDefault = () => {
    if (project && activeMusicSection && !project.formData[`music_${activeMusicSection.name}`]) selectMusic('default');

    setActiveMusicSection(null);
  };

  return {
    handleFormDataChange,
    handleFormSubmit,
    handlePreviewVideo,
    handleSectionPress,
    handleMusicSelect,
    handleMusicUseDefault,
  };
}

type CompileCtx = {
  project: Project | null;
  template: Template | undefined;
  mediaChoices: MediaChoices;
  setProject: (p: Project) => void;
  saveProjectMutation: ReturnType<typeof useSaveProject>;
  queueVideoCompilation: ReturnType<typeof useQueueVideoCompilation>;
  router: ReturnType<typeof useRouter>;
};

function useCompileHandler(ctx: CompileCtx) {
  const { t } = useTranslation('detail');
  const { t: tc } = useTranslation('common');
  const { project, template, mediaChoices, setProject, saveProjectMutation, queueVideoCompilation, router } = ctx;

  return () => {
    if (!project || !template) return;
    queueVideoCompilation.mutate(
      {
        projectId: project.id,
        templateDescriptor: compileTemplate(template.content, project.formData),
        recordedVideos: project.recordedVideos,
        mediaChoices,
      },
      {
        onSuccess: (result) => {
          if (result.immediate && result.result?.success) {
            const updated = {
              ...project,
              outputVideoUri: result.result.outputUri,
              status: 'completed' as const,
              updatedAt: new Date().toISOString(),
            };
            setProject(updated);
            saveProjectMutation.mutate(updated);
            router.push({
              pathname: '/(fullscreen)/preview',
              params: { projectId: project.id, videoUri: result.result.outputUri },
            });

            return;
          }

          if (!result.immediate) {
            Alert.alert(t('alerts.addedToQueue.title'), t('alerts.addedToQueue.message'), [
              {
                text: tc('actions.ok'),
                onPress: () => {
                  router.back();
                },
              },
            ]);

            return;
          }
          Alert.alert(
            t('alerts.compilationFailed.title'),
            result.result?.error ?? t('alerts.compilationFailed.fallback')
          );
        },
        onError: (error: unknown) => {
          console.error('Error during compilation:', error);
          Alert.alert(
            t('alerts.compilationError.title'),
            t('alerts.compilationError.message', {
              error: error instanceof Error ? error.message : t('alerts.compilationError.unknownError'),
            })
          );
        },
      }
    );
  };
}

type ProjectInitArgs = {
  template: Template | undefined;
  existingProject: Project | null | undefined;
  projectLoading: boolean;
  projectId: string | undefined;
  saveProjectMutation: ReturnType<typeof useSaveProject>;
  setProject: (p: Project) => void;
};

function buildDraftProject(template: Template): Project {
  return {
    id: Date.now().toString(),
    name: `${template.name.replace('.json', '')} Project`,
    templateName: template.name,
    templateContent: template.content,
    status: 'draft',
    formData: {},
    recordedVideos: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function useProjectInitialization(args: ProjectInitArgs) {
  const { template, existingProject, projectLoading, projectId, saveProjectMutation, setProject } = args;
  // react-query recreates the mutation object every render and the setProject wrapper is a fresh
  // closure each render, so keep both in refs instead of effect dependencies. Initialize the
  // project exactly once: without the guard, the new-project branch built a fresh object (new
  // Date.now() id) and called setProject every render, causing an infinite update-depth loop and
  // spamming saveProjectMutation.mutate.
  const saveProjectMutationRef = useRef(saveProjectMutation);
  saveProjectMutationRef.current = saveProjectMutation;
  const setProjectRef = useRef(setProject);
  setProjectRef.current = setProject;
  const projectInitializedRef = useRef(false);

  useEffect(() => {
    if (!template || (projectId !== undefined && projectLoading)) return;

    if (projectInitializedRef.current) return;

    if (existingProject) {
      projectInitializedRef.current = true;
      setProjectRef.current(existingProject);

      return;
    }

    if (!projectId) {
      projectInitializedRef.current = true;
      const p = buildDraftProject(template);
      setProjectRef.current(p);
      saveProjectMutationRef.current.mutate(p);
    }
  }, [template, existingProject, projectLoading, projectId]);
}

function computeAllDone(
  project: Project | null,
  template: Template | null | undefined,
  filteredSections: Section[],
  hasMediaStep: boolean,
  mediaStepDone: boolean
): boolean {
  // Guard the not-loaded state. A loaded template with no editable sections (e.g. a premium
  // color/text card — nothing to record or fill in) is self-contained and ready to compile;
  // `every` is vacuously true for the empty list, so it falls through to the media-step check.
  if (project === null || !template) return false;

  if (!filteredSections.every((s) => isSectionCompleted(s, project))) return false;

  return !hasMediaStep || mediaStepDone;
}

/** Bundles the persisted wizard-mode preference so the screen hook reads it in one statement. */
function useWizardToggle() {
  const mode = useWizardMode();
  const setMode = useSetWizardMode();

  return { mode, setMode };
}

/** Owns the user's media-step state (music/background choices + picker visibility). */
function useMediaState() {
  const [mediaPickerVisible, setMediaPickerVisible] = useState(false);
  const [musicChoice, setMusicChoice] = useState<MediaChoice | null>(null);
  const [backgroundChoice, setBackgroundChoice] = useState<MediaChoice | null>(null);
  const mediaChoices: MediaChoices = {
    music: musicChoice ?? undefined,
    background: backgroundChoice ?? undefined,
  };
  // Media step is "done" once any choice is made (music or background). If neither is
  // required the row never appears, so we don't gate compile on it.
  const mediaStepDone = Boolean(musicChoice ?? backgroundChoice);

  return {
    mediaPickerVisible,
    setMediaPickerVisible,
    musicChoice,
    setMusicChoice,
    backgroundChoice,
    setBackgroundChoice,
    mediaChoices,
    mediaStepDone,
  };
}

function useTemplateHandlers(ctx: HandlerCtx & Pick<CompileCtx, 'mediaChoices' | 'queueVideoCompilation'>) {
  const sectionHandlers = useSectionHandlers(ctx);
  const handleCompile = useCompileHandler({
    project: ctx.project,
    template: ctx.template,
    mediaChoices: ctx.mediaChoices,
    setProject: ctx.setProject,
    saveProjectMutation: ctx.saveProjectMutation,
    queueVideoCompilation: ctx.queueVideoCompilation,
    router: ctx.router,
  });

  return { ...sectionHandlers, handleCompile };
}

function computeProgress(
  filteredSections: Section[],
  completedSectionsCount: number,
  hasMediaStep: boolean,
  mediaStepDone: boolean
): { totalItems: number; totalDone: number } {
  const mediaItem = hasMediaStep ? 1 : 0;
  const mediaDone = hasMediaStep && mediaStepDone ? 1 : 0;

  return {
    totalItems: filteredSections.length + mediaItem,
    totalDone: completedSectionsCount + mediaDone,
  };
}

function useTemplateDetail(templateName: string, projectId: string | undefined) {
  const { t } = useTranslation('detail');
  const router = useRouter();
  const { data: template, isLoading: templateLoading, error: templateError } = useTemplate(templateName);
  const { data: existingProject, isLoading: projectLoading } = useProject(projectId ?? '');
  const saveProjectMutation = useSaveProject();
  const queueVideoCompilation = useQueueVideoCompilation();
  const { isOffline } = useOffline();
  const compileMode = useCompileMode();
  const wizard = useWizardToggle();
  // A job is only queued in Cloud mode when the server can't be reached. Local always renders now,
  // so the button must never say "Adding to Queue…" on-device.
  const [project, setProject] = useState<Project | null>(null);
  const [activeFormSection, setActiveFormSection] = useState<Section | null>(null);
  const [activeMusicSection, setActiveMusicSection] = useState<Section | null>(null);
  const {
    mediaPickerVisible,
    setMediaPickerVisible,
    musicChoice,
    setMusicChoice,
    backgroundChoice,
    setBackgroundChoice,
    mediaChoices,
    mediaStepDone,
  } = useMediaState();

  useProjectInitialization({
    template,
    existingProject,
    projectLoading,
    projectId,
    saveProjectMutation,
    setProject,
  });
  const { filtered: filteredSections, completed: completedSectionsCount } = getSectionInfo(template, project);
  const hasMediaStep = needsMediaStep(template?.content.global);
  const hCtx: HandlerCtx = {
    project,
    template,
    activeFormSection,
    activeMusicSection,
    setProject,
    setActiveFormSection,
    setActiveMusicSection,
    saveProjectMutation,
    router,
  };
  const {
    handleFormDataChange,
    handleFormSubmit,
    handlePreviewVideo,
    handleSectionPress,
    handleMusicSelect,
    handleMusicUseDefault,
    handleCompile,
  } = useTemplateHandlers({ ...hCtx, mediaChoices, queueVideoCompilation });
  const allDone = computeAllDone(project, template, filteredSections, hasMediaStep, mediaStepDone);

  return {
    template,
    templateLoading,
    templateError,
    project,
    filteredSections,
    completedSectionsCount,
    allDone,
    orientation: template?.content.global?.orientation ?? 'portrait',
    description: template?.content.sections?.find((s) => s.description?.en)?.description?.en ?? t('defaultDescription'),
    activeFormSection,
    setActiveFormSection,
    activeMusicSection,
    setActiveMusicSection,
    hasMediaStep,
    mediaPickerVisible,
    setMediaPickerVisible,
    musicChoice,
    backgroundChoice,
    setMusicChoice,
    setBackgroundChoice,
    mediaStepDone,
    isPending: queueVideoCompilation.isPending,
    willQueue: compileMode === 'server' && isOffline,
    wizardMode: wizard.mode,
    setWizardMode: wizard.setMode,
    handleFormDataChange,
    handleFormSubmit,
    handlePreviewVideo,
    handleSectionPress,
    handleMusicSelect,
    handleMusicUseDefault,
    handleCompile,
    router,
  };
}

const LoadingState = () => {
  const { t } = useTranslation('detail');

  return (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.loadingText}>{t('loading')}</Text>
    </View>
  );
};

type ErrorStateProps = { error: unknown; onBack: () => void };
const ErrorState = ({ error, onBack }: ErrorStateProps) => {
  const { t } = useTranslation('detail');

  return (
    <View style={styles.centerContainer}>
      <Text style={styles.errorText}>{error instanceof Error ? error.message : t('notFound')}</Text>
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>{t('backToTemplates')}</Text>
      </TouchableOpacity>
    </View>
  );
};

type OrientationRowProps = { orientation: string };
const OrientationRow = ({ orientation }: OrientationRowProps) => {
  const { t } = useTranslation('detail');
  const isPortrait = orientation === 'portrait';
  const icon: keyof typeof Ionicons.glyphMap = isPortrait ? 'phone-portrait-outline' : 'phone-landscape-outline';

  return (
    <View style={styles.orientationRow}>
      <Ionicons name={icon} size={24} color={colors.text} />
      <Text style={styles.orientationText}>{isPortrait ? t('orientation.portrait') : t('orientation.landscape')}</Text>
    </View>
  );
};

type CompileFooterProps = {
  isDisabled: boolean;
  isPending: boolean;
  willQueue: boolean;
  onCompile: () => void;
};
const CompileFooter = ({ isDisabled, isPending, willQueue, onCompile }: CompileFooterProps) => {
  const { t } = useTranslation('detail');

  return (
    <View style={styles.footer}>
      <TouchableOpacity
        style={[styles.createButton, isDisabled && styles.disabledButton]}
        disabled={isDisabled}
        onPress={onCompile}
      >
        <Text style={styles.createButtonText}>{getButtonLabel(isPending, willQueue, t)}</Text>
        {isPending && <ActivityIndicator size="small" color="white" style={styles.loader} />}
      </TouchableOpacity>
    </View>
  );
};

type MediaStepRowProps = { done: boolean; onPress: () => void };
const MediaStepRow = ({ done, onPress }: MediaStepRowProps) => {
  const { t } = useTranslation('detail');

  return (
    <TouchableOpacity
      style={styles.sectionItem}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('media.accessibilityLabel')}
    >
      <View style={styles.sectionItemContent}>
        <View style={styles.sectionTypeIcon}>
          <Ionicons name="musical-notes" size={24} color={colors.primary} />
        </View>
        <View style={styles.sectionItemText}>
          <Text style={styles.sectionItemTitle}>{t('media.title')}</Text>
          <Text style={styles.sectionItemDescription} numberOfLines={1}>
            {done ? t('media.saved') : t('media.description')}
          </Text>
        </View>
        <View style={styles.sectionItemStatus}>
          {done ? (
            <Ionicons name="checkmark-circle" size={24} color={colors.success} />
          ) : (
            <Ionicons name="ellipse-outline" size={24} color={colors.divider} />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

type HubSectionListProps = {
  filteredSections: Section[];
  project: Project;
  hasMediaStep: boolean;
  mediaStepDone: boolean;
  onSectionPress: (s: Section) => void;
  onPreview: (s: Section) => void;
  onMediaPress: () => void;
};
const HubSectionList = (p: HubSectionListProps) => {
  const { t } = useTranslation('detail');

  return (
    <>
      <Text style={styles.sectionTitle}>{t('sectionsTitle')}</Text>
      {p.filteredSections.map((section) => (
        <SectionItem
          key={section.name}
          section={section}
          project={p.project}
          onPress={() => {
            p.onSectionPress(section);
          }}
          onPreview={() => {
            p.onPreview(section);
          }}
        />
      ))}
      {p.hasMediaStep && <MediaStepRow done={p.mediaStepDone} onPress={p.onMediaPress} />}
    </>
  );
};

type ModeToggleProps = { mode: WizardMode; onChange: (m: WizardMode) => void };
const ModeToggle = ({ mode, onChange }: ModeToggleProps) => {
  const { t } = useTranslation('detail');
  const options: { value: WizardMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { value: 'linear', label: t('mode.linear'), icon: 'footsteps-outline' },
    { value: 'hub', label: t('mode.hub'), icon: 'grid-outline' },
  ];

  return (
    <View style={styles.modeToggle} accessibilityRole="tablist">
      {options.map((opt) => {
        const active = mode === opt.value;

        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.modeToggleOption, active && styles.modeToggleOptionActive]}
            onPress={() => {
              onChange(opt.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={opt.label}
          >
            <Ionicons name={opt.icon} size={16} color={active ? colors.text : colors.textSecondary} />
            <Text style={[styles.modeToggleText, active && styles.modeToggleTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// The linear walk reuses the hub's per-section helpers. A "media" pseudo-step is appended after the
// real sections when the template offers music/background, mirroring the web wizard's media step.
type LinearStep = { kind: 'section'; section: Section } | { kind: 'media' };

function buildLinearSteps(filteredSections: Section[], hasMediaStep: boolean): LinearStep[] {
  const steps: LinearStep[] = filteredSections.map((section) => ({ kind: 'section', section }));

  if (hasMediaStep) steps.push({ kind: 'media' });

  return steps;
}

function isLinearStepComplete(step: LinearStep, project: Project, mediaStepDone: boolean): boolean {
  if (step.kind === 'media') return mediaStepDone;

  return isSectionCompleted(step.section, project);
}

function getLinearStepCopy(
  step: LinearStep,
  t: TFunction<'detail'>
): { title: string; description: string; cta: string } {
  if (step.kind === 'media') {
    return {
      title: t('linearCopy.mediaTitle'),
      description: t('linearCopy.mediaDescription'),
      cta: t('linearCopy.mediaCta'),
    };
  }
  const { section } = step;
  const title = section.title?.en ?? section.name;
  const description = section.description?.en ?? t('linearCopy.sectionFallbackDescription');

  if (section.type === 'project_video' || section.type === 'picture') {
    return { title, description, cta: t('linearCopy.recordCta') };
  }

  if (section.type === 'form') return { title, description, cta: t('linearCopy.formCta') };

  return { title, description, cta: t('linearCopy.openCta') };
}

type LinearStepScreenProps = {
  step: LinearStep;
  index: number;
  total: number;
  complete: boolean;
  onAction: () => void;
};
const LinearStepScreen = ({ step, index, total, complete, onAction }: LinearStepScreenProps) => {
  const { t } = useTranslation('detail');
  const { title, description, cta } = getLinearStepCopy(step, t);

  return (
    <View>
      <Text style={styles.stepIndicator}>{t('step.indicator', { index: index + 1, total })}</Text>
      <Text style={styles.stepTitle}>{title}</Text>
      <Text style={styles.stepDescription}>{description}</Text>
      <View style={styles.stepStatusRow}>
        <Ionicons
          name={complete ? 'checkmark-circle' : 'ellipse-outline'}
          size={22}
          color={complete ? colors.success : colors.divider}
        />
        <Text style={styles.stepStatusText}>{complete ? t('step.completed') : t('step.notCompleted')}</Text>
      </View>
      <TouchableOpacity style={styles.stepPrimaryButton} onPress={onAction}>
        <Text style={styles.stepPrimaryButtonText}>{complete ? t('step.edit', { cta }) : cta}</Text>
      </TouchableOpacity>
    </View>
  );
};

type LinearNavProps = {
  isFirst: boolean;
  isLast: boolean;
  canAdvance: boolean;
  isPending: boolean;
  willQueue: boolean;
  onBack: () => void;
  onNext: () => void;
  onCompile: () => void;
};
const LinearNav = ({
  isFirst,
  isLast,
  canAdvance,
  isPending,
  willQueue,
  onBack,
  onNext,
  onCompile,
}: LinearNavProps) => {
  const { t } = useTranslation('detail');
  const nextDisabled = !canAdvance;
  const compileDisabled = !canAdvance || isPending;

  return (
    <View style={styles.stepNav}>
      <TouchableOpacity
        style={[styles.stepNavButton, isFirst && styles.stepNavButtonDisabled]}
        disabled={isFirst}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={t('step.previousAccessibility')}
      >
        <Ionicons name="arrow-back" size={20} color={colors.primary} />
        <Text style={styles.stepNavText}>{t('step.back')}</Text>
      </TouchableOpacity>
      {isLast ? (
        <TouchableOpacity
          style={[styles.stepNavButton, styles.stepNavButtonPrimary, compileDisabled && styles.stepNavButtonDisabled]}
          disabled={compileDisabled}
          onPress={onCompile}
          accessibilityRole="button"
        >
          <Text style={[styles.stepNavText, styles.stepNavTextPrimary]}>{getButtonLabel(isPending, willQueue, t)}</Text>
          {isPending && <ActivityIndicator size="small" color="white" />}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.stepNavButton, styles.stepNavButtonPrimary, nextDisabled && styles.stepNavButtonDisabled]}
          disabled={nextDisabled}
          onPress={onNext}
          accessibilityRole="button"
          accessibilityLabel={t('step.nextAccessibility')}
        >
          <Text style={[styles.stepNavText, styles.stepNavTextPrimary]}>{t('step.next')}</Text>
          <Ionicons name="arrow-forward" size={20} color="white" />
        </TouchableOpacity>
      )}
    </View>
  );
};

type LinearModeViewProps = {
  steps: LinearStep[];
  stepIndex: number;
  project: Project;
  mediaStepDone: boolean;
  isPending: boolean;
  willQueue: boolean;
  onStepAction: (step: LinearStep) => void;
  onBack: () => void;
  onNext: () => void;
  onCompile: () => void;
};
const LinearModeView = (p: LinearModeViewProps) => {
  if (p.steps.length === 0) return null;
  const step = p.steps[p.stepIndex];
  const complete = isLinearStepComplete(step, p.project, p.mediaStepDone);

  return (
    <>
      <LinearStepScreen
        step={step}
        index={p.stepIndex}
        total={p.steps.length}
        complete={complete}
        onAction={() => {
          p.onStepAction(step);
        }}
      />
      <LinearNav
        isFirst={p.stepIndex === 0}
        isLast={p.stepIndex === p.steps.length - 1}
        canAdvance={complete}
        isPending={p.isPending}
        willQueue={p.willQueue}
        onBack={p.onBack}
        onNext={p.onNext}
        onCompile={p.onCompile}
      />
    </>
  );
};

function firstIncompleteIndex(steps: LinearStep[], project: Project | null, mediaStepDone: boolean): number {
  if (!project) return 0;
  const idx = steps.findIndex((step) => !isLinearStepComplete(step, project, mediaStepDone));

  return idx === -1 ? Math.max(steps.length - 1, 0) : idx;
}

// Owns the cursor for linear mode. Clamps to the step range so re-entering the screen (e.g. after
// recording the last section, which router.replace-remounts this screen) never lands on a stale or
// out-of-bounds index. Initialises to the first incomplete step so the user resumes where work
// remains rather than at step 0.
function useLinearCursor(steps: LinearStep[], project: Project | null, mediaStepDone: boolean) {
  const [stepIndex, setStepIndex] = useState(() => firstIncompleteIndex(steps, project, mediaStepDone));
  const clamp = (i: number) => Math.min(Math.max(i, 0), Math.max(steps.length - 1, 0));

  return {
    stepIndex: clamp(stepIndex),
    goNext: () => {
      setStepIndex((i) => clamp(i + 1));
    },
    goBack: () => {
      setStepIndex((i) => clamp(i - 1));
    },
  };
}

const TemplateDetailScreen = () => {
  const { t } = useTranslation('detail');
  const params = useLocalSearchParams<{ id: string; projectId?: string }>();
  const {
    template,
    templateLoading,
    templateError,
    project,
    filteredSections,
    completedSectionsCount,
    allDone,
    orientation,
    description,
    activeFormSection,
    setActiveFormSection,
    activeMusicSection,
    setActiveMusicSection,
    hasMediaStep,
    mediaPickerVisible,
    setMediaPickerVisible,
    musicChoice,
    backgroundChoice,
    setMusicChoice,
    setBackgroundChoice,
    mediaStepDone,
    isPending,
    willQueue,
    wizardMode,
    setWizardMode,
    handleFormDataChange,
    handleFormSubmit,
    handlePreviewVideo,
    handleSectionPress,
    handleMusicSelect,
    handleMusicUseDefault,
    handleCompile,
    router,
  } = useTemplateDetail(params.id, params.projectId);

  const linearSteps = buildLinearSteps(filteredSections, hasMediaStep);
  const cursor = useLinearCursor(linearSteps, project, mediaStepDone);

  if (templateLoading) {
    return <LoadingState />;
  }

  const goBack = makeGoBack(router);

  if (templateError || !template || !project) {
    return <ErrorState error={templateError} onBack={goBack} />;
  }
  const isDisabled = isCompileDisabled(allDone, isPending);
  const { allowedMusic, allowUploadMusic, allowedBackgrounds, allowUploadBackground } = template.content.global ?? {};
  const { totalItems, totalDone } = computeProgress(
    filteredSections,
    completedSectionsCount,
    hasMediaStep,
    mediaStepDone
  );
  const openLinearStep = (step: LinearStep) => {
    if (step.kind === 'media') {
      setMediaPickerVisible(true);

      return;
    }
    handleSectionPress(step.section);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{template.name.replace('.json', '')}</Text>
      </View>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <OrientationRow orientation={orientation} />
        <Text style={styles.description}>{description}</Text>
        <ModeToggle mode={wizardMode} onChange={setWizardMode} />
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${(totalDone / totalItems) * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>{t('progress', { done: totalDone, total: totalItems })}</Text>
        {wizardMode === 'linear' ? (
          <LinearModeView
            steps={linearSteps}
            stepIndex={cursor.stepIndex}
            project={project}
            mediaStepDone={mediaStepDone}
            isPending={isPending}
            willQueue={willQueue}
            onStepAction={openLinearStep}
            onBack={cursor.goBack}
            onNext={cursor.goNext}
            onCompile={handleCompile}
          />
        ) : (
          <HubSectionList
            filteredSections={filteredSections}
            project={project}
            hasMediaStep={hasMediaStep}
            mediaStepDone={mediaStepDone}
            onSectionPress={handleSectionPress}
            onPreview={handlePreviewVideo}
            onMediaPress={() => {
              setMediaPickerVisible(true);
            }}
          />
        )}
      </ScrollView>
      {wizardMode === 'hub' && (
        <CompileFooter isDisabled={isDisabled} isPending={isPending} willQueue={willQueue} onCompile={handleCompile} />
      )}
      <FormModal
        section={activeFormSection}
        formData={project.formData}
        onFormDataChange={handleFormDataChange}
        onClose={() => {
          setActiveFormSection(null);
        }}
        onSubmit={handleFormSubmit}
      />
      <MusicModal
        section={activeMusicSection}
        allowedMusic={allowedMusic}
        selectedId={activeMusicSelection(project, activeMusicSection)}
        onSelect={handleMusicSelect}
        onClose={() => {
          setActiveMusicSection(null);
        }}
        onUseDefault={handleMusicUseDefault}
      />
      {hasMediaStep && (
        <UserMediaPicker
          visible={mediaPickerVisible}
          allowedMusic={allowedMusic}
          allowUploadMusic={allowUploadMusic}
          allowedBackgrounds={allowedBackgrounds}
          allowUploadBackground={allowUploadBackground}
          musicChoice={musicChoice}
          backgroundChoice={backgroundChoice}
          onMusicChange={setMusicChoice}
          onBackgroundChange={setBackgroundChoice}
          onClose={() => {
            setMediaPickerVisible(false);
          }}
        />
      )}
    </SafeAreaView>
  );
};

export default TemplateDetailScreen;
