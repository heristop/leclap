// The template-editor model now lives in the core package, shared verbatim with the expo app.
// This file is a thin re-export so the web Builder + its tests keep importing from the same path.
// See packages/creative-kit/src/editor/templateEditorModel.ts.
export * from '@leclap/creative-kit/editor';
