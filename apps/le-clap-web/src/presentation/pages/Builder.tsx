import { useState } from 'react'
import { FileUpload } from '@/presentation/components/FileUpload'
import { TemplateSelector } from '@/presentation/components/TemplateSelector'
import { TemplateForm } from '@/presentation/components/TemplateForm'
import { VideoProcessor } from '@/presentation/components/VideoProcessor'
import { ProgressDisplay } from '@/presentation/components/ProgressDisplay'
import { ExportPanel } from '@/presentation/components/ExportPanel'
import { BrowserCompatibility } from '@/presentation/components/BrowserCompatibility'
import { Seo } from '@/presentation/components/Seo'
import { Stepper } from '@/presentation/components/ui/Stepper'
import { VideoEditor } from '@/features/editor/VideoEditor'
import { useVideoProcessing, type ProcessedVideo } from '@/hooks/useVideoProcessing'
import { useFFmpeg } from '@/hooks/useFFmpeg'
import { type Template } from '@/services/templateService'
import { type VideoEdit } from '@/domain/valueObjects/videoEdits'
import { ArrowRight, ArrowLeft, Loader2, Sparkles } from 'lucide-react'
import { Button, Card, Reveal } from '@/presentation/components/ui'
import { cn } from '@/lib/utils'

const STEPS = ['Template', 'Configure', 'Upload', 'Edit', 'Process', 'Result']

const StepTemplate = ({
    selectedTemplate,
    onTemplateSelected,
}: { selectedTemplate: Template | null; onTemplateSelected: (t: Template) => void }) => (
    <div className="space-y-8 fade-in">
        <div className="text-center mb-8">
            <h2 className="text-4xl font-bold font-display text-foreground mb-2">Choose Your Style</h2>
            <p className="text-gray-400 text-lg">Select a cinematic template to start creating</p>
        </div>
        <TemplateSelector onTemplateSelected={onTemplateSelected} selectedTemplate={selectedTemplate} />
    </div>
)

const StepConfigure = ({
    selectedTemplate, formData, onFormDataChange,
}: { selectedTemplate: Template; formData: Record<string, string>; onFormDataChange: (d: Record<string, string>) => void }) => (
    <div className="fade-in max-w-3xl mx-auto">
        <div className="text-center mb-8">
            <h2 className="text-4xl font-bold font-display text-foreground mb-2">Customize It</h2>
            <p className="text-gray-400 text-lg">Fill in the details for your video</p>
        </div>
        <Card elevation="flat" className="glass-panel-dark p-8 md:p-10 shadow-2xl">
            <TemplateForm template={selectedTemplate} onFormDataChange={onFormDataChange} formData={formData} />
        </Card>
    </div>
)

const StepUpload = ({
    uploadedFiles, onFilesUploaded,
}: { uploadedFiles: File[]; onFilesUploaded: (files: File[]) => void }) => (
    <div className="fade-in max-w-3xl mx-auto">
        <div className="text-center mb-8">
            <h2 className="text-4xl font-bold font-display text-foreground mb-2">Add Media</h2>
            <p className="text-gray-400 text-lg">Upload the videos you want to process</p>
        </div>
        <Card elevation="flat" className="glass-panel-dark p-8 md:p-10 shadow-2xl">
            <FileUpload onFilesUploaded={onFilesUploaded} uploadedFiles={uploadedFiles} />
        </Card>
    </div>
)

const StepEdit = ({
    uploadedFiles, videoEdits, onEditChange,
}: { uploadedFiles: File[]; videoEdits: Record<number, VideoEdit | undefined>; onEditChange: (index: number, edit: VideoEdit | undefined) => void }) => (
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
                    onChange={(edit) => { onEditChange(index, edit); }}
                />
            ))}
        </div>
    </div>
)

