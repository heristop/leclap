import { Square } from '@/presentation/components/icons';
import { Button, type ButtonProps } from '@/presentation/components/ui';
import { cn } from '@/lib/utils';

interface StopButtonProps {
  onClick: () => void;
  label: string;
  size?: ButtonProps['size'];
  className?: string;
}

// Shared "stop the in-browser compile" button, reused by the studio processor and the onboarding
// compile step. A quiet secondary button carrying the transport's red stop square: while a render
// runs, the progress is what the eye should follow, and a glowing red slab under it was the loudest
// thing on screen — an invitation to the one click that throws the render away.
export const StopButton = ({ onClick, label, size = 'md', className }: StopButtonProps) => (
  <Button
    variant="secondary"
    size={size}
    onClick={onClick}
    className={cn(
      'hover:border-[var(--color-error)]/40 hover:bg-[var(--color-error)]/10 [&_svg]:size-3.5 [&_svg]:fill-[var(--color-error)] [&_svg]:text-[var(--color-error)]',
      className
    )}
  >
    <Square /> {label}
  </Button>
);
