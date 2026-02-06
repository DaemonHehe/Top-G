export default function FocusLoading() {
  return (
    <div className="min-h-screen bg-[var(--background-muted)]">
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-6 animate-fade-up">
        <div className="skeleton-card p-6">
          <div className="h-5 w-40 skeleton" />
          <div className="h-3 w-2/3 skeleton mt-3" />
        </div>
        <div className="skeleton-card p-8">
          <div className="h-24 w-full skeleton" />
          <div className="grid grid-cols-3 gap-3 mt-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 skeleton" />
            ))}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton-card p-5">
              <div className="h-3 w-20 skeleton" />
              <div className="h-6 w-16 skeleton mt-3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
