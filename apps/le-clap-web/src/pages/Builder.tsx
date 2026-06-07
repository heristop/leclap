import { useState } from 'react'
import { FileUpload } from '../components/FileUpload'
import { TemplateSelector } from '../components/TemplateSelector'
import { TemplateForm } from '../components/TemplateForm'
import { VideoProcessor } from '../components/VideoProcessor'
import { ProgressDisplay } from '../components/ProgressDisplay'
import { ExportPanel } from '../components/ExportPanel'
import { BrowserCompatibility } from '../components/BrowserCompatibility'
import { Stepper } from '../components/ui/Stepper'
import { useVideoProcessing, type ProcessedVideo } from '../hooks/useVideoProcessing'
import { useFFmpeg } from '../hooks/useFFmpeg'
import { type Template } from '../services/templateService'
import { ArrowRight, ArrowLeft, Loader2, Sparkles } from 'lucide-react'
import { cn } from '../lib/utils'

const STEPS = ['Template', 'Configure', 'Upload', 'Process', 'Result']

const StepTemplate = ({
    selectedTemplate,
    onTemplateSelected,
}: { selectedTemplate: Template | null; onTemplateSelected: (t: Template) => void }) => (
    <div className="space-y-8 fade-in">
        <div className="text-center mb-8">
            <h2 className="text-4xl font-bold font-display text-white mb-2">Choose Your Style</h2>
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
            <h2 className="text-4xl font-bold font-display text-white mb-2">Customize It</h2>
            <p className="text-gray-400 text-lg">Fill in the details for your video</p>
        </div>
        <div className="glass-panel-dark rounded-2xl p-8 md:p-10 shadow-2xl">
            <TemplateForm template={selectedTemplate} onFormDataChange={onFormDataChange} formData={formData} />
        </div>
    </div>
)

const StepUpload = ({
    uploadedFiles, onFilesUploaded,
}: { uploadedFiles: File[]; onFilesUploaded: (files: File[]) => void }) => (
    <div className="fade-in max-w-3xl mx-auto">
        <div className="text-center mb-8">
            <h2 className="text-4xl font-bold font-display text-white mb-2">Add Media</h2>
            <p className="text-gray-400 text-lg">Upload the videos you want to process</p>
        </div>
        <div className="glass-panel-dark rounded-2xl p-8 md:p-10 shadow-2xl">
            <FileUpload onFilesUploaded={onFilesUploaded} uploadedFiles={uploadedFiles} />
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
            <h2 className="text-4xl font-bold font-display text-white mb-2">Create Video</h2>
            <p className="text-gray-400 text-lg">We're ready to build your masterpiece</p>
        </div>
        <div className="grid md:grid-cols-2 gap-8">
            <div className="glass-panel-dark rounded-2xl p-8 shadow-2xl h-full">
                <h3 className="text-xl font-semibold mb-6 font-display text-brand-300 flex items-center">
                    <Sparkles className="w-5 h-5 mr-2" />Project Summary
                </h3>
                <ul className="space-y-4 text-gray-300">
                    <li className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5">
                        <span className="text-gray-400">Template</span>
                        <span className="font-medium text-white">{selectedTemplate?.name}</span>
                    </li>
                    <li className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5">
                        <span className="text-gray-400">Files</span>
                        <span className="font-medium text-white">{uploadedFiles.length} video(s)</span>
                    </li>
                    <li className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5">
                        <span className="text-gray-400">Engine Status</span>
                        <span className={cn("font-medium flex items-center", isFFmpegReady ? "text-green-400" : "text-yellow-400")}>
                            {isFFmpegReady
                                ? (<>Ready <span className="ml-2 w-2 h-2 bg-green-500 rounded-full animate-pulse" /></>)
                                : (<>Initializing... <Loader2 className="ml-2 w-3 h-3 animate-spin" /></>)}
                        </span>
                    </li>
                </ul>
            </div>
            <div className="glass-panel-dark rounded-2xl p-8 shadow-2xl flex flex-col justify-center h-full">
                <VideoProcessor isProcessing={isProcessing} canProcess={canProcess} onStartProcessing={onStartProcessing} error={error} template={selectedTemplate} formData={formData} uploadedFiles={uploadedFiles} />
            </div>
        </div>
        {isProcessing && (
            <div className="mt-8 glass-panel-dark rounded-2xl p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h3 className="text-xl font-semibold mb-4 font-display text-white">Processing Progress</h3>
                <ProgressDisplay progress={progress} />
            </div>
        )}
    </div>
)

