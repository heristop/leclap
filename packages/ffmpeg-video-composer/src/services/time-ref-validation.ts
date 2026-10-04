// Descriptor rules for section-local time references ("title.end + 0.2", "50%", "end - 0.5", "beat:12",
// "cue:drop"): the same pass the build runs (core/timing/resolve.ts), on the template's own orientation
// and first locale, reported as validation errors.
//
// - unknown_time_ref: no element with that id, or no such cue, in the section (with a nearest-id hint).
// - circular_time_ref: a chain of references that comes back to itself.
// - unresolvable_time_ref: an anchor that cannot be known before rendering (no global.beats, a section
//   length or start that depends on a probed clip, a beat past the end of an explicit list).
// - negative_time: a reference that lands before the section starts.
// - duplicate_time_id: two elements of one section share an id.

import type { TemplateDescriptor } from '../schemas/template.schemas';
import { resolveMotionDescriptor } from '@/core/motion/tokens';
import { resolveTimeRefs } from '@/core/timing/resolve';

// Structurally the validator's ValidationError, with the optional hint (declared here so the rules
// module can import this one without a cycle).
interface ValidationError {
  path: string;
  message: string;
  code: string;
  hint?: string;
}

export function validateTimeRefs(template: TemplateDescriptor): ValidationError[] {
  // Tokens first, as in the build, so a "$snappy" ease measures like the spring it names.
  const { issues } = resolveTimeRefs(resolveMotionDescriptor(template));

  return issues.map(({ path, code, message, hint }) => ({ path, code, message, ...(hint && { hint }) }));
}
