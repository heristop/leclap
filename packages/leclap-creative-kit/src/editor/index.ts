// The single shared template-editor model consumed by BOTH apps (web Builder + expo
// create-template). See ./templateEditorModel for the editor-friendly section model and its
// bidirectional mapping to a core TemplateDescriptor. Pure — no React/DOM/RN dependency.
export * from './templateEditorModel';

// Pure, UI-free field-level helpers shared by both apps' editors.
export * from './speed-rate';
export * from './capture-modes';
export * from './overlay-flip';

// Generic JSON-schema walker primitives (web docs + control-metadata both build on these) and the
// schema-derived control-metadata registry for the six parity features.
export * from './schema-walk';
export * from './control-metadata';
