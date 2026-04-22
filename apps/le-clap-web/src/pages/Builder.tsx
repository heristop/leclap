import { useState } from 'react'
import { FileUpload } from '../components/FileUpload'
import { TemplateSelector } from '../components/TemplateSelector'
import { TemplateForm } from '../components/TemplateForm'
import { VideoProcessor } from '../components/VideoProcessor'
import { ProgressDisplay } from '../components/ProgressDisplay'
import { ExportPanel } from '../components/ExportPanel'
import { BrowserCompatibility } from '../components/BrowserCompatibility'
import { Stepper } from '../components/ui/Stepper'
import { useVideoProcessing } from '../hooks/useVideoProcessing'
import { useFFmpeg } from '../hooks/useFFmpeg'
import { type Template } from '../services/templateService'
import type { Section } from '@ffmpeg-video-composer/core'
import { ArrowRight, ArrowLeft, Loader2, Sparkles } from 'lucide-react'
import { cn } from '../lib/utils'

const STEPS = ['Template', 'Configure', 'Upload', 'Process', 'Result']

export const Builder = () => {
    const [currentStep, setCurrentStep] = useState(0)
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
    const [formData, setFormData] = useState<Record<string, string>>({})

    const {
        isProcessing,
        progress,
        processedVideo,
        error,
        processVideo,
        isFFmpegReady
    } = useVideoProcessing()

    const { loadingProgress } = useFFmpeg()

    const handleFilesUploaded = (files: File[]) => {
        setUploadedFiles(files)
    }

    const handleTemplateSelected = (template: Template) => {
        setSelectedTemplate(template)
        setFormData({}) // Reset form data when template changes


    }

    const handleFormDataChange = (newFormData: Record<string, string>) => {
        setFormData(newFormData)
    }

    const handleStartProcessing = async () => {
        if (selectedTemplate && uploadedFiles.length > 0) {
            await processVideo(uploadedFiles, { ...selectedTemplate, formData })
            if (!error) {
                setCurrentStep(4) // Move to Result step
            }
        }
    }

    // Check if form is complete for templates that have forms
    const isFormComplete = () => {
        if (!selectedTemplate) return false

        const fields = selectedTemplate.descriptor.sections
            .filter((s: Section) => s.type === 'form')
            .flatMap((s: Section) => s.options?.fields || [])

        if (fields.length === 0) return true // No form required

        return fields.every((field: { name: string }) => {
            const value = formData[field.name] || ''
            return value.trim() !== ''
        })
    }

    const canProcess = !!selectedTemplate && uploadedFiles.length > 0 && isFFmpegReady && isFormComplete()

    const nextStep = () => {
        if (currentStep < STEPS.length - 1) {
            setCurrentStep(prev => prev + 1)
        }
    }

    const prevStep = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1)
        }
    }

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-gray-900 text-white relative overflow-hidden">
            {/* Background Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px]" />
            </div>

            <div className="container mx-auto px-4 pt-24 relative z-10">
                {/* Browser Compatibility Check */}
                <BrowserCompatibility />

                {/* Stepper */}
                <div className="max-w-4xl mx-auto mb-12">
                    <Stepper steps={STEPS} currentStep={currentStep} />
                </div>

                {/* Main Content */}
                <div className="max-w-6xl mx-auto">
                    {/* Step 1: Template Selection */}
                    {currentStep === 0 && (
                        <div className="space-y-8 fade-in">
                            <div className="text-center mb-8">
                                <h2 className="text-4xl font-bold font-display text-white mb-2">Choose Your Style</h2>
                                <p className="text-gray-400 text-lg">Select a cinematic template to start creating</p>
                            </div>
                            <TemplateSelector
                                onTemplateSelected={(template) => {
                                    handleTemplateSelected(template)
                                }}
                                selectedTemplate={selectedTemplate}
                            />
                        </div>
                    )}

                    {/* Step 2: Configuration */}
                    {currentStep === 1 && selectedTemplate && (
                        <div className="fade-in max-w-3xl mx-auto">
                            <div className="text-center mb-8">
                                <h2 className="text-4xl font-bold font-display text-white mb-2">Customize It</h2>
                                <p className="text-gray-400 text-lg">Fill in the details for your video</p>
                            </div>
                            <div className="glass-panel-dark rounded-2xl p-8 md:p-10 shadow-2xl">
                                <TemplateForm
                                    template={selectedTemplate}
                                    onFormDataChange={handleFormDataChange}
                                    formData={formData}
                                />
                            </div>
                        </div>
                    )}

                    {/* Step 3: File Upload */}
                    {currentStep === 2 && (
                        <div className="fade-in max-w-3xl mx-auto">
                            <div className="text-center mb-8">
                                <h2 className="text-4xl font-bold font-display text-white mb-2">Add Media</h2>
                                <p className="text-gray-400 text-lg">Upload the videos you want to process</p>
                            </div>
                            <div className="glass-panel-dark rounded-2xl p-8 md:p-10 shadow-2xl">
                                <FileUpload
                                    onFilesUploaded={handleFilesUploaded}
                                    uploadedFiles={uploadedFiles}
                                />
                            </div>
                        </div>
                    )}

                    {/* Step 4: Process */}
                    {currentStep === 3 && (
                        <div className="fade-in max-w-5xl mx-auto">
                            <div className="text-center mb-12">
                                <h2 className="text-4xl font-bold font-display text-white mb-2">Create Video</h2>
                                <p className="text-gray-400 text-lg">We're ready to build your masterpiece</p>
                            </div>

                            <div className="grid md:grid-cols-2 gap-8">
                                <div className="glass-panel-dark rounded-2xl p-8 shadow-2xl h-full">
                                    <h3 className="text-xl font-semibold mb-6 font-display text-blue-300 flex items-center">
                                        <Sparkles className="w-5 h-5 mr-2" />
                                        Project Summary
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
                                                {isFFmpegReady ? (
                                                    <>Ready <span className="ml-2 w-2 h-2 bg-green-500 rounded-full animate-pulse" /></>
                                                ) : (
                                                    <>Initializing... <Loader2 className="ml-2 w-3 h-3 animate-spin" /></>
                                                )}
                                            </span>
                                        </li>
                                    </ul>
                                </div>

                                <div className="glass-panel-dark rounded-2xl p-8 shadow-2xl flex flex-col justify-center h-full">
                                    <VideoProcessor
                                        isProcessing={isProcessing}
                                        canProcess={canProcess}
                                        onStartProcessing={handleStartProcessing}
                                        error={error}
                                        template={selectedTemplate}
                                        formData={formData}
                                        uploadedFiles={uploadedFiles}
                                    />
                                </div>
                            </div>

                            {isProcessing && (
                                <div className="mt-8 glass-panel-dark rounded-2xl p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <h3 className="text-xl font-semibold mb-4 font-display text-white">Processing Progress</h3>
                                    <ProgressDisplay progress={progress} />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 5: Result */}
                    {currentStep === 4 && processedVideo && (
                        <div className="fade-in text-center max-w-4xl mx-auto">
                            <div className="mb-12">
                                <h2 className="text-5xl font-bold font-display bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-4">
                                    Your Video is Ready!
                                </h2>
                                <p className="text-gray-300 text-lg">Download and share your creation</p>
                            </div>
                            <div className="glass-panel-dark rounded-2xl p-8 md:p-12 shadow-2xl border border-white/10">
                                <ExportPanel processedVideo={processedVideo} />
                                <div className="mt-8 flex justify-between items-center">
                                    <button
                                        onClick={() => setCurrentStep(1)}
                                        className="flex items-center space-x-2 px-6 py-3 text-gray-200 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-all duration-300 cursor-pointer"
                                    >
                                        <ArrowLeft className="w-5 h-5" />
                                        <span>Back</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setCurrentStep(0)
                                            setUploadedFiles([])
                                            setFormData({})
                                            setSelectedTemplate(null)
                                        }}
                                        className="flex items-center space-x-2 px-6 py-3 text-blue-400 hover:text-blue-300 font-medium hover:underline transition-all cursor-pointer"
                                    >
                                        <span>Create Another Video</span>
                                        <ArrowRight className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Navigation Buttons */}
                    <div className="flex justify-between mt-16 pt-8 border-t border-white/10">
                        <button
                            onClick={prevStep}
                            disabled={currentStep === 0 || currentStep === 4}
                            className={cn(
                                "flex items-center px-6 py-3 rounded-xl font-medium transition-all duration-200",
                                currentStep === 0 || currentStep === 4
                                    ? "text-gray-600 cursor-not-allowed opacity-50"
                                    : "text-gray-400 hover:text-white hover:bg-white/10 cursor-pointer"
                            )}
                        >
                            <ArrowLeft className="w-5 h-5 mr-2" />
                            Back
                        </button>

                        {currentStep < 3 && (
                            <button
                                onClick={nextStep}
                                disabled={
                                    (currentStep === 0 && !selectedTemplate) ||
                                    (currentStep === 1 && !isFormComplete()) ||
                                    (currentStep === 2 && uploadedFiles.length === 0)
                                }
                                className={cn(
                                    "flex items-center px-8 py-3 rounded-xl font-bold text-white transition-all duration-300 shadow-lg",
                                    (currentStep === 0 && !selectedTemplate) ||
                                        (currentStep === 1 && !isFormComplete()) ||
                                        (currentStep === 2 && uploadedFiles.length === 0)
                                        ? "bg-gray-700 cursor-not-allowed opacity-50 shadow-none"
                                        : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 hover:shadow-blue-500/25 hover:scale-105 cursor-pointer"
                                )}
                            >
                                Next
                                <ArrowRight className="w-5 h-5 ml-2" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Status Messages (Bottom Fixed) */}
                {!isFFmpegReady && (
                    <div className="fixed bottom-6 right-6 max-w-sm glass-panel-dark rounded-xl shadow-2xl p-4 border border-yellow-500/20 z-50 fade-in">
                        <div className="flex items-center space-x-3 mb-2">
                            <Loader2 className="w-5 h-5 text-yellow-500 animate-spin" />
                            <span className="font-semibold text-yellow-400">Loading Engine</span>
                            <span className="ml-auto font-bold text-yellow-500">{Math.round(loadingProgress)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-yellow-500 transition-all duration-300"
                                style={{ width: `${loadingProgress}%` }}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