interface StepProcessProps {
    selectedTemplate: Template | null; uploadedFiles: File[]; formData: Record<string, string>
    isFFmpegReady: boolean; isProcessing: boolean; canProcess: boolean
    progress: ReturnType<typeof useVideoProcessing>['progress']
    error: string | null; onStartProcessing: () => void
}

const StepProcess = ({ selectedTemplate, uploadedFiles, formData, isFFmpegReady, isProcessing, canProcess, progress, error, onStartProcessing }: StepProcessProps) => (
    <div className="fade-in max-w-5xl mx-auto">
        <div className="text-center mb-12">
            <h2 className="text-4xl font-bold font-display text-foreground mb-2">Create Video</h2>
            <p className="text-gray-400 text-lg">We're ready to build your masterpiece</p>
        </div>
        <div className="grid md:grid-cols-2 gap-8">
            <Card elevation="flat" className="glass-panel-dark p-8 shadow-2xl h-full">
                <h3 className="text-xl font-semibold mb-6 font-display text-brand-700 dark:text-brand-300 flex items-center">
                    <Sparkles className="w-5 h-5 mr-2" />Project Summary
                </h3>
                <ul className="space-y-4 text-gray-300">
                    <li className="flex justify-between items-center gap-3 p-3 bg-foreground/5 rounded-xl border border-foreground/5">
                        <span className="text-gray-400">Template</span>
                        <span className="font-medium text-foreground truncate">{selectedTemplate?.name}</span>
                    </li>
                    <li className="flex justify-between items-center gap-3 p-3 bg-foreground/5 rounded-xl border border-foreground/5">
                        <span className="text-gray-400">Files</span>
                        <span className="font-medium text-foreground">{uploadedFiles.length} video(s)</span>
                    </li>
                    <li className="flex justify-between items-center gap-3 p-3 bg-foreground/5 rounded-xl border border-foreground/5">
                        <span className="text-gray-400">Engine Status</span>
                        <span className={cn("font-medium flex items-center", isFFmpegReady ? "text-success" : "text-warning")}>
                            {isFFmpegReady
                                ? (<>Ready <span className="ml-2 w-2 h-2 bg-success rounded-full animate-pulse" /></>)
                                : (<>Initializing... <Loader2 className="ml-2 w-3 h-3 animate-spin" /></>)}
                        </span>
                    </li>
                </ul>
            </Card>
            <Card elevation="flat" className="glass-panel-dark p-8 shadow-2xl flex flex-col justify-center h-full">
                <VideoProcessor isProcessing={isProcessing} canProcess={canProcess} onStartProcessing={onStartProcessing} error={error} template={selectedTemplate} formData={formData} uploadedFiles={uploadedFiles} />
            </Card>
        </div>
        {isProcessing && (
            <Card elevation="flat" className="mt-8 glass-panel-dark p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h3 className="text-xl font-semibold mb-4 font-display text-foreground">Processing Progress</h3>
                <ProgressDisplay progress={progress} />
            </Card>
        )}
    </div>
)

const StepResult = ({ processedVideo, onBack, onReset }: { processedVideo: ProcessedVideo; onBack: () => void; onReset: () => void }) => (
    <div className="fade-in text-center max-w-4xl mx-auto">
        <div className="mb-12">
            <h2 className="text-5xl font-bold font-display brand-gradient-text mb-4">Your Video is Ready!</h2>
            <p className="text-gray-300 text-lg">Download and share your creation</p>
        </div>
        <Reveal>
        <Card elevation="flat" className="glass-panel-dark p-8 md:p-12 shadow-2xl">
            <ExportPanel processedVideo={processedVideo} />
            <div className="mt-8 flex flex-col-reverse sm:flex-row justify-between items-center gap-4">
                <Button variant="ghost" onClick={onBack} className="group w-full sm:w-auto px-6 py-3 rounded-full bg-foreground/5 hover:bg-foreground/10">
                    <ArrowLeft className="transition-transform duration-300 group-hover:-translate-x-1" /><span>Back</span>
                </Button>
                <Button variant="link" onClick={onReset} className="group w-full sm:w-auto px-6 py-3">
                    <span>Create Another Video</span><ArrowRight className="transition-transform duration-300 group-hover:translate-x-1" />
                </Button>
            </div>
        </Card>
        </Reveal>
    </div>
)

