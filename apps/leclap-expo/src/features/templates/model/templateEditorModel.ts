// The template-editor model now lives in the core package, shared verbatim with the web app.
// This file is a thin re-export so the expo create-template screen + its tests keep importing
// from the same path. See packages/leclap-creative-kit/src/editor/templateEditorModel.ts.
//
// NOTE: the shared video section carries `overlays: TextOverlay[]` (the web superset). The expo
// create-template screen still renders a single text input — it maps that to overlays[0] via the
// getPrimaryOverlay/setPrimaryOverlay helpers defined on the screen, keeping this model clean.
export * from '@leclap/creative-kit/editor';
