const stats = [
  { value: '100%', label: 'Runs in your browser' },
  { value: '0', label: 'Files uploaded' },
  { value: '∞', label: 'Projects, always free' },
];

export const AboutStats = () => {
  return (
    <div className="glass-panel-dark rounded-2xl px-6 py-7 mb-16 fade-in" style={{ animationDelay: '0.1s' }}>
      <dl className="flex flex-col sm:flex-row items-stretch justify-around gap-6 sm:gap-4 text-center divide-y sm:divide-y-0 sm:divide-x divide-foreground/10">
        {stats.map((stat) => (
          <div key={stat.label} className="flex-1 pt-6 sm:pt-0 first:pt-0 sm:px-4">
            <dt className="text-4xl md:text-5xl font-bold brand-gradient-text font-display leading-none">
              {stat.value}
            </dt>
            <dd className="mt-2 text-sm text-gray-400 uppercase tracking-wide">{stat.label}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};
