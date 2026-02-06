"use client";

import { useState } from "react";
import NavigationBar from "../../components/navigation-bar";

const CONTACT_METHODS = [
  {
    label: "Email",
    value: "1991peacekeeper@gmail.com",
    href: "mailto:1991peacekeeper@gmail.com",
  },
  {
    label: "LinkedIn",
    value: "-",
    href: "",
  },
  {
    label: "Twitter",
    value: "-",
    href: "",
  },
];

export default function ReachOut() {
  const [feedbackForm, setFeedbackForm] = useState({ name: "", email: "", message: "" });
  const [feedbackStatus, setFeedbackStatus] = useState({ state: "idle", message: "" });

  const handleFeedbackChange = (field) => (event) => {
    const value = event.target.value;
    setFeedbackForm((prev) => ({ ...prev, [field]: value }));
    if (feedbackStatus.state !== "idle") {
      setFeedbackStatus({ state: "idle", message: "" });
    }
  };

  const handleFeedbackSubmit = async (event) => {
    event.preventDefault();
    const name = feedbackForm.name.trim();
    const email = feedbackForm.email.trim();
    const message = feedbackForm.message.trim();

    if (!name || !email || !message) {
      setFeedbackStatus({ state: "error", message: "Please complete every field before sending your feedback." });
      return;
    }

    const emailPattern = /[^@\s]+@[^@\s]+\.[^@\s]+/;
    if (!emailPattern.test(email)) {
      setFeedbackStatus({ state: "error", message: "Enter a valid email so we know where to reply." });
      return;
    }

    setFeedbackStatus({ state: "loading", message: "" });

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const errorMessage = data?.message || "We couldn't send your feedback. Try again in a moment.";
        throw new Error(errorMessage);
      }

      setFeedbackStatus({ state: "success", message: data?.message || "Thanks for reaching out! We'll get back to you shortly." });
      setFeedbackForm({ name: "", email: "", message: "" });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "We couldn't send your feedback. Try again in a moment.";
      setFeedbackStatus({ state: "error", message: messageText });
    }
  };

  const isSubmitting = feedbackStatus.state === "loading";

  return (
    <div className="min-h-screen bg-[var(--background-muted)] animate-fade-up">
      <NavigationBar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        <header className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center sm:p-8 sm:text-left" style={{ boxShadow: "var(--card-shadow)" }}>
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            Feedback & Questions
          </span>
          <h1 className="mt-4 text-3xl font-bold text-[var(--text-primary)]">
            We&apos;d love to hear from you
          </h1>
          <p className="mt-3 text-[var(--text-secondary)]">
            Share your thoughts, report an issue, or tell us how we can improve. Your feedback helps us build a better experience.
          </p>
        </header>

        <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6" style={{ boxShadow: "var(--card-shadow)" }}>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Ways to Reach Us</h2>
            <ul className="mt-4 space-y-4 text-sm text-[var(--text-secondary)]">
              {CONTACT_METHODS.map((method) => (
                <li key={method.label} className="flex flex-col">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    {method.label}
                  </span>
                  <a href={method.href} className="text-base font-medium text-[var(--text-primary)] hover:text-[var(--accent)]" target="_blank" rel="noreferrer">
                    {method.value}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6" style={{ boxShadow: "var(--card-shadow)" }}>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Common Topics</h2>
              <ul className="mt-4 list-disc space-y-3 pl-5 text-sm text-[var(--text-secondary)]">
                <li>Share your product experience or a testimonial.</li>
                <li>Report a bug or suggest a feature.</li>
                <li>Ask for guidance on using the platform.</li>
              </ul>
          </div>
        </section>

        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center sm:p-8 sm:text-left" style={{ boxShadow: "var(--card-shadow)" }}>
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">Send Us Your Feedback</h2>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            Fill out the form and we&apos;ll respond as soon as possible.
          </p>
          <form className="mt-6 space-y-4" onSubmit={handleFeedbackSubmit} noValidate>
            <div>
              <label className="text-sm font-medium text-[var(--text-secondary)]" htmlFor="contact-name">
                Name
              </label>
              <input
                id="contact-name"
                type="text"
                placeholder="Jane Doe"
                className="mt-1 w-full"
                value={feedbackForm.name}
                onChange={handleFeedbackChange("name")}
                disabled={isSubmitting}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--text-secondary)]" htmlFor="contact-email">
                Email
              </label>
              <input
                id="contact-email"
                type="email"
                placeholder="you@example.com"
                className="mt-1 w-full"
                value={feedbackForm.email}
                onChange={handleFeedbackChange("email")}
                disabled={isSubmitting}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--text-secondary)]" htmlFor="contact-message">
                Message
              </label>
              <textarea
                id="contact-message"
                className="mt-1 h-32 w-full resize-none"
                placeholder="Share what you are building and where you need support."
                value={feedbackForm.message}
                onChange={handleFeedbackChange("message")}
                disabled={isSubmitting}
                required
              />
            </div>
            <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
              <button type="submit" className="btn-primary sm:w-auto" disabled={isSubmitting}>
                {isSubmitting ? "Sending..." : "Send feedback"}
              </button>
              <div className="space-y-1 text-xs">
                {feedbackStatus.message && (
                  <p className={feedbackStatus.state === "error" ? "text-[var(--danger)]" : "text-[var(--success-text)]"}>
                    {feedbackStatus.message}
                  </p>
                )}
                <p className="text-[var(--text-muted)]">We usually reply within two business days.</p>
              </div>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