interface NavButtonsProps {
    currentStep: number; selectedTemplate: Template | null; uploadedFiles: File[]
    isFormComplete: boolean; onPrev: () => void; onNext: () => void
}

const NavButtons = ({ currentStep, selectedTemplate, uploadedFiles, isFormComplete, onPrev, onNext }: NavButtonsProps) => {
    const isNextDisabled =
        (currentStep === 0 && !selectedTemplate) ||
        (currentStep === 1 && !isFormComplete) ||
        (currentStep === 2 && uploadedFiles.length === 0)

    return (
        <div className="flex justify-between mt-16 pt-8 border-t border-foreground/10">
            <Button variant="ghost" onClick={onPrev} disabled={currentStep === 0 || currentStep === 5} className="group px-6 py-3">
                <ArrowLeft className="transition-transform duration-300 group-hover:-translate-x-1" />Back
            </Button>
            {currentStep < 4 && (
                <Button variant="primary" onClick={onNext} disabled={isNextDisabled} className="group px-8 py-3 active:translate-y-0 active:scale-[0.98]">
                    Next<ArrowRight className="transition-transform duration-300 group-hover:translate-x-1" />
                </Button>
            )}
        </div>
    )
}

const checkFormComplete = (selectedTemplate: Template | null, formData: Record<string, string>): boolean => {
    if (!selectedTemplate) return false
    const sections: Array<{ type: string; options?: { fields?: Array<{ name: string }> } }> =
        Array.isArray(selectedTemplate.descriptor.sections) ? selectedTemplate.descriptor.sections : []
    const fields = sections.filter(s => s.type === 'form').flatMap(s => s.options?.fields ?? [])

    if (fields.length === 0) return true

    return fields.every(field => (formData[field.name] ?? '').trim() !== '')
}

const FORM_STEP = 1

// Whether the template defines any form fields — drives skipping the Configure step.
const templateHasFormFields = (selectedTemplate: Template | null): boolean => {
    if (!selectedTemplate) return false
    const sections: Array<{ type: string; options?: { fields?: Array<{ name: string }> } }> =
        Array.isArray(selectedTemplate.descriptor.sections) ? selectedTemplate.descriptor.sections : []

    return sections.filter(s => s.type === 'form').flatMap(s => s.options?.fields ?? []).length > 0
}

