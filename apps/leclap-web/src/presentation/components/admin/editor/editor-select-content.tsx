import type { ComponentPropsWithoutRef } from 'react';
import { SelectContent } from '@/presentation/components/ui/select';

// The authoring tools' dropdown list, opened item-aligned. In the shared Select's default popper mode,
// its phone bottom sheet (`max-sm:!fixed …`) renders inside Radix's popper wrapper, whose transform
// makes it the sheet's containing block — so on phones the list collapses to a sliver above the
// viewport. Item-aligned renders without that wrapper: phones get the docked sheet as designed, and
// desktop opens the list over its trigger, the selected option in place.
export const EditorSelectContent = (props: ComponentPropsWithoutRef<typeof SelectContent>) => (
  <SelectContent position="item-aligned" {...props} />
);
