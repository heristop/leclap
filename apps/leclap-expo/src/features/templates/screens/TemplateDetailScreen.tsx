import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import FormSection from '@/src/features/editor/components/FormSection';
import type { Template, Section, Project, MediaChoice, MediaChoices } from '@/src/types';
import { buildDescriptionVars, resolveTranslation, resolveVariables } from '@/src/utils/i18nText';
import { colors } from '@/src/styles/theme';
import { styles } from './TemplateDetailScreen.styles';
import { useTemplate } from '@/src/hooks/useTemplates';
import { useProject, useSaveProject } from '@/src/hooks/useProjects';
import { useQueueVideoCompilation } from '@/src/hooks/useCompilationQueue';
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

// The header blurb is the first section's description — interpolate its `{{ tokens }}` against the
// template's variable defaults + the user's answers so it reads with real values (web parity).
function buildHeaderDescription(
  template: Template | undefined,
  project: Project | null,
  t: TFunction<'detail'>
): string {
  const raw = template?.content.sections?.find((s) => s.description?.en)?.description?.en;

  if (!template || !raw) return t('defaultDescription');

  const vars = buildDescriptionVars(
    template.content.global?.variables,
    template.content.global?.colorsList,
    project?.formData
  );

  return resolveVariables(raw, vars);
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

type SectionItemProps = {
  section: Section;
  project: Project;
  vars: Record<string, string | string[]>;
  onPress: () => void;
  onPreview: () => void;
};
const SectionItem = ({ section, project, vars, onPress, onPreview }: SectionItemProps) => {
  const { t, i18n } = useTranslation('detail');
  const completed = isSectionCompleted(section, project);
  // Interpolate `{{ token }}` placeholders against the template's variables + the user's answers, so
  // the row reads "Tea or Coffee?" rather than the raw "{{ optionA1 }} or {{ optionB1 }}?" (web parity).
  const title = resolveVariables(resolveTranslation(section.title, i18n.language) ?? section.name, vars);
  const descriptionText = resolveTranslation(section.description, i18n.language);
  const description = descriptionText ? resolveVariables(descriptionText, vars) : '';

  return (
    <TouchableOpacity style={styles.sectionItem} onPress={onPress}>
      <View style={styles.sectionItemContent}>
        <View style={styles.sectionTypeIcon}>
          <Ionicons name={getSectionIcon(section)} size={24} color={colors.primary} />
        </View>
        <View style={styles.sectionItemText}>
          <Text style={styles.sectionItemTitle}>{title}</Text>
          {description ? (
            <Text style={styles.sectionItemDescription} numberOfLines={1}>
              {description}
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
          if (result.immediate && result.result.success) {
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
            result.result.error ?? t('alerts.compilationFailed.fallback')
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
  // The app is fully local — compilation always renders on-device now, never queued.
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
  // A projectId was passed but its query finished with no such project — a genuine not-found (e.g. a
  // deleted/stale link). Distinct from `project` simply not being initialized yet (no projectId →
  // a draft is always created), which must read as "loading", not "not found".
  const projectMissing = projectId !== undefined && !projectLoading && !existingProject;
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

  const description = buildHeaderDescription(template, project, t);

  return {
    template,
    templateLoading,
    templateError,
    projectMissing,
    project,
    filteredSections,
    completedSectionsCount,
    allDone,
    orientation: template?.content.global?.orientation ?? 'portrait',
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
    isPending: queueVideoCompilation.isPending,
    willQueue: false,
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
  vars: Record<string, string | string[]>;
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
          vars={p.vars}
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

const TemplateDetailScreen = () => {
  const { t } = useTranslation('detail');
  const params = useLocalSearchParams<{ id: string; projectId?: string }>();
  const {
    template,
    templateLoading,
    templateError,
    projectMissing,
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
    handleFormDataChange,
    handleFormSubmit,
    handlePreviewVideo,
    handleSectionPress,
    handleMusicSelect,
    handleMusicUseDefault,
    handleCompile,
    router,
  } = useTemplateDetail(params.id, params.projectId);

  if (templateLoading) {
    return <LoadingState />;
  }

  const goBack = makeGoBack(router);

  // Genuine failure: the template query errored / finished with no such template, or a projectId was
  // passed that resolves to no project (deleted/stale link).
  if (templateError || !template || projectMissing) {
    return <ErrorState error={templateError} onBack={goBack} />;
  }

  // Template is loaded but `project` (local state) is still being set by useProjectInitialization's
  // effect — show the loader instead of flashing "not found" for that one render.
  if (!project) {
    return <LoadingState />;
  }
  const isDisabled = isCompileDisabled(allDone, isPending);
  const { allowedMusic, allowUploadMusic, allowedBackgrounds, allowUploadBackground } = template.content.global ?? {};
  const { totalItems, totalDone } = computeProgress(
    filteredSections,
    completedSectionsCount,
    hasMediaStep,
    mediaStepDone
  );

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
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${(totalDone / totalItems) * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>{t('progress', { done: totalDone, total: totalItems })}</Text>
        <HubSectionList
          filteredSections={filteredSections}
          project={project}
          vars={buildDescriptionVars(
            template.content.global?.variables,
            template.content.global?.colorsList,
            project.formData
          )}
          hasMediaStep={hasMediaStep}
          mediaStepDone={mediaStepDone}
          onSectionPress={handleSectionPress}
          onPreview={handlePreviewVideo}
          onMediaPress={() => {
            setMediaPickerVisible(true);
          }}
        />
      </ScrollView>
      <CompileFooter isDisabled={isDisabled} isPending={isPending} willQueue={willQueue} onCompile={handleCompile} />
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
