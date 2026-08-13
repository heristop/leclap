// The shape of what a drop surface will take. A wildcard group ('video/*') and a concrete group
// ('image/apng') are treated differently when building the <input accept> attribute — see accept.ts.
export interface AcceptGroup {
  mime: string;
  extensions: string[];
}

export type AcceptSpec = AcceptGroup[];

// Kept identical to the codes react-dropzone emitted: collectDropErrors and the upload.* i18n keys
// switch on these strings.
export type RejectionCode = 'file-too-large' | 'file-invalid-type' | 'too-many-files';

export interface RejectionError {
  code: RejectionCode;
  message: string;
}

export interface Rejection {
  file: File;
  errors: RejectionError[];
}