const StepResult = ({ processedVideo, onBack, onReset }: { processedVideo: ProcessedVideo; onBack: () => void; onReset: () => void }) => (
    <div className="fade-in text-center max-w-4xl mx-auto">
        <div className="mb-12">
            <h2 className="text-5xl font-bold font-display brand-gradient-text mb-4">Your Video is Ready!</h2>
            <p className="text-gray-300 text-lg">Download and share your creation</p>
        </div>
        <div className="glass-panel-dark rounded-2xl p-8 md:p-12 shadow-2xl border border-white/10">
            <ExportPanel processedVideo={processedVideo} />
            <div className="mt-8 flex justify-between items-center">
                <button onClick={onBack} className="flex items-center space-x-2 px-6 py-3 text-gray-200 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-all duration-300 cursor-pointer">
                    <ArrowLeft className="w-5 h-5" /><span>Back</span>
                </button>
                <button onClick={onReset} className="flex items-center space-x-2 px-6 py-3 text-brand-400 hover:text-brand-300 font-medium hover:underline transition-all cursor-pointer">
                    <span>Create Another Video</span><ArrowRight className="w-5 h-5" />
                </button>
            </div>
        </div>
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
        <div className="flex justify-between mt-16 pt-8 border-t border-white/10">
            <button onClick={onPrev} disabled={currentStep === 0 || currentStep === 4} className={cn("flex items-center px-6 py-3 rounded-xl font-medium transition-all duration-200", currentStep === 0 || currentStep === 4 ? "text-gray-600 cursor-not-allowed opacity-50" : "text-gray-400 hover:text-white hover:bg-white/10 cursor-pointer")}>
                <ArrowLeft className="w-5 h-5 mr-2" />Back
            </button>
            {currentStep < 3 && (
                <button onClick={onNext} disabled={isNextDisabled} className={cn("group flex items-center px-8 py-3 rounded-xl font-bold text-white transition-all duration-300 shadow-lg", isNextDisabled ? "bg-gray-700 cursor-not-allowed opacity-50 shadow-none" : "brand-gradient hover:shadow-brand-500/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] cursor-pointer")}>
                    Next<ArrowRight className="w-5 h-5 ml-2 transition-transform duration-300 group-hover:translate-x-1" />
                </button>
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

export const Builder = () => {
    const [currentStep, setCurrentStep] = useState(0)
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
    const [formData, setFormData] = useState<Record<string, string>>({})
    const { isProcessing, progress, processedVideo, error, processVideo, isFFmpegReady } = useVideoProcessing()
    const { loadingProgress } = useFFmpeg()

    const handleTemplateSelected = (template: Template) => { setSelectedTemplate(template); setFormData({}) }
    const handleStartProcessingSync = () => {
        if (!selectedTemplate || uploadedFiles.length === 0) return
        processVideo(uploadedFiles, { ...selectedTemplate, formData }).then(() => {
            if (!error) setCurrentStep(4)
        }, (error_: unknown) => { console.error('Processing error', error_) })
    }

    const isFormComplete = checkFormComplete(selectedTemplate, formData)
    const canProcess = Boolean(selectedTemplate) && uploadedFiles.length > 0 && isFFmpegReady && isFormComplete
    const nextStep = () => { if (currentStep < STEPS.length - 1) setCurrentStep(prev => prev + 1) }
    const prevStep = () => { if (currentStep > 0) setCurrentStep(prev => prev - 1) }
    const handleReset = () => { setCurrentStep(0); setUploadedFiles([]); setFormData({}); setSelectedTemplate(null) }

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-gray-900 text-white relative overflow-hidden">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-500/15 rounded-full blur-[120px] animate-float" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary-400/10 rounded-full blur-[120px] animate-float" style={{ animationDelay: '-3s' }} />
            </div>
            <div className="container mx-auto px-4 pt-24 relative z-10">
                <BrowserCompatibility />
                <div className="max-w-4xl mx-auto mb-12">
                    <Stepper steps={STEPS} currentStep={currentStep} />
                </div>
                <div className="max-w-6xl mx-auto">
                    {currentStep === 0 && <StepTemplate selectedTemplate={selectedTemplate} onTemplateSelected={handleTemplateSelected} />}
                    {currentStep === 1 && selectedTemplate && <StepConfigure selectedTemplate={selectedTemplate} formData={formData} onFormDataChange={setFormData} />}
                    {currentStep === 2 && <StepUpload uploadedFiles={uploadedFiles} onFilesUploaded={setUploadedFiles} />}
                    {currentStep === 3 && <StepProcess selectedTemplate={selectedTemplate} uploadedFiles={uploadedFiles} formData={formData} isFFmpegReady={isFFmpegReady} isProcessing={isProcessing} canProcess={canProcess} progress={progress} error={error} onStartProcessing={handleStartProcessingSync} />}
                    {currentStep === 4 && processedVideo && <StepResult processedVideo={processedVideo} onBack={() => { setCurrentStep(1) }} onReset={handleReset} />}
                    <NavButtons currentStep={currentStep} selectedTemplate={selectedTemplate} uploadedFiles={uploadedFiles} isFormComplete={isFormComplete} onPrev={prevStep} onNext={nextStep} />
                </div>
                {!isFFmpegReady && (
                    <div className="fixed bottom-6 right-6 max-w-sm glass-panel-dark rounded-xl shadow-2xl p-4 border border-yellow-500/20 z-50 fade-in">
                        <div className="flex items-center space-x-3 mb-2">
                            <Loader2 className="w-5 h-5 text-yellow-500 animate-spin" />
                            <span className="font-semibold text-yellow-400">Loading Engine</span>
                            <span className="ml-auto font-bold text-yellow-500">{Math.round(loadingProgress)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                            <div className="h-full bg-yellow-500 transition-all duration-300" style={{ width: `${loadingProgress}%` }} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
