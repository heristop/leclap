// Shared labelled number input used across the per-kind section field blocks.
import { useId } from 'react';

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  inputCls: string;
}

export const NumberField = ({ label, value, onChange, inputCls }: NumberFieldProps) => {
  const numberId = useId();

  return (
    <div>
      <label htmlFor={numberId} className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
        {label}
      </label>
      <input
        id={numberId}
        type="number"
        min={1}
        className={inputCls}
        value={value}
        onChange={(e) => {
          onChange(Number(e.target.value));
        }}
      />
    </div>
  );
};
