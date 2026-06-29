// Shared section header for grouped field editors: an uppercase label + a one-line hint paragraph
// rendered above the rows. Keeps the Global-variables and Partial-variables editors visually identical.

interface FieldGroupHeaderProps {
  label: string;
  hint: string;
}

export const FieldGroupHeader = ({ label, hint }: FieldGroupHeaderProps) => (
  <>
    <span className="block text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
      {label}
    </span>
    <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">{hint}</p>
  </>
);
