export default function ReachOutLoading() {
  return (
    <div className="min-h-screen bg-[var(--background-muted)]">
      <div className="mx-auto max-w-4xl px-6 py-10 space-y-6 animate-fade-up">
        <div className="skeleton-card p-6">
          <div className="h-5 w-40 skeleton" />
          <div className="h-3 w-2/3 skeleton mt-3" />
        </div>
        <div className="skeleton-card p-6 space-y-3">
          <div className="h-10 skeleton" />
          <div className="h-10 skeleton" />
          <div className="h-24 skeleton" />
          <div className="h-10 w-40 skeleton" />
        </div>
      </div>
    </div>
  );
}
