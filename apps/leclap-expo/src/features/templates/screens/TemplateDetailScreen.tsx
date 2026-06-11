import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal } from 'react-native';
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
import { useCompileMode } from '@/src/stores/useSettingsStore';
import { UserMediaPicker } from '@/src/features/templates/components/UserMediaPicker';
import { needsMediaStep } from '@/src/services/media/mediaStepHelpers';

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

function compileTemplate(content: Template['content'], formData: Project['formData']): Record<string, unknown> {
  let str = JSON.stringify(JSON.parse(JSON.stringify(content)) as unknown);

  for (const [key, value] of Object.entries(formData)) {
    str = str.replace(new RegExp(`{{ ${key} }}`.replace(/[-\\^$*+?.()|[\]{}]/g, String.raw`\$&`), 'g'), String(value));
  }

  return JSON.parse(str) as Record<string, unknown>;
}

function getButtonLabel(isPending: boolean, willQueue: boolean): string {
  if (!isPending) return 'Create My Video';

  return willQueue ? 'Adding to Queue...' : 'Creating Video...';
}

type FormModalProps = {
  section: Section | null;
  formData: Project['formData'];
  onFormDataChange: (f: string, v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};
const FormModal = ({ section, formData, onFormDataChange, onClose, onSubmit }: FormModalProps) => {
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
            <Text style={styles.formSubmitButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

type MusicModalProps = { section: Section | null; onClose: () => void; onUseDefault: () => void };
const MusicModal = ({ section, onClose, onUseDefault }: MusicModalProps) => {
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
        <View style={styles.placeholderContainer}>
          <Ionicons name="musical-notes" size={48} color={colors.primary} />
          <Text style={styles.placeholderText}>Music selection coming soon</Text>
          <TouchableOpacity style={styles.tempCompleteButton} onPress={onUseDefault}>
            <Text style={styles.tempCompleteButtonText}>Use Default Music</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

type SectionItemProps = { section: Section; project: Project; onPress: () => void; onPreview: () => void };
const SectionItem = ({ section, project, onPress, onPreview }: SectionItemProps) => {
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
            <Text style={styles.previewButtonText}>Preview</Text>
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

    Alert.alert('Incomplete Form', 'Please fill out all required fields');
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
    Alert.alert('Error', 'Could not preview video.');
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

    Alert.alert('Unsupported', 'This section type is not yet editable.');
  };
  const handleMusicUseDefault = () => {
    if (project && activeMusicSection) {
      const updated = {
        ...project,
        formData: { ...project.formData, [`music_${activeMusicSection.name}`]: 'default' },
        updatedAt: new Date().toISOString(),
      };
      setProject(updated);
      saveProjectMutation.mutate(updated);
    }
    setActiveMusicSection(null);
  };

  return { handleFormDataChange, handleFormSubmit, handlePreviewVideo, handleSectionPress, handleMusicUseDefault };
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
            const title = 'Added to Queue';
            const msg = 'The server is unreachable right now — your video will render automatically once it’s back.';

            Alert.alert(title, msg, [
              {
                text: 'OK',
                onPress: () => {
                  router.back();
                },
              },
            ]);

            return;
          }
          Alert.alert('Compilation Failed', result.result?.error ?? 'An error occurred during video compilation.');
        },
        onError: (error: unknown) => {
          console.error('Error during compilation:', error);
          Alert.alert(
            'Compilation Error',
            `An unexpected error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`
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
  filteredSections: Section[],
  hasMediaStep: boolean,
  mediaStepDone: boolean
): boolean {
  if (project === null || filteredSections.length === 0) return false;

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
  const router = useRouter();
  const { data: template, isLoading: templateLoading, error: templateError } = useTemplate(templateName);
  const { data: existingProject, isLoading: projectLoading } = useProject(projectId ?? '');
  const saveProjectMutation = useSaveProject();
  const queueVideoCompilation = useQueueVideoCompilation();
  const { isOffline } = useOffline();
  const mode = useCompileMode();
  // A job is only queued in Cloud mode when the server can't be reached. Local always renders now,
  // so the button must never say "Adding to Queue…" on-device.
  const willQueue = mode === 'server' && isOffline;
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
  const setProjectSafe = (p: Project) => {
    setProject(p);
  };

  useProjectInitialization({
    template,
    existingProject,
    projectLoading,
    projectId,
    saveProjectMutation,
    setProject: setProjectSafe,
  });
  const { filtered: filteredSections, completed: completedSectionsCount } = getSectionInfo(template, project);
  const hasMediaStep = needsMediaStep(template?.content.global);
  const hCtx: HandlerCtx = {
    project,
    template,
    activeFormSection,
    activeMusicSection,
    setProject: setProjectSafe,
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
    handleMusicUseDefault,
    handleCompile,
  } = useTemplateHandlers({ ...hCtx, mediaChoices, queueVideoCompilation });
  const allDone = computeAllDone(project, filteredSections, hasMediaStep, mediaStepDone);

  return {
    template,
    templateLoading,
    templateError,
    project,
    filteredSections,
    completedSectionsCount,
    allDone,
    orientation: template?.content.global?.orientation ?? 'portrait',
    description:
      template?.content.sections?.find((s) => s.description?.en)?.description?.en ??
      'Create a video using this template',
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
    willQueue,
    handleFormDataChange,
    handleFormSubmit,
    handlePreviewVideo,
    handleSectionPress,
    handleMusicUseDefault,
    handleCompile,
    router,
  };
}

const LoadingState = () => (
  <View style={styles.centerContainer}>
    <ActivityIndicator size="large" color={colors.primary} />
    <Text style={styles.loadingText}>Loading template...</Text>
  </View>
);

type ErrorStateProps = { error: unknown; onBack: () => void };
const ErrorState = ({ error, onBack }: ErrorStateProps) => (
  <View style={styles.centerContainer}>
    <Text style={styles.errorText}>{error instanceof Error ? error.message : 'Template or Project not found'}</Text>
    <TouchableOpacity style={styles.backButton} onPress={onBack}>
      <Text style={styles.backButtonText}>Back to Templates</Text>
    </TouchableOpacity>
  </View>
);

type OrientationRowProps = { orientation: string };
const OrientationRow = ({ orientation }: OrientationRowProps) => {
  const isPortrait = orientation === 'portrait';
  const icon: keyof typeof Ionicons.glyphMap = isPortrait ? 'phone-portrait-outline' : 'phone-landscape-outline';

  return (
    <View style={styles.orientationRow}>
      <Ionicons name={icon} size={24} color={colors.text} />
      <Text style={styles.orientationText}>{isPortrait ? 'Portrait' : 'Landscape'} orientation</Text>
    </View>
  );
};

type MediaStepRowProps = { done: boolean; onPress: () => void };
const MediaStepRow = ({ done, onPress }: MediaStepRowProps) => (
  <TouchableOpacity
    style={styles.sectionItem}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel="Music and background selection"
  >
    <View style={styles.sectionItemContent}>
      <View style={styles.sectionTypeIcon}>
        <Ionicons name="musical-notes" size={24} color={colors.primary} />
      </View>
      <View style={styles.sectionItemText}>
        <Text style={styles.sectionItemTitle}>Music &amp; Background</Text>
        <Text style={styles.sectionItemDescription} numberOfLines={1}>
          {done ? 'Selection saved' : 'Choose soundtrack and backdrop'}
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

const TemplateDetailScreen = () => {
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
    handleFormDataChange,
    handleFormSubmit,
    handlePreviewVideo,
    handleSectionPress,
    handleMusicUseDefault,
    handleCompile,
    router,
  } = useTemplateDetail(params.id, params.projectId);

  if (templateLoading) {
    return <LoadingState />;
  }

  // Template detail is a root-stack screen reached by push (from the lists) or replace (after
  // recording the last section / finishing the preview). A replace-entry can have an empty back
  // stack, so fall back to the tabs rather than letting router.back() throw "GO_BACK not handled".
  const goBack = () => {
    if (router.canGoBack()) {
      router.back();

      return;
    }

    router.replace('/(app)');
  };

  if (templateError || !template || !project) {
    return <ErrorState error={templateError} onBack={goBack} />;
  }
  const isDisabled = !allDone || isPending;
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
        <Text style={styles.progressText}>
          {totalDone} of {totalItems} sections completed
        </Text>
        <Text style={styles.sectionTitle}>Sections</Text>
        {filteredSections.map((section) => (
          <SectionItem
            key={section.name}
            section={section}
            project={project}
            onPress={() => {
              handleSectionPress(section);
            }}
            onPreview={() => {
              handlePreviewVideo(section);
            }}
          />
        ))}
        {hasMediaStep && (
          <MediaStepRow
            done={mediaStepDone}
            onPress={() => {
              setMediaPickerVisible(true);
            }}
          />
        )}
      </ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.createButton, isDisabled && styles.disabledButton]}
          disabled={isDisabled}
          onPress={handleCompile}
        >
          <Text style={styles.createButtonText}>{getButtonLabel(isPending, willQueue)}</Text>
          {isPending && <ActivityIndicator size="small" color="white" style={styles.loader} />}
        </TouchableOpacity>
      </View>
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
        onClose={() => {
          setActiveMusicSection(null);
        }}
        onUseDefault={handleMusicUseDefault}
      />
      {hasMediaStep && (
        <UserMediaPicker
          visible={mediaPickerVisible}
          allowedMusic={template.content.global?.allowedMusic}
          allowUploadMusic={template.content.global?.allowUploadMusic}
          allowedBackgrounds={template.content.global?.allowedBackgrounds}
          allowUploadBackground={template.content.global?.allowUploadBackground}
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
