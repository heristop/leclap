// The single shared template-editor model consumed by BOTH apps (web Builder + expo
// create-template). See ./templateEditorModel for the editor-friendly section model and its
// bidirectional mapping to a core TemplateDescriptor. Pure — no React/DOM/RN dependency.
export * from './templateEditorModel';