export const Builder = () => {
    const [currentStep, setCurrentStep] = useState(0)
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
    const [formData, setFormData] = useState<Record<string, string>>({})
    const [videoEdits, setVideoEdits] = useState<Record<number, VideoEdit | undefined>>({})
    const { isProcessing, progress, processedVideo, error, processVideo, isFFmpegReady } = useVideoProcessing()
    const { loadingProgress } = useFFmpeg()

    const handleTemplateSelected = (template: Template) => { setSelectedTemplate(template); setFormData({}) }
    // Re-uploading changes the clip set, so clear edits (they are keyed by file index).
    const handleFilesUploaded = (files: File[]) => { setUploadedFiles(files); setVideoEdits({}) }
    const handleEditChange = (index: number, edit: VideoEdit | undefined) => {
        setVideoEdits(prev => ({ ...prev, [index]: edit }))
    }
    const handleStartProcessingSync = () => {
        if (!selectedTemplate || uploadedFiles.length === 0) return
        processVideo(uploadedFiles, { ...selectedTemplate, formData }, videoEdits).then(() => {
            if (!error) setCurrentStep(5)
        }, (error_: unknown) => { console.error('Processing error', error_) })
    }

    const isFormComplete = checkFormComplete(selectedTemplate, formData)
    const hasForm = templateHasFormFields(selectedTemplate)
    const canProcess = Boolean(selectedTemplate) && uploadedFiles.length > 0 && isFFmpegReady && isFormComplete
    const nextStep = () => {
        setCurrentStep(prev => {
            const next = prev + 1
            const target = next === FORM_STEP && !hasForm ? next + 1 : next
 // skip empty Configure step
            return Math.min(target, STEPS.length - 1)
        })
    }
    const prevStep = () => {
        setCurrentStep(prev => {
            const back = prev - 1
            const target = back === FORM_STEP && !hasForm ? back - 1 : back

            return Math.max(target, 0)
        })
    }
    const handleReset = () => { setCurrentStep(0); setUploadedFiles([]); setFormData({}); setSelectedTemplate(null); setVideoEdits({}) }

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-background text-foreground relative overflow-hidden">
            <h1 className="sr-only">Video Builder — create videos from templates</h1>
            <Seo title="Video Builder" description="Pick a template and compose your video entirely in the browser — trim, crop, add music and export with WebAssembly FFmpeg. No uploads, no servers." path="/builder" />
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-500/15 rounded-full blur-[120px] animate-float" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary-400/10 rounded-full blur-[120px] animate-float" style={{ animationDelay: '-3s' }} />
            </div>
            <div className="mx-auto w-full max-w-6xl px-4 pt-24 pb-24 relative z-10">
                <BrowserCompatibility />
                <div className="max-w-4xl mx-auto mb-12">
                    <Stepper steps={STEPS} currentStep={currentStep} />
                </div>
                <div className="max-w-6xl mx-auto">
                    {currentStep === 0 && <StepTemplate selectedTemplate={selectedTemplate} onTemplateSelected={handleTemplateSelected} />}
                    {currentStep === 1 && selectedTemplate && <StepConfigure selectedTemplate={selectedTemplate} formData={formData} onFormDataChange={setFormData} />}
                    {currentStep === 2 && <StepUpload uploadedFiles={uploadedFiles} onFilesUploaded={handleFilesUploaded} />}
                    {currentStep === 3 && <StepEdit uploadedFiles={uploadedFiles} videoEdits={videoEdits} onEditChange={handleEditChange} />}
                    {currentStep === 4 && <StepProcess selectedTemplate={selectedTemplate} uploadedFiles={uploadedFiles} formData={formData} isFFmpegReady={isFFmpegReady} isProcessing={isProcessing} canProcess={canProcess} progress={progress} error={error} onStartProcessing={handleStartProcessingSync} />}
                    {currentStep === 5 && processedVideo && <StepResult processedVideo={processedVideo} onBack={() => { setCurrentStep(hasForm ? 1 : 2) }} onReset={handleReset} />}
                    <NavButtons currentStep={currentStep} selectedTemplate={selectedTemplate} uploadedFiles={uploadedFiles} isFormComplete={isFormComplete} onPrev={prevStep} onNext={nextStep} />
                </div>
                {currentStep === 0 && selectedTemplate && (
                    <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4 pointer-events-none">
                        <Card elevation="flat" className="slide-up pointer-events-auto flex items-center gap-3 rounded-full bg-surface/90 backdrop-blur-md py-2 pl-5 pr-2 shadow-xl shadow-brand-500/10">
                            <span className="hidden sm:inline text-sm text-gray-400">Template</span>
                            <span className="max-w-[10rem] truncate text-sm font-semibold text-foreground">{selectedTemplate.name}</span>
                            <Button variant="primary" size="sm" onClick={nextStep} className="group rounded-full px-5 py-2.5 shadow-brand-500/25 [&_svg]:size-4">
                                Continue <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
                            </Button>
                        </Card>
                    </div>
                )}
                {!isFFmpegReady && (
                    <Card elevation="flat" className="fixed bottom-6 right-6 max-w-sm glass-panel-dark rounded-xl shadow-2xl p-4 border-warning/20 z-50 fade-in">
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
    )
}
