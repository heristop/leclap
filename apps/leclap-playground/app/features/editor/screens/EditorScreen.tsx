import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FormSection from '../components/FormSection';
import { Template, Section, Project } from '@/app/types';
import { colors, spacing, typography } from '@/app/styles/theme';
import { fetchTemplateByName, saveProject, compileVideo, getProjectById } from '../../../services/api';

import { useRouter, useLocalSearchParams } from 'expo-router';

export const EditorScreen = ({ route, navigation }) => {
  const { templateName, projectId } = route.params;
  const params = useLocalSearchParams();
  const router = useRouter();
  
  const [template, setTemplate] = useState<Template | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [activeSection, setActiveSection] = useState<Section | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCompiling, setIsCompiling] = useState(false);
  
  useEffect(() => {
    loadData();
  }, [templateName, projectId]);
  
  const loadData = async () => {
    setIsLoading(true);
    try {
      // Fetch template data
      const templateData = await fetchTemplateByName(templateName);
      setTemplate(templateData);
      
      // If projectId exists, load existing project
      if (projectId) {
        const existingProject = await getProjectById(projectId);
        if (existingProject) {
          setProject(existingProject);
        } else {
          // If project doesn't exist, create new one
          createNewProject(templateData);
        }
      } else {
        // Create new project
        createNewProject(templateData);
      }
      
    } catch (error) {
      console.error('Failed to load data:', error);
      Alert.alert(
        'Error',
        'Failed to load template data. Please try again.'
      );
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
    
    // Save to storage
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
      
      // Auto-save project
      setTimeout(() => {
        saveProject(updatedProject);
      }, 500);
      
      return updatedProject;
    });
  };
  
  const isSectionCompleted = (section: Section): boolean => {
    if (!project) return false;
    
    if (section.type === 'project_video') {
      return !!project.recordedVideos[section.name];
    } else if (section.type === 'form') {
      const fields = section.options?.fields || [];
      return fields.every(field => !!project.formData[field.name]);
    } else if (section.type === 'music') {
      // Check if we have a music selection
      return !!project.formData[`music_${section.name}`];
    } else if (section.type === 'picture') {
      return !!project.recordedVideos[section.name];
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
      // Replace template variables with form data
      const processedTemplate = JSON.parse(JSON.stringify(template.content));
      
      // Replace variables in template string representation
      let templateString = JSON.stringify(processedTemplate);
      Object.entries(project.formData).forEach(([key, value]) => {
        const placeholder = `{{ ${key} }}`;
        templateString = templateString.replace(new RegExp(placeholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), value);
      });
      
      // Parse back to object
      const finalTemplate = JSON.parse(templateString);
      
      // Compile video
      const result = await compileVideo(finalTemplate, project.recordedVideos);
      
      if (result.success) {
        // Update project with output video
        const updatedProject = {
          ...project,
          outputVideoUri: result.outputUri,
          status: 'completed' as 'completed',
          updatedAt: new Date().toISOString(),
        };
        
        setProject(updatedProject);
        saveProject(updatedProject);
      } else {
        // Handle compilation error
        Alert.alert(
          'Compilation Failed',
          result.error || 'An error occurred during video compilation.'
        );
      }
    } catch (error) {
      console.error('Error during compilation:', error);
      Alert.alert(
        'Compilation Error',
        'An unexpected error occurred. Please try again.'
      );
    } finally {
      setIsCompiling(false);
    }
  };
  
  if (isLoading || !template || !project) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading editor...</Text>
      </View>
    );
  }

  // Filter for supported section types only
  const filteredSections = (template.content.sections || []).filter(section => 
    ['project_video', 'form', 'music', 'picture'].includes(section.type)
  );
  
  // Render the active section
  const renderActiveSection = () => {
    if (!activeSection) return null;

    switch (activeSection.type) {
      case 'project_video':
      case 'picture':
        // Instead of rendering directly, we'll navigate to our standalone record route
        return (
          <TouchableOpacity 
            style={styles.startRecordingButton}
            onPress={() => {
              // Navigate to the standalone record screen with proper orientation
              router.push({
                pathname: '/record',
                params: {
                  orientation: template.content.global?.orientation || 'portrait',
                  sectionName: activeSection.name,
                  sectionType: activeSection.type
                }
              });
            }}
          >
            <Ionicons name="videocam" size={32} color={colors.surface} />
            <Text style={styles.startRecordingText}>Start Recording</Text>
          </TouchableOpacity>
        );
      case 'form':
        return (
          <View style={styles.formContainer}>
            <FormSection
              section={activeSection}
              formData={project.formData}
              onFormDataChange={handleFormDataChange}
            />
          </View>
        );
      case 'music':
        return (
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
                      [`music_${activeSection.name}`]: 'default',
                    },
                    updatedAt: new Date().toISOString(),
                  };
                  setProject(updatedProject);
                  saveProject(updatedProject);
                }
                setActiveSection(null);
              }}
            >
              <Text style={styles.tempCompleteButtonText}>Use Default Music</Text>
            </TouchableOpacity>
          </View>
        );
      default:
        return (
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderText}>This section type is not supported yet</Text>
            <TouchableOpacity style={styles.backButton} onPress={() => setActiveSection(null)}>
              <Text style={styles.backButtonText}>Back to Sections</Text>
            </TouchableOpacity>
          </View>
        );
    }
  };
  
  // For all other non-recording active sections, render them full screen
  if (activeSection) {
    return (
      <View style={styles.fullscreenContainer}>
        <StatusBar hidden={false} backgroundColor="transparent" translucent />
        
        {/* Back button */}
        <TouchableOpacity 
          style={styles.fullscreenBackButton}
          onPress={() => setActiveSection(null)}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        
        {/* Section title */}
        <View style={styles.fullscreenTitleContainer}>
          <Text style={styles.fullscreenTitle}>{activeSection.title?.en || activeSection.name}</Text>
        </View>
        
        {renderActiveSection()}
      </View>
    );
  }
  
  // Otherwise, render the section list
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{template.name.replace('.json', '')}</Text>
      </View>
      
      <ScrollView style={styles.content}>
        <View style={styles.sectionListContainer}>
          <Text style={styles.sectionListTitle}>Sections</Text>
          <Text style={styles.sectionListDescription}>Tap on a section to edit</Text>
          
          {filteredSections.map((section) => (
            <TouchableOpacity 
              key={section.name}
              style={styles.sectionItem}
              onPress={() => setActiveSection(section)}
            >
              <View style={styles.sectionItemContent}>
                {/* Section type icon */}
                <View style={styles.sectionTypeIcon}>
                  <Ionicons 
                    name={
                      section.type === 'project_video' ? 'videocam' : 
                      section.type === 'form' ? 'document-text' : 
                      section.type === 'music' ? 'musical-notes' :
                      section.type === 'picture' ? 'image' : 'document'
                    } 
                    size={24} 
                    color={colors.primary} 
                  />
                </View>
                
                {/* Section title and description */}
                <View style={styles.sectionItemText}>
                  <Text style={styles.sectionItemTitle}>{section.title?.en || section.name}</Text>
                  {section.description?.en && (
                    <Text style={styles.sectionItemDescription} numberOfLines={1}>
                      {section.description.en}
                    </Text>
                  )}
                </View>
                
                {/* Completion status */}
                <View style={styles.sectionItemStatus}>
                  {isSectionCompleted(section) ? (
                    <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                  ) : (
                    <Ionicons name="ellipse-outline" size={24} color={colors.divider} />
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.compileButton,
            !areAllSectionsCompleted() && styles.disabledButton,
            isCompiling && styles.disabledButton
          ]}
          disabled={!areAllSectionsCompleted() || isCompiling}
          onPress={handleCompileVideo}
        >
          <Text style={styles.compileButtonText}>
            {isCompiling ? 'Creating Video...' : 'Create My Video'}
          </Text>
          {isCompiling && <ActivityIndicator size="small" color="white" style={styles.loader} />}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    ...typography.body,
    marginTop: spacing.m,
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
  },
  title: {
    ...typography.title,
    flex: 1,
    marginLeft: spacing.m,
  },
  content: {
    flex: 1,
  },
  sectionListContainer: {
    padding: spacing.m,
  },
  sectionListTitle: {
    ...typography.title,
    marginBottom: spacing.s,
  },
  sectionListDescription: {
    ...typography.caption,
    marginBottom: spacing.m,
  },
  sectionItem: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    marginBottom: spacing.m,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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
  footer: {
    padding: spacing.m,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  compileButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
    padding: spacing.m,
    borderRadius: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  compileButtonText: {
    color: colors.surface,
    fontWeight: 'bold',
    fontSize: 16,
  },
  loader: {
    marginLeft: spacing.m,
  },
  
  // Fullscreen styles
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9000,
  },
  fullscreenBackButton: {
    position: 'absolute',
    top: 15,
    left: 15,
    zIndex: 100,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
  fullscreenTitleContainer: {
    position: 'absolute',
    top: 15,
    left: 60,
    right: 15,
    zIndex: 100,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
    paddingHorizontal: 15,
  },
  fullscreenTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  
  // Container styles for different section types
  formContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
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
  backButtonText: {
    ...typography.body,
    color: colors.primary,
    marginTop: spacing.m,
  },
  startRecordingButton: {
    backgroundColor: colors.primary,
    padding: spacing.l,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: spacing.xl,
  },
  startRecordingText: {
    ...typography.subtitle,
    color: colors.surface,
    marginLeft: spacing.m,
    fontWeight: 'bold',
  },
});

export default EditorScreen;