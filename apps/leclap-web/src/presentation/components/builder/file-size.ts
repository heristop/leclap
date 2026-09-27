const UNITS = [
  { unit: 'gigabyte', size: 1e9 },
  { unit: 'megabyte', size: 1e6 },
  { unit: 'kilobyte', size: 1e3 },
] as const;

// A file size in the viewer's locale ("2.1 MB", "2,1 Mo"), counted in decimal units like the Finder or
// Files app the render is saved into, so the two agree. One decimal while the number is small.
export const formatBytes = (bytes: number, locale: string): string => {
  const match = UNITS.find(({ size }) => bytes >= size);
  const unit = match?.unit ?? 'byte';
  const value = bytes / (match?.size ?? 1);

  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit,
    unitDisplay: 'short',
    maximumFractionDigits: value < 10 ? 1 : 0,
  }).format(value);
};
