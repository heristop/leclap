import { useState } from 'react'
import { FileUpload } from './components/FileUpload'
import { TemplateSelector } from './components/TemplateSelector'
import { TemplateForm } from './components/TemplateForm'
import { VideoProcessor } from './components/VideoProcessor'
import { ProgressDisplay } from './components/ProgressDisplay'
import { ExportPanel } from './components/ExportPanel'
import { Header } from './components/Header'
import { BrowserCompatibility } from './components/BrowserCompatibility'
import { FeaturesSection } from './components/FeaturesSection'
import { useVideoProcessing } from './hooks/useVideoProcessing'
import { useFFmpeg } from './hooks/useFFmpeg'
import { type Template } from './services/templateService'
import { Clapperboard } from 'lucide-react'

function App() {
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
      // Include form data in the processing call
      await processVideo(uploadedFiles, { ...selectedTemplate, formData })
    }
  }

  // Check if form is complete for templates that have forms
  const isFormComplete = () => {
    if (!selectedTemplate) return false

    const fields = selectedTemplate.descriptor.sections
      .filter(s => s.type === 'form')
      .flatMap(s => s.options?.fields || [])

    if (fields.length === 0) return true // No form required

    return fields.every(field => {
      const value = formData[field.name] || ''
      return value.trim() !== ''
    })
  }

  const canProcess = !!selectedTemplate && uploadedFiles.length > 0 && isFFmpegReady && isFormComplete()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            <Clapperboard className="w-16 h-16 text-blue-600 mr-4" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              FFmpeg Video Composer
            </h1>
          </div>
          <p className="text-xl text-gray-600 mb-4">
            Create professional videos using real JSON-based templates with advanced FFmpeg processing
          </p>
          <p className="text-sm text-gray-500">
            Powered by WebAssembly FFmpeg • Real Template Engine • Interactive Forms • Complete Privacy
          </p>
        </div>

        {/* Browser Compatibility Check */}
        <BrowserCompatibility />

        {/* Main Content */}
        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          {/* Left Column - Input */}
          <div className="space-y-6">
            {/* Template Selection */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-semibold mb-4 flex items-center">
                <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold mr-3">
                  1
                </span>
                Choose Template
              </h2>
              <TemplateSelector
                onTemplateSelected={handleTemplateSelected}
                selectedTemplate={selectedTemplate}
              />
            </div>

            {/* Template Form */}
            {selectedTemplate && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-2xl font-semibold mb-4 flex items-center">
                  <span className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-sm font-bold mr-3">
                    2
                  </span>
                  Configure Template
                </h2>
                <TemplateForm
                  template={selectedTemplate}
                  onFormDataChange={handleFormDataChange}
                  formData={formData}
                />
              </div>
            )}

            {/* File Upload */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-semibold mb-4 flex items-center">
                <span className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-bold mr-3">
                  {selectedTemplate ? '3' : '2'}
                </span>
                Upload Videos
              </h2>
              <FileUpload
                onFilesUploaded={handleFilesUploaded}
                uploadedFiles={uploadedFiles}
              />
            </div>
          </div>

          {/* Right Column - Processing & Output */}
          <div className="space-y-6">
            {/* Video Processing */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-semibold mb-4 flex items-center">
                <span className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm font-bold mr-3">
                  {selectedTemplate ? '4' : '3'}
                </span>
                Process Video
              </h2>
              <VideoProcessor
                isProcessing={isProcessing}
                canProcess={canProcess}
                onStartProcessing={handleStartProcessing}
                error={error}
                template={selectedTemplate}
                formData={formData}
              />
            </div>

            {/* Progress Display */}
            {isProcessing && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-2xl font-semibold mb-4">Processing Progress</h2>
                <ProgressDisplay progress={progress} />
              </div>
            )}

            {/* Export Panel */}
            {processedVideo && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-2xl font-semibold mb-4 flex items-center">
                  <span className="w-8 h-8 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center text-sm font-bold mr-3">
                    {selectedTemplate ? '5' : '4'}
                  </span>
                  Download Result
                </h2>
                <ExportPanel processedVideo={processedVideo} />
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Status Messages */}
        {!isFFmpegReady && (
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-6 mb-6 fade-in">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-yellow-600 border-t-transparent"></div>
                <div>
                  <h4 className="font-semibold text-yellow-800">Loading FFmpeg WebAssembly</h4>
                  <p className="text-sm text-yellow-700">Preparing video processing engine...</p>
                </div>
              </div>
              <span className="text-lg font-bold text-yellow-600">
                {Math.round(loadingProgress)}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 bg-yellow-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 transition-all duration-300"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>

            <div className="mt-3 text-xs text-yellow-700">
              <p>• WebAssembly modules are being downloaded and initialized</p>
              <p>• This happens only once per session</p>
              <p>• Processing will be lightning-fast once loaded!</p>
            </div>
          </div>
        )}
      </main>

      {/* Features Section */}
      <FeaturesSection />

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-400">
            Built with ❤️ using React, WebAssembly, and FFmpeg
          </p>
          <p className="text-sm text-gray-500 mt-2">
            All processing happens locally in your browser - your files never leave your device
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App