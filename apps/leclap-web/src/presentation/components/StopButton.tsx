import { Square } from 'lucide-react';
import { Button, type ButtonProps } from '@/presentation/components/ui';
import { cn } from '@/lib/utils';

interface StopButtonProps {
  onClick: () => void;
  label: string;
  size?: ButtonProps['size'];
  className?: string;
}

// Shared "stop the in-browser compile" button, reused by the studio processor and the onboarding
// compile step. Wraps the system Button (danger variant) — keeping its rounded-xl, tap, hover-lift,
// focus ring and sizes — and adds the danger gradient + glow + sheen, the same way `primary` layers
// brand-gradient + glow.
export const StopButton = ({ onClick, label, size = 'md', className }: StopButtonProps) => (
  <Button variant="danger" size={size} onClick={onClick} className={cn('danger-gradient glow-danger sheen', className)}>
    <Square /> {label}
  </Button>
);
