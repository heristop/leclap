import { Asset } from 'expo-asset';
import { compileHybrid, type HybridResult } from '@/src/services/compile/compileHybrid';
import type { TemplateDescriptor } from '@/src/types';
import type { CompileRecordedVideos } from '@/src/services/api';
import { buildDescriptor, type EditorState } from '../model/templateEditorModel';

// Compile the current draft on-device with a neutral placeholder clip filling each project_video
// slot (the Expo twin of the web TestRenderButton), then return the engine result. The caller injects
// the bundled placeholder module (a static `import` on its side) so this module stays free of binary
// asset imports — keeping it jest-parseable and testable with a stub.
export async function previewRender(state: EditorState, placeholderClip: number): Promise<HybridResult> {
  const descriptor = buildDescriptor(state) as unknown as TemplateDescriptor;
  const asset = await Asset.fromModule(placeholderClip).downloadAsync();
  const path = asset.localUri ?? asset.uri;

  const recordedVideos: CompileRecordedVideos = {};

  for (const section of descriptor.sections ?? []) {
    if (section.type === 'project_video') {
      recordedVideos[section.name] = { path, orientation: state.orientation };
    }
  }

  return compileHybrid(descriptor, recordedVideos);
}
