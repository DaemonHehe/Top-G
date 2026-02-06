export default function RootLoading() {
  return (
    <div className="min-h-screen bg-[var(--background-muted)]">
      <div className="mx-auto max-w-6xl px-6 py-12 space-y-6 animate-fade-up">
        <div className="h-10 w-40 skeleton" />
        <div className="h-6 w-2/3 skeleton" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton-card p-6">
              <div className="h-5 w-24 skeleton mb-3" />
              <div className="h-3 w-full skeleton" />
              <div className="h-3 w-4/5 skeleton mt-2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
