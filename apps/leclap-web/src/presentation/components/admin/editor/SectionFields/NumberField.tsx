// Shared labelled number input used across the per-kind section field blocks. Delegates to the
// studio-themed Take Counter (ui/NumberField) while preserving the original prop shape so existing
// callers (duration / countdown / image / audio fields) keep working unchanged.
import { NumberField as TakeCounter } from '@/presentation/components/ui/NumberField';

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  inputCls: string;
}

export const NumberField = ({ label, value, onChange, inputCls }: NumberFieldProps) => (
  <TakeCounter label={label} value={value} onChange={onChange} min={1} inputCls={inputCls} />
);
