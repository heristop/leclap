import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  SafeAreaView,
  Alert,
  Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import FormSection from '@/app/features/editor/components/FormSection';
import { Template, Section, Project } from '@/app/types';
import { colors, spacing, typography } from '@/app/styles/theme';
import { fetchTemplateByName, saveProject, compileVideo, getProjectById } from '@/app/services/api';

const TemplateDetailScreen = () => {
  const params = useLocalSearchParams<{ id: string; projectId?: string }>();
  const router = useRouter();
  const templateName = params.id;
  const projectId = params.projectId;
  
  const [template, setTemplate] = useState<Template | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [activeFormSection, setActiveFormSection] = useState<Section | null>(null);
  const [activeMusicSection, setActiveMusicSection] = useState<Section | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCompiling, setIsCompiling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData(); 
  }, [templateName, projectId]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (!templateName) throw new Error("Template name is missing");
      const templateData = await fetchTemplateByName(templateName);
      setTemplate(templateData);
      
      if (projectId) {
        const existingProject = await getProjectById(projectId);
        if (existingProject) {
          setProject(existingProject);
        } else {
          console.warn(`Project with ID ${projectId} not found, creating new one.`);
          createNewProject(templateData);
        }
      } else {
        createNewProject(templateData);
      }
    } catch (err: any) {
      setError(`Failed to load template details: ${err.message}`);
      console.error('Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const createNewProject = (templateData: Template) => {
    const newProject: Project = {
      id: Date.now().toString(),
      name: `${templateData.name.replace('.json', '')} Project`,
      templateName: templateData.name,
      templateContent: templateData.content,
      status: 'draft',
      formData: {},
      recordedVideos: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setProject(newProject);
    
    saveProject(newProject);
  };
  
  const handleFormDataChange = (field: string, value: string) => {
    if (!project) return;
    
    setProject(prev => {
      if (!prev) return prev;
      
      const updatedProject = {
        ...prev,
        formData: {
          ...prev.formData,
          [field]: value,
        },
        updatedAt: new Date().toISOString(),
      };
      
      setTimeout(() => {
        saveProject(updatedProject);
      }, 500);
      
      return updatedProject;
    });
  };

  const isFormSectionCompleted = (section: Section, formData: Record<string, string>): boolean => {
    if (section.type !== 'form' || !section.options?.fields) return false;
    return section.options.fields.every(field => !!formData[field.name]);
  };

  const handleFormSubmit = () => {
    if (!activeFormSection || !project) return; 
    
    if (isFormSectionCompleted(activeFormSection, project.formData)) {
      setActiveFormSection(null);
    } else {
      Alert.alert("Incomplete Form", "Please fill out all required fields");
    }
  };

  const handlePreviewVideo = (section: Section) => {
    if (project?.recordedVideos[section.name] && project?.id && template?.content?.global?.orientation) {
      router.push({
        pathname: '/(fullscreen)/preview',
        params: {
          projectId: project.id,
          videoUri: project.recordedVideos[section.name].path,
          orientation: template.content.global.orientation,
          sectionName: section.name,
        },
      });
    } else {
      console.error('Cannot preview video: Missing project, video, or orientation data.');
      Alert.alert('Error', 'Could not preview video.');
    }
  };

  const isSectionCompleted = (section: Section): boolean => {
    if (!project) return false;
    
    if (section.type === 'project_video' || section.type === 'picture') {
      return !!project.recordedVideos[section.name];
    } else if (section.type === 'form') {
      const fields = section.options?.fields || [];
      return fields.every(field => !!project.formData[field.name]);
    } else if (section.type === 'music') {
      return !!project.formData[`music_${section.name}`];
    }
    return false;
  };
  
  const areAllSectionsCompleted = (): boolean => {
    if (!template || !filteredSections.length) return false;
    return filteredSections.every(isSectionCompleted);
  };

  const handleCompileVideo = async () => {
    if (!project || !template) return;
    
    setIsCompiling(true);
    
    try {
      const processedTemplate = JSON.parse(JSON.stringify(template.content));
      
      let templateString = JSON.stringify(processedTemplate);
      Object.entries(project.formData).forEach(([key, value]) => {
        const placeholder = `{{ ${key} }}`;
        templateString = templateString.replace(new RegExp(placeholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), value);
      });
      
      const finalTemplate = JSON.parse(templateString);
      
      const result = await compileVideo(finalTemplate, project.recordedVideos);
      
      if (result.success) {
        const updatedProject = {
          ...project,
          outputVideoUri: result.outputUri,
          status: 'completed' as 'draft' | 'processing' | 'completed',
          updatedAt: new Date().toISOString(),
        };
        
        setProject(updatedProject);
        saveProject(updatedProject);
        
        router.push({
          pathname: '/(fullscreen)/preview',
          params: { projectId: project.id, videoUri: result.outputUri },
        });
      } else {
        Alert.alert(
          'Compilation Failed',
          result.error || 'An error occurred during video compilation.'
        );
      }
    } catch (error: any) {
      console.error('Error during compilation:', error);
      Alert.alert(
        'Compilation Error',
        `An unexpected error occurred: ${error.message}`
      );
    } finally {
      setIsCompiling(false);
    }
  };

  const getSectionIcon = (section: Section): keyof typeof Ionicons.glyphMap => {
    switch (section.type) {
      case 'project_video':
        return 'videocam';
      case 'form':
        return 'document-text';
      case 'music':
        return 'musical-notes';
      case 'picture':
        return 'image';
      default:
        return 'document';
    }
  };

  const renderActiveFormSection = () => {
    if (!activeFormSection) return null;
    
    return (
      <Modal
        visible={activeFormSection !== null}
        animationType="slide"
        onRequestClose={() => setActiveFormSection(null)}
      >
        <SafeAreaView style={styles.formModalContainer}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>{activeFormSection.title?.en || activeFormSection.name}</Text>
            <TouchableOpacity onPress={() => setActiveFormSection(null)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView>
            <FormSection
              section={activeFormSection}
              formData={project?.formData || {}}
              onFormDataChange={handleFormDataChange}
            />
          </ScrollView>
          <View style={styles.formFooter}>
            <TouchableOpacity
              style={styles.formSubmitButton}
              onPress={handleFormSubmit}
            >
              <Text style={styles.formSubmitButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    );
  };

  const renderActiveMusicSection = () => {
    if (!activeMusicSection) return null;

    return (
      <Modal
        visible={activeMusicSection !== null}
        animationType="slide"
        onRequestClose={() => setActiveMusicSection(null)}
      >
        <SafeAreaView style={styles.formModalContainer}>
           <View style={styles.formHeader}>
            <Text style={styles.formTitle}>{activeMusicSection.title?.en || activeMusicSection.name}</Text>
            <TouchableOpacity onPress={() => setActiveMusicSection(null)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.placeholderContainer}>
              <Ionicons name="musical-notes" size={48} color={colors.primary} />
              <Text style={styles.placeholderText}>Music selection coming soon</Text>
              <TouchableOpacity 
                style={styles.tempCompleteButton}
                onPress={() => {
                  if (project) {
                    const updatedProject = {
                      ...project,
                      formData: {
                        ...project.formData,
                        [`music_${activeMusicSection.name}`]: 'default',
                      },
                      updatedAt: new Date().toISOString(),
                    };
                    setProject(updatedProject);
                    saveProject(updatedProject);
                  }
                  setActiveMusicSection(null);
                }}
              >
                <Text style={styles.tempCompleteButtonText}>Use Default Music</Text>
              </TouchableOpacity>
            </View>
        </SafeAreaView>
      </Modal>
    );
  };

  const handleSectionPress = (section: Section) => {
    if (!project || !template) return;

    if (section.type === 'project_video' || section.type === 'picture') {
      router.push({
        pathname: '/(fullscreen)/record-section',
        params: {
          projectId: project.id,
          sectionJson: JSON.stringify(section),
          orientation: template.content.global?.orientation || 'portrait',
          existingVideoPath: project.recordedVideos[section.name]?.path,
        },
      });
    } else if (section.type === 'form') {
      setActiveFormSection(section);
    } else if (section.type === 'music') {
      setActiveMusicSection(section);
    } else {
      Alert.alert('Unsupported', 'This section type is not yet editable.');
    }
  };


  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading template...</Text>
      </View>
    );
  }

  if (error || !template || !project) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error || 'Template or Project not found'}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Back to Templates</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const filteredSections = (template.content.sections || []).filter(section => 
    ['project_video', 'form', 'music', 'picture'].includes(section.type)
  );

  const displayName = template.name.replace('.json', '');
  const orientation = template.content.global?.orientation || 'portrait';
  
  const description = template.content.sections?.find(section => 
    section.description?.en)?.description?.en || 'Create a video using this template';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{displayName}</Text>
      </View>
      
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.orientationRow}>
          <Ionicons 
            name={orientation === 'portrait' ? 'phone-portrait-outline' : 'phone-landscape-outline'} 
            size={24} 
            color={colors.text} 
          />
          <Text style={styles.orientationText}>{orientation === 'portrait' ? 'Portrait' : 'Landscape'} orientation</Text>
        </View>
        
        <Text style={styles.description}>{description}</Text>
        
        <View style={styles.progressBarContainer}>
          <View 
            style={[styles.progressBar, { width: `${(filteredSections.filter(s => isSectionCompleted(s)).length / filteredSections.length) * 100}%` }]} 
          />
        </View>
        <Text style={styles.progressText}>
          {filteredSections.filter(s => isSectionCompleted(s)).length} of {filteredSections.length} sections completed
        </Text>
        
        <Text style={styles.sectionTitle}>Video Sections</Text>
        
        {filteredSections.map((section) => (
          <TouchableOpacity 
            key={section.name}
            style={styles.sectionItem}
            onPress={() => handleSectionPress(section)}
          >
            <View style={styles.sectionItemContent}>
              <View style={styles.sectionTypeIcon}>
                <Ionicons 
                  name={getSectionIcon(section)} 
                  size={24} 
                  color={colors.primary} 
                />
              </View>
              
              <View style={styles.sectionItemText}>
                <Text style={styles.sectionItemTitle}>{section.title?.en || section.name}</Text>
                {section.description?.en && (
                  <Text style={styles.sectionItemDescription} numberOfLines={1}>
                    {section.description.en}
                  </Text>
                )}
              </View>
              
              <View style={styles.sectionItemStatus}>
                {isSectionCompleted(section) ? (
                  <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                ) : (
                  <Ionicons name="ellipse-outline" size={24} color={colors.divider} />
                )}
              </View>
            </View>

            {isSectionCompleted(section) && (section.type === 'project_video' || section.type === 'picture') && (
              <View style={styles.sectionItemActions}>
                <TouchableOpacity 
                  style={styles.previewButton}
                  onPress={(e) => { 
                    e.stopPropagation();
                    handlePreviewVideo(section); 
                  }}
                >
                  <Ionicons name="play" size={16} color={colors.primary} />
                  <Text style={styles.previewButtonText}>Preview</Text>
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
      
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.createButton,
            !areAllSectionsCompleted() && styles.disabledButton,
            isCompiling && styles.disabledButton
          ]}
          disabled={!areAllSectionsCompleted() || isCompiling}
          onPress={handleCompileVideo}
        >
          <Text style={styles.createButtonText}>
            {isCompiling ? 'Creating Video...' : 'Create My Video'}
          </Text>
          {isCompiling && <ActivityIndicator size="small" color="white" style={styles.loader} />}
        </TouchableOpacity>
      </View>

      {renderActiveFormSection()}
      {renderActiveMusicSection()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  backButton: {
    padding: spacing.s,
    marginRight: spacing.s,
  },
  title: {
    ...typography.title,
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.m,
  },
  contentContainer: {
    paddingBottom: 100,
  },
  orientationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.m,
  },
  orientationText: {
    ...typography.body,
    marginLeft: spacing.s,
  },
  description: {
    ...typography.body,
    marginTop: spacing.m,
    marginBottom: spacing.m,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: colors.divider,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: spacing.m,
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: 4,
  },
  progressText: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: spacing.s,
    color: colors.textSecondary,
    marginBottom: spacing.m,
  },
  sectionTitle: {
    ...typography.subtitle,
    marginTop: spacing.m,
    marginBottom: spacing.m,
  },
  sectionItem: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    marginBottom: spacing.m,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 1,
    elevation: 1,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  sectionItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.m,
  },
  sectionTypeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.m,
  },
  sectionItemText: {
    flex: 1,
  },
  sectionItemTitle: {
    ...typography.subtitle,
    marginBottom: spacing.xs,
  },
  sectionItemDescription: {
    ...typography.caption,
  },
  sectionItemStatus: {
    marginLeft: spacing.m,
  },
  sectionItemActions: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    padding: spacing.s,
    alignItems: 'center',
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
    borderRadius: 4,
    backgroundColor: colors.primary + '10',
  },
  previewButtonText: {
    ...typography.caption,
    color: colors.primary,
    marginLeft: 3,
    fontWeight: '500',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.m,
    paddingBottom: spacing.m + 5,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.background,
  },
  createButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.m + 2,
    paddingHorizontal: spacing.m,
    borderRadius: 12,
    minHeight: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  disabledButton: {
    opacity: 0.5,
  },
  createButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  loader: {
    marginLeft: spacing.m,
  },
  loadingText: {
    ...typography.body,
    marginTop: spacing.m,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    marginBottom: spacing.l,
  },
  backButtonText: {
    ...typography.body,
    color: colors.primary,
  },

  formModalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  formTitle: {
    ...typography.title,
    flex: 1,
    marginRight: spacing.m,
  },
  formContainer: {
    flex: 1,
  },
  formFooter: {
    padding: spacing.m,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
  },
  formSubmitButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.m,
    borderRadius: 8,
    alignItems: 'center',
  },
  formSubmitButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  placeholderText: {
    ...typography.body,
    marginVertical: spacing.m,
    textAlign: 'center',
  },
  tempCompleteButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    borderRadius: 8,
    marginTop: spacing.l,
  },
  tempCompleteButtonText: {
    color: colors.surface,
    fontWeight: 'bold',
  },
});

export default TemplateDetailScreen;
