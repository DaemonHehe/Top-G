export default function ProfileLoading() {
  return (
    <div className="min-h-screen bg-[var(--background-muted)]">
      <div className="mx-auto max-w-6xl px-6 py-10 space-y-6 animate-fade-up">
        <div className="skeleton-card p-6">
          <div className="h-16 w-16 rounded-2xl skeleton" />
          <div className="h-4 w-48 skeleton mt-4" />
          <div className="h-3 w-64 skeleton mt-2" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton-card p-5">
              <div className="h-3 w-24 skeleton" />
              <div className="h-6 w-20 skeleton mt-3" />
            </div>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton-card p-6">
              <div className="h-4 w-32 skeleton" />
              <div className="h-3 w-full skeleton mt-3" />
              <div className="h-3 w-5/6 skeleton mt-2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
