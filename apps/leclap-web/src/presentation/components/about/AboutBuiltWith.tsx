const stack = [
  { name: 'React 19', note: 'Concurrent UI', accent: 'text-brand-600 dark:text-brand-300' },
  { name: 'FFmpeg.wasm', note: 'Client-side rendering', accent: 'text-secondary-600 dark:text-secondary-300' },
  { name: 'Tailwind CSS 4', note: 'Utility-first styling', accent: 'text-amber-600 dark:text-accent-400' },
];

export const AboutBuiltWith = () => {
  return (
    <div className="mt-16">
      <h2 className="text-center text-sm font-semibold uppercase tracking-[0.18em] text-gray-500 mb-6">Built with</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px overflow-hidden rounded-2xl glass-panel-dark">
        {stack.map((item) => (
          <div
            key={item.name}
            className="px-6 py-5 text-center bg-foreground/0 hover:bg-foreground/5 transition-colors duration-300"
          >
            <p className={`text-lg font-bold font-display ${item.accent}`}>{item.name}</p>
            <p className="text-sm text-gray-500 mt-1">{item.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
