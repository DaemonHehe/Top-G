export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[var(--background-muted)]">
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-6 animate-fade-up">
        <div className="h-8 w-56 skeleton" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton-card p-5">
              <div className="h-3 w-24 skeleton" />
              <div className="h-6 w-20 skeleton mt-3" />
            </div>
          ))}
        </div>
        <div className="skeleton-card p-6">
          <div className="h-4 w-40 skeleton" />
          <div className="h-5 w-2/3 skeleton mt-4" />
          <div className="h-5 w-1/2 skeleton mt-2" />
        </div>
      </div>
    </div>
  );
}
