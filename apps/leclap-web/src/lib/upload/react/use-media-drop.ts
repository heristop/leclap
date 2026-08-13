import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentPropsWithRef,
  type ComponentPropsWithoutRef,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { pickerAccept } from '../core/accept';
import { expandDroppedEntries } from '../core/data-transfer';
import { validateFiles } from '../core/validate';
import type { AcceptSpec, Rejection } from '../core/types';

// Spelled out rather than left to inference so consumers that pass the getters around (MediaDropzone)
// can type their props against the real DOM contract instead of an untyped `Record<string, unknown>`
// bag — renaming or dropping a handler here then fails to compile at the call site.
export type MediaDropRootProps = ComponentPropsWithoutRef<'div'>;
export type MediaDropInputProps = ComponentPropsWithRef<'input'>;

export interface UseMediaDropOptions {
  onDrop: (accepted: File[], rejections: Rejection[]) => void;
  accept?: AcceptSpec;
  /** Bytes. */
  maxSize?: number;
  /** How many more files may be accepted; 0 rejects everything. */
  remaining?: number;
  multiple?: boolean;
  disabled?: boolean;
  onDragEnter?: () => void;
  onDragLeave?: () => void;
}

// Only a drag carrying FILES concerns us. Without this the surface arms for any HTML5 drag — a
// library card, a text selection — and releasing one would call onDrop([], []), which consumers read
// as "a drop happened with nothing in it" and use to clear the error list the user is still reading.
// The Firefox-only type is what react-dropzone matched alongside 'Files'.
const hasFiles = (event: DragEvent): boolean =>
  [...event.dataTransfer.types].some((type) => type === 'Files' || type === 'application/x-moz-file');

export const useMediaDrop = ({
  onDrop,
  accept = [],
  maxSize,
  remaining,
  multiple = false,
  disabled = false,
  onDragEnter,
  onDragLeave,
}: UseMediaDropOptions) => {
  const inputRef = useRef<HTMLInputElement>(null);
  // Depth, not a boolean: dragenter/dragleave fire for every child the pointer crosses, so a boolean
  // flickers off mid-drag. Counting entries and exits is the only stable read of "still over us".
  const depth = useRef(0);
  const [isDragActive, setDragActive] = useState(false);

  // react-dropzone guarded the whole document by default (`preventDropOnDocument`). Without it a file
  // released a few pixels off-target — on the page background, on a disabled zone, on the record
  // button — triggers the browser's default action and navigates the tab to file:///…, tearing down
  // an app whose entire state (recorded takes, form answers, unsaved template edits) lives in memory.
  // Nothing else in the app cancels those events, so the hook keeps owning it.
  useEffect(() => {
    const allow = (event: Event): void => {
      event.preventDefault();
    };

    // Any drop, anywhere, ends the drag: this also unsticks the counter when a drag leaves the window
    // and the final dragleave is never delivered.
    const swallow = (event: Event): void => {
      event.preventDefault();
      depth.current = 0;
      setDragActive(false);
    };

    document.addEventListener('dragover', allow, false);
    document.addEventListener('drop', swallow, false);

    return () => {
      document.removeEventListener('dragover', allow);
      document.removeEventListener('drop', swallow);
    };
  }, []);

  const settle = () => {
    depth.current = 0;
    setDragActive(false);
  };

  const deliver = (files: File[]) => {
    const { accepted, rejections } = validateFiles(files, { accept, maxSize, remaining });
    onDrop(accepted, rejections);
  };

  const deliverDropped = (transfer: DataTransfer) => {
    const fallback = [...transfer.files];
    // Snapshot before yielding: the DataTransfer is neutered as soon as the handler returns.
    const entries = [...transfer.items].map((item) => item.webkitGetAsEntry());

    expandDroppedEntries(entries, fallback)
      .then(deliver)
      .catch(() => {
        deliver(fallback);
      });
  };

  const open = () => {
    if (disabled) return;

    inputRef.current?.click();
  };

  const getRootProps = (): MediaDropRootProps => ({
    role: 'button',
    tabIndex: disabled ? -1 : 0,
    'aria-disabled': disabled,
    onDragEnter: (event: DragEvent) => {
      if (!hasFiles(event)) return;

      event.preventDefault();
      // Counted even while disabled, so a `disabled` flip mid-drag cannot strand the counter above
      // zero and leave the surface stuck in its armed state.
      depth.current += 1;

      if (disabled || depth.current > 1) return;

      setDragActive(true);
      onDragEnter?.();
    },
    onDragOver: (event: DragEvent) => {
      if (!hasFiles(event)) return;

      // Cancelling dragover is what makes this a drop target at all — and what stops the browser
      // navigating to the file. Done even when disabled, so a full zone swallows the drop.
      event.preventDefault();
      event.dataTransfer.dropEffect = disabled ? 'none' : 'copy';
    },
    onDragLeave: (event: DragEvent) => {
      if (!hasFiles(event)) return;

      event.preventDefault();
      depth.current -= 1;

      if (depth.current > 0) return;

      settle();
      onDragLeave?.();
    },
    onDrop: (event: DragEvent) => {
      if (!hasFiles(event)) return;

      event.preventDefault();
      settle();
      onDragLeave?.();

      if (disabled) return;

      deliverDropped(event.dataTransfer);
    },
    onClick: open,
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;

      event.preventDefault();
      open();
    },
  });

  const getInputProps = (): MediaDropInputProps => ({
    ref: inputRef,
    type: 'file',
    accept: pickerAccept(accept),
    multiple,
    disabled,
    // Visually hidden rather than `display: none`, which react-dropzone avoided deliberately: some
    // iOS Safari builds refuse to open the picker for a programmatic click() on a display:none
    // input, and that tap is the whole mobile capture path. tabIndex -1 keeps it out of the tab
    // order — the labelled root is the focus stop.
    tabIndex: -1,
    style: {
      border: 0,
      clipPath: 'inset(50%)',
      height: '1px',
      margin: '-1px',
      overflow: 'hidden',
      padding: 0,
      position: 'absolute' as const,
      whiteSpace: 'nowrap' as const,
      width: '1px',
    },
    // The input sits inside the root, whose onClick opens it — so the programmatic click() would
    // bubble straight back and re-enter open(). react-dropzone stopped it here for the same reason.
    onClick: (event: MouseEvent) => {
      event.stopPropagation();
    },
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      deliver([...(event.target.files ?? [])]);
      // Let the same file be re-picked after a removal.
      event.target.value = '';
    },
  });

  return { getRootProps, getInputProps, isDragActive, open };
};
