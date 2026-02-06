export default function LoginLoading() {
  return (
    <div className="min-h-screen bg-[var(--background-muted)]">
      <div className="mx-auto max-w-md px-6 py-16 space-y-6 animate-fade-up">
        <div className="skeleton-card p-6 space-y-3">
          <div className="h-6 w-32 skeleton" />
          <div className="h-10 skeleton" />
          <div className="h-10 skeleton" />
          <div className="h-10 skeleton" />
        </div>
      </div>
    </div>
  );
}
