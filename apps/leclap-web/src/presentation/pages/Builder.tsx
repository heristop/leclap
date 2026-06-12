import { useState, type Dispatch, type SetStateAction } from 'react';
import { FileUpload } from '@/presentation/components/FileUpload';
import { TemplateSelector } from '@/presentation/components/TemplateSelector';
import { TemplateForm } from '@/presentation/components/TemplateForm';
import { VideoProcessor } from '@/presentation/components/VideoProcessor';
import { ProgressDisplay } from '@/presentation/components/ProgressDisplay';
import { ExportPanel } from '@/presentation/components/ExportPanel';
import { BrowserCompatibility } from '@/presentation/components/BrowserCompatibility';
import { Seo } from '@/presentation/components/Seo';
import { Stepper } from '@/presentation/components/ui/Stepper';
import { VideoEditor } from '@/features/editor/VideoEditor';
import { useVideoProcessing, type ProcessedVideo, type MediaChoices } from '@/hooks/useVideoProcessing';
import { useFFmpeg } from '@/hooks/useFFmpeg';
import { type Template } from '@/services/templateService';
import { type VideoEdit } from '@/domain/valueObjects/videoEdits';
import { MediaPicker } from '@/presentation/components/admin/MediaPicker';
import type { MediaChoice } from '@/presentation/components/admin/templateEditorModel';
import { recordingConfigFromDescriptor } from '@/lib/recordingConfig';
import { ArrowRight, ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { Button, Card, Reveal } from '@/presentation/components/ui';
import { cn } from '@/lib/utils';

const STEPS = ['Template', 'Configure', 'Upload', 'Media', 'Edit', 'Process', 'Result'];

const StepTemplate = ({
  selectedTemplate,
  onTemplateSelected,
}: {
  selectedTemplate: Template | null;
  onTemplateSelected: (t: Template) => void;
}) => (
  <div className="space-y-8 fade-in">
    <div className="text-center mb-8">
      <h2 className="text-4xl font-bold font-display text-foreground mb-2">Choose Your Style</h2>
      <p className="text-gray-400 text-lg">Select a cinematic template to start creating</p>
    </div>
    <TemplateSelector onTemplateSelected={onTemplateSelected} selectedTemplate={selectedTemplate} />
  </div>
);

const StepConfigure = ({
  selectedTemplate,
  formData,
  onFormDataChange,
}: {
  selectedTemplate: Template;
  formData: Record<string, string>;
  onFormDataChange: (d: Record<string, string>) => void;
}) => (
  <div className="fade-in max-w-3xl mx-auto">
    <div className="text-center mb-8">
      <h2 className="text-4xl font-bold font-display text-foreground mb-2">Customize It</h2>
      <p className="text-gray-400 text-lg">Fill in the details for your video</p>
    </div>
    <Card elevation="flat" className="glass-panel-dark p-8 md:p-10 shadow-2xl">
      <TemplateForm template={selectedTemplate} onFormDataChange={onFormDataChange} formData={formData} />
    </Card>
  </div>
);

const StepUpload = ({
  selectedTemplate,
  uploadedFiles,
  onFilesUploaded,
}: {
  selectedTemplate: Template | null;
  uploadedFiles: File[];
  onFilesUploaded: (files: File[]) => void;
}) => {
  const recordingConfig = recordingConfigFromDescriptor(selectedTemplate?.descriptor);

  return (
    <div className="fade-in max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-4xl font-bold font-display text-foreground mb-2">Add Media</h2>
        <p className="text-gray-400 text-lg">Upload the videos you want to process</p>
      </div>
      <Card elevation="flat" className="glass-panel-dark p-8 md:p-10 shadow-2xl">
        <FileUpload
          onFilesUploaded={onFilesUploaded}
          uploadedFiles={uploadedFiles}
          countdownSeconds={recordingConfig.countdownSeconds}
          maxDurationSeconds={recordingConfig.maxDurationSeconds}
        />
      </Card>
    </div>
  );
};

const StepMedia = ({
  selectedTemplate,
  musicChoice,
  backgroundChoice,
  onMusicChange,
  onBackgroundChange,
}: {
  selectedTemplate: Template;
  musicChoice: MediaChoice | null;
  backgroundChoice: MediaChoice | null;
  onMusicChange: (c: MediaChoice | null) => void;
  onBackgroundChange: (c: MediaChoice | null) => void;
}) => {
  const g = selectedTemplate.descriptor.global ?? {};
  const showMusic = (g.allowedMusic?.length ?? 0) > 0 || Boolean(g.allowUploadMusic);
  const showBackground = (g.allowedBackgrounds?.length ?? 0) > 0 || Boolean(g.allowUploadBackground);

  return (
    <div className="fade-in max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-4xl font-bold font-display text-foreground mb-2">Music &amp; Background</h2>
        <p className="text-gray-400 text-lg">Choose the soundtrack and backdrop for your video</p>
      </div>
      <div className="space-y-8">
        {showMusic && (
          <Card elevation="flat" className="glass-panel-dark p-6 md:p-8 shadow-2xl">
            <h3 className="text-lg font-semibold mb-4 font-display text-foreground">Music</h3>
            <MediaPicker
              kind="music"
              value={musicChoice}
              onChange={onMusicChange}
              allowedIds={g.allowedMusic}
              allowUpload={Boolean(g.allowUploadMusic)}
            />
          </Card>
        )}
        {showBackground && (
          <Card elevation="flat" className="glass-panel-dark p-6 md:p-8 shadow-2xl">
            <h3 className="text-lg font-semibold mb-4 font-display text-foreground">Background Image</h3>
            <MediaPicker
              kind="picture"
              value={backgroundChoice}
              onChange={onBackgroundChange}
              allowedIds={g.allowedBackgrounds}
              allowUpload={Boolean(g.allowUploadBackground)}
            />
          </Card>
        )}
      </div>
    </div>
  );
};

const StepEdit = ({
  uploadedFiles,
  videoEdits,
  onEditChange,
}: {
  uploadedFiles: File[];
  videoEdits: Record<number, VideoEdit | undefined>;
  onEditChange: (index: number, edit: VideoEdit | undefined) => void;
}) => (
  <div className="fade-in max-w-3xl mx-auto">
    <div className="text-center mb-8">
      <h2 className="text-4xl font-bold font-display text-foreground mb-2">Trim &amp; Crop</h2>
      <p className="text-gray-400 text-lg">Fine-tune each clip — or skip to keep them as-is</p>
    </div>
    <div className="space-y-6">
      {uploadedFiles.map((file, index) => (
        <VideoEditor
          key={`${file.name}-${index}`}
          file={file}
          label={uploadedFiles.length > 1 ? `Clip ${index + 1} — ${file.name}` : file.name}
          edit={videoEdits[index]}
          onChange={(edit) => {
            onEditChange(index, edit);
          }}
        />
      ))}
    </div>
  </div>
);

interface StepProcessProps {
  selectedTemplate: Template | null;
  uploadedFiles: File[];
  formData: Record<string, string>;
  isFFmpegReady: boolean;
  isProcessing: boolean;
  canProcess: boolean;
  progress: ReturnType<typeof useVideoProcessing>['progress'];
  error: string | null;
  onStartProcessing: () => void;
}

const StepProcess = ({
  selectedTemplate,
  uploadedFiles,
  formData,
  isFFmpegReady,
  isProcessing,
  canProcess,
  progress,
  error,
  onStartProcessing,
}: StepProcessProps) => (
  <div className="fade-in max-w-5xl mx-auto">
    <div className="text-center mb-12">
      <h2 className="text-4xl font-bold font-display text-foreground mb-2">Create Video</h2>
      <p className="text-gray-400 text-lg">We're ready to build your masterpiece</p>
    </div>
    <div className="grid md:grid-cols-2 gap-8">
      <Card elevation="flat" className="glass-panel-dark p-8 shadow-2xl h-full">
        <h3 className="text-xl font-semibold mb-6 font-display text-brand-700 dark:text-brand-300 flex items-center">
          <Sparkles className="w-5 h-5 mr-2" />
          Project Summary
        </h3>
        <ul className="space-y-4 text-gray-300">
          <li className="flex justify-between items-center gap-3 p-3 bg-foreground/5 rounded-xl border border-foreground/5">
            <span className="text-gray-400">Template</span>
            <span className="font-medium text-foreground truncate">{selectedTemplate?.name}</span>
          </li>
          {uploadedFiles.length > 0 && (
            <li className="flex justify-between items-center gap-3 p-3 bg-foreground/5 rounded-xl border border-foreground/5">
              <span className="text-gray-400">Files</span>
              <span className="font-medium text-foreground">{uploadedFiles.length} video(s)</span>
            </li>
          )}
          <li className="flex justify-between items-center gap-3 p-3 bg-foreground/5 rounded-xl border border-foreground/5">
            <span className="text-gray-400">Engine Status</span>
            <span
              className={cn(
                'font-medium flex items-center',
                isFFmpegReady ? 'text-success-foreground' : 'text-warning'
              )}
            >
              {isFFmpegReady ? (
                <>
                  Ready <span className="ml-2 w-2 h-2 bg-success rounded-full animate-pulse" />
                </>
              ) : (
                <>
                  Initializing... <Loader2 className="ml-2 w-3 h-3 animate-spin" />
                </>
              )}
            </span>
          </li>
        </ul>
      </Card>
      <Card elevation="flat" className="glass-panel-dark p-8 shadow-2xl flex flex-col justify-center h-full">
        <VideoProcessor
          isProcessing={isProcessing}
          canProcess={canProcess}
          onStartProcessing={onStartProcessing}
          error={error}
          template={selectedTemplate}
          formData={formData}
          uploadedFiles={uploadedFiles}
        />
      </Card>
    </div>
    {isProcessing && (
      <Card
        elevation="flat"
        className="mt-8 glass-panel-dark p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500"
      >
        <h3 className="text-xl font-semibold mb-4 font-display text-foreground">Processing Progress</h3>
        <ProgressDisplay progress={progress} />
      </Card>
    )}
  </div>
);

const StepResult = ({
  processedVideo,
  onBack,
  onReset,
}: {
  processedVideo: ProcessedVideo;
  onBack: () => void;
  onReset: () => void;
}) => (
  <div className="fade-in text-center max-w-4xl mx-auto">
    <div className="mb-12">
      <h2 className="text-5xl font-bold font-display brand-gradient-text mb-4">Your Video is Ready!</h2>
      <p className="text-gray-300 text-lg">Download and share your creation</p>
    </div>
    <Reveal>
      <Card elevation="flat" className="glass-panel-dark p-8 md:p-12 shadow-2xl">
        <ExportPanel processedVideo={processedVideo} />
        <div className="mt-8 flex flex-col-reverse sm:flex-row justify-between items-center gap-4">
          <Button
            variant="ghost"
            onClick={onBack}
            className="group w-full sm:w-auto px-6 py-3 rounded-full bg-foreground/5 hover:bg-foreground/10"
          >
            <ArrowLeft className="transition-transform duration-300 group-hover:-translate-x-1" />
            <span>Back</span>
          </Button>
          <Button variant="link" onClick={onReset} className="group w-full sm:w-auto px-6 py-3">
            <span>Create Another Video</span>
            <ArrowRight className="transition-transform duration-300 group-hover:translate-x-1" />
          </Button>
        </div>
      </Card>
    </Reveal>
  </div>
);

interface NavButtonsProps {
  currentStep: number;
  selectedTemplate: Template | null;
  uploadedFiles: File[];
  isFormComplete: boolean;
  onPrev: () => void;
  onNext: () => void;
}

const NavButtons = ({
  currentStep,
  selectedTemplate,
  uploadedFiles,
  isFormComplete,
  onPrev,
  onNext,
}: NavButtonsProps) => {
  const isNextDisabled =
    (currentStep === 0 && !selectedTemplate) ||
    (currentStep === 1 && !isFormComplete) ||
    (currentStep === 2 && uploadedFiles.length === 0);

  return (
    <div className="flex justify-between mt-16 pt-8 border-t border-foreground/10">
      <Button
        variant="ghost"
        onClick={onPrev}
        disabled={currentStep === 0 || currentStep === 6}
        className="group px-6 py-3"
      >
        <ArrowLeft className="transition-transform duration-300 group-hover:-translate-x-1" />
        Back
      </Button>
      {currentStep < 5 && (
        <Button
          variant="primary"
          onClick={onNext}
          disabled={isNextDisabled}
          className="group px-8 py-3 active:translate-y-0 active:scale-[0.98]"
        >
          Next
          <ArrowRight className="transition-transform duration-300 group-hover:translate-x-1" />
        </Button>
      )}
    </div>
  );
};

const checkFormComplete = (selectedTemplate: Template | null, formData: Record<string, string>): boolean => {
  if (!selectedTemplate) return false;
  const sections: Array<{ type: string; options?: { fields?: Array<{ name: string }> } }> = Array.isArray(
    selectedTemplate.descriptor.sections
  )
    ? selectedTemplate.descriptor.sections
    : [];
  const fields = sections.filter((s) => s.type === 'form').flatMap((s) => s.options?.fields ?? []);

  if (fields.length === 0) return true;

  return fields.every((field) => (formData[field.name] ?? '').trim() !== '');
};

const FORM_STEP = 1;
const UPLOAD_STEP = 2;
const MEDIA_STEP = 3;
const EDIT_STEP = 4;
const PROCESS_STEP = 5;
const RESULT_STEP = 6;

// Whether the template defines any form fields — drives skipping the Configure step.
const templateHasFormFields = (selectedTemplate: Template | null): boolean => {
  if (!selectedTemplate) return false;
  const sections: Array<{ type: string; options?: { fields?: Array<{ name: string }> } }> = Array.isArray(
    selectedTemplate.descriptor.sections
  )
    ? selectedTemplate.descriptor.sections
    : [];

  return sections.filter((s) => s.type === 'form').flatMap((s) => s.options?.fields ?? []).length > 0;
};

// Whether the template needs the user to supply a clip — drives skipping the Upload step.
// Only `project_video` sections consume an uploaded/recorded clip; color/text/image-only
// templates (the premium pack) render with no upload at all.
const templateNeedsUploadStep = (selectedTemplate: Template | null): boolean => {
  if (!selectedTemplate) return false;
  const sections: Array<{ type: string }> = Array.isArray(selectedTemplate.descriptor.sections)
    ? selectedTemplate.descriptor.sections
    : [];

  return sections.some((s) => s.type === 'project_video');
};

// The absolute step indices a template actually walks through, in order. Steps the template
// doesn't need (form/upload/media/edit) are dropped so the stepper shows only the real journey —
// a premium color card is just Template → Process → Result. Before a template is picked we show
// the full sequence so the first-load stepper isn't misleadingly sparse.
const visibleStepIndices = (
  hasTemplate: boolean,
  hasForm: boolean,
  hasUpload: boolean,
  hasMediaStep: boolean
): number[] => {
  if (!hasTemplate) return STEPS.map((_step, index) => index);

  const indices = [0];

  if (hasForm) indices.push(FORM_STEP);

  if (hasUpload) indices.push(UPLOAD_STEP);

  if (hasMediaStep) indices.push(MEDIA_STEP);

  if (hasUpload) indices.push(EDIT_STEP);

  indices.push(PROCESS_STEP, RESULT_STEP);

  return indices;
};

// The step to return to from the Result screen — the first input step the template actually uses,
// falling back to Process when it collects no input at all (e.g. the premium color cards).
const resumeStepFromResult = (hasForm: boolean, hasUpload: boolean): number => {
  if (hasForm) return FORM_STEP;

  if (hasUpload) return UPLOAD_STEP;

  return PROCESS_STEP;
};

// Whether the template requires a Media selection step.
const templateNeedsMediaStep = (selectedTemplate: Template | null): boolean => {
  if (!selectedTemplate) return false;
  const g = selectedTemplate.descriptor.global ?? {};

  return (
    (g.allowedMusic?.length ?? 0) > 0 ||
    Boolean(g.allowUploadMusic) ||
    (g.allowedBackgrounds?.length ?? 0) > 0 ||
    Boolean(g.allowUploadBackground)
  );
};

interface StepContentProps {
  currentStep: number;
  selectedTemplate: Template | null;
  uploadedFiles: File[];
  formData: Record<string, string>;
  videoEdits: Record<number, VideoEdit | undefined>;
  musicChoice: MediaChoice | null;
  backgroundChoice: MediaChoice | null;
  isFFmpegReady: boolean;
  isProcessing: boolean;
  canProcess: boolean;
  progress: ReturnType<typeof useVideoProcessing>['progress'];
  error: string | null;
  processedVideo: ProcessedVideo | null;
  onTemplateSelected: (t: Template) => void;
  onFormDataChange: (d: Record<string, string>) => void;
  onFilesUploaded: (files: File[]) => void;
  onMusicChange: (c: MediaChoice | null) => void;
  onBackgroundChange: (c: MediaChoice | null) => void;
  onEditChange: (index: number, edit: VideoEdit | undefined) => void;
  onStartProcessing: () => void;
  onBack: () => void;
  onReset: () => void;
}

const StepContent = ({
  currentStep,
  selectedTemplate,
  uploadedFiles,
  formData,
  videoEdits,
  musicChoice,
  backgroundChoice,
  isFFmpegReady,
  isProcessing,
  canProcess,
  progress,
  error,
  processedVideo,
  onTemplateSelected,
  onFormDataChange,
  onFilesUploaded,
  onMusicChange,
  onBackgroundChange,
  onEditChange,
  onStartProcessing,
  onBack,
  onReset,
}: StepContentProps) => {
  if (currentStep === 0) {
    return <StepTemplate selectedTemplate={selectedTemplate} onTemplateSelected={onTemplateSelected} />;
  }

  if (currentStep === 1 && selectedTemplate) {
    return (
      <StepConfigure selectedTemplate={selectedTemplate} formData={formData} onFormDataChange={onFormDataChange} />
    );
  }

  if (currentStep === 2) {
    return (
      <StepUpload selectedTemplate={selectedTemplate} uploadedFiles={uploadedFiles} onFilesUploaded={onFilesUploaded} />
    );
  }

  if (currentStep === 3 && selectedTemplate) {
    return (
      <StepMedia
        selectedTemplate={selectedTemplate}
        musicChoice={musicChoice}
        backgroundChoice={backgroundChoice}
        onMusicChange={onMusicChange}
        onBackgroundChange={onBackgroundChange}
      />
    );
  }

  if (currentStep === 4) {
    return <StepEdit uploadedFiles={uploadedFiles} videoEdits={videoEdits} onEditChange={onEditChange} />;
  }

  if (currentStep === 5) {
    return (
      <StepProcess
        selectedTemplate={selectedTemplate}
        uploadedFiles={uploadedFiles}
        formData={formData}
        isFFmpegReady={isFFmpegReady}
        isProcessing={isProcessing}
        canProcess={canProcess}
        progress={progress}
        error={error}
        onStartProcessing={onStartProcessing}
      />
    );
  }

  if (currentStep === 6 && processedVideo) {
    return <StepResult processedVideo={processedVideo} onBack={onBack} onReset={onReset} />;
  }

  return null;
};

const makeStepNav = (
  setCurrentStep: Dispatch<SetStateAction<number>>,
  hasForm: boolean,
  hasUpload: boolean,
  hasMediaStep: boolean
) => ({
  nextStep: () => {
    setCurrentStep((prev) => {
      let next = prev + 1;

      if (next === FORM_STEP && !hasForm) next += 1;

      if (next === UPLOAD_STEP && !hasUpload) next += 1;

      if (next === MEDIA_STEP && !hasMediaStep) next += 1;

      if (next === EDIT_STEP && !hasUpload) next += 1;

      return Math.min(next, STEPS.length - 1);
    });
  },
  prevStep: () => {
    setCurrentStep((prev) => {
      let back = prev - 1;

      if (back === EDIT_STEP && !hasUpload) back -= 1;

      if (back === MEDIA_STEP && !hasMediaStep) back -= 1;

      if (back === UPLOAD_STEP && !hasUpload) back -= 1;

      if (back === FORM_STEP && !hasForm) back -= 1;

      return Math.max(back, 0);
    });
  },
});

export const Builder = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [videoEdits, setVideoEdits] = useState<Record<number, VideoEdit | undefined>>({});
  const [musicChoice, setMusicChoice] = useState<MediaChoice | null>(null);
  const [backgroundChoice, setBackgroundChoice] = useState<MediaChoice | null>(null);
  const { isProcessing, progress, processedVideo, error, processVideo, isFFmpegReady } = useVideoProcessing();
  const { loadingProgress } = useFFmpeg();

  const handleTemplateSelected = (template: Template) => {
    setSelectedTemplate(template);
    setFormData({});
    setMusicChoice(null);
    setBackgroundChoice(null);
  };
  // Re-uploading changes the clip set, so clear edits (they are keyed by file index).
  const handleFilesUploaded = (files: File[]) => {
    setUploadedFiles(files);
    setVideoEdits({});
  };
  const handleEditChange = (index: number, edit: VideoEdit | undefined) => {
    setVideoEdits((prev) => ({ ...prev, [index]: edit }));
  };
  const handleStartProcessingSync = () => {
    if (!selectedTemplate || (templateNeedsUploadStep(selectedTemplate) && uploadedFiles.length === 0)) return;
    const mediaChoices: MediaChoices = { music: musicChoice, background: backgroundChoice };
    processVideo(uploadedFiles, { ...selectedTemplate, formData }, videoEdits, mediaChoices).then(
      () => {
        if (!error) setCurrentStep(6);
      },
      (error_: unknown) => {
        console.error('Processing error', error_);
      }
    );
  };

  const isFormComplete = checkFormComplete(selectedTemplate, formData);
  const [hasForm, hasUpload, hasMediaStep] = [
    templateHasFormFields(selectedTemplate),
    templateNeedsUploadStep(selectedTemplate),
    templateNeedsMediaStep(selectedTemplate),
  ];
  const canProcess =
    Boolean(selectedTemplate) && (!hasUpload || uploadedFiles.length > 0) && isFFmpegReady && isFormComplete;
  const { nextStep, prevStep } = makeStepNav(setCurrentStep, hasForm, hasUpload, hasMediaStep);
  const visibleSteps = visibleStepIndices(Boolean(selectedTemplate), hasForm, hasUpload, hasMediaStep);

  const handleReset = () => {
    setCurrentStep(0);
    setUploadedFiles([]);
    setFormData({});
    setSelectedTemplate(null);
    setVideoEdits({});
    setMusicChoice(null);
    setBackgroundChoice(null);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background text-foreground relative overflow-hidden">
      <h1 className="sr-only">Video Builder — create videos from templates</h1>
      <Seo
        title="Video Builder"
        description="Pick a template and compose your video entirely in the browser — trim, crop, add music and export with WebAssembly FFmpeg. No uploads, no servers."
        path="/builder"
      />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-500/15 rounded-full blur-[120px] animate-float" />
        <div
          className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary-400/10 rounded-full blur-[120px] animate-float"
          style={{ animationDelay: '-3s' }}
        />
      </div>
      <div className="mx-auto w-full max-w-6xl px-4 pt-24 pb-24 relative z-10">
        <BrowserCompatibility />
        <div className="max-w-4xl mx-auto mb-12">
          <Stepper
            steps={visibleSteps.map((index) => STEPS[index])}
            currentStep={Math.max(0, visibleSteps.indexOf(currentStep))}
            onStepClick={(visibleIndex) => {
              setCurrentStep(visibleSteps[visibleIndex]);
            }}
          />
        </div>
        <div className="max-w-6xl mx-auto">
          <StepContent
            currentStep={currentStep}
            selectedTemplate={selectedTemplate}
            uploadedFiles={uploadedFiles}
            formData={formData}
            videoEdits={videoEdits}
            musicChoice={musicChoice}
            backgroundChoice={backgroundChoice}
            isFFmpegReady={isFFmpegReady}
            isProcessing={isProcessing}
            canProcess={canProcess}
            progress={progress}
            error={error}
            processedVideo={processedVideo}
            onTemplateSelected={handleTemplateSelected}
            onFormDataChange={setFormData}
            onFilesUploaded={handleFilesUploaded}
            onMusicChange={setMusicChoice}
            onBackgroundChange={setBackgroundChoice}
            onEditChange={handleEditChange}
            onStartProcessing={handleStartProcessingSync}
            onBack={() => {
              setCurrentStep(resumeStepFromResult(hasForm, hasUpload));
            }}
            onReset={handleReset}
          />
          <NavButtons
            currentStep={currentStep}
            selectedTemplate={selectedTemplate}
            uploadedFiles={uploadedFiles}
            isFormComplete={isFormComplete}
            onPrev={prevStep}
            onNext={nextStep}
          />
        </div>
        {currentStep === 0 && selectedTemplate && (
          <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4 pointer-events-none">
            <Card
              elevation="flat"
              className="slide-up pointer-events-auto flex items-center gap-3 rounded-full bg-surface/90 backdrop-blur-md py-2 pl-5 pr-2 shadow-xl shadow-brand-500/10"
            >
              <span className="hidden sm:inline text-sm text-gray-400">Template</span>
              <span className="max-w-[10rem] truncate text-sm font-semibold text-foreground">
                {selectedTemplate.name}
              </span>
              <Button
                variant="primary"
                size="sm"
                onClick={nextStep}
                className="group rounded-full px-5 py-2.5 shadow-brand-500/25 [&_svg]:size-4"
              >
                Continue <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Card>
          </div>
        )}
        {!isFFmpegReady && (
          <Card
            elevation="flat"
            className="fixed bottom-6 right-6 max-w-sm glass-panel-dark rounded-xl shadow-2xl p-4 border-warning/20 z-50 fade-in"
          >
            <div className="flex items-center space-x-3 mb-2">
              <Loader2 className="w-5 h-5 text-warning animate-spin" />
              <span className="font-semibold text-warning">Loading Engine</span>
              <span className="ml-auto font-bold text-warning">{Math.round(loadingProgress)}%</span>
            </div>
            <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden">
              <div className="h-full bg-warning transition-all duration-300" style={{ width: `${loadingProgress}%` }} />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
