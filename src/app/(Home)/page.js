"use client";

import { useEffect, useMemo, useState } from "react";
import NavigationBar from "../components/navigation-bar";

function sanitizeQuote(text) {
  if (typeof text !== "string") return "";
  let result = text.trim();
  if (!result) return "";
  const boundaryChars = new Set([
    String.fromCharCode(34),
    String.fromCharCode(39),
    "?",
  ]);
  const leadingChar = result.charAt(0);
  if (boundaryChars.has(leadingChar)) {
    result = result.slice(1).trimStart();
  }
  const trailingChar = result.charAt(result.length - 1);
  if (boundaryChars.has(trailingChar)) {
    result = result.slice(0, -1).trimEnd();
  }
  return result;
}

const INITIAL_COACH_MESSAGE = {
  role: "coach",
  text: "State the mission. I'll hand you the pressure plan.",
};

export default function Home() {
  const [user, setUser] = useState(null);
  const [quote, setQuote] = useState("");
  const [quoteStatus, setQuoteStatus] = useState("loading");
  const [quoteError, setQuoteError] = useState("");
  const [conversation, setConversation] = useState([INITIAL_COACH_MESSAGE]);
  const [prompt, setPrompt] = useState("");
  const [coachStatus, setCoachStatus] = useState("idle");

  const dayStamp = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      }),
    [],
  );

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchUser = async () => {
      try {
        const response = await fetch("/api/users", { credentials: "include" });
        if (!response.ok) {
          if (!cancelled) setUser(null);
          return;
        }
        const payload = await response.json();
        if (!cancelled) {
          setUser(payload?.user ?? null);
        }
      } catch (error) {
        console.error("Home user fetch error:", error);
        if (!cancelled) {
          setUser(null);
        }
      }
    };

    fetchUser();

    return () => {
      cancelled = true;
    };
  }, []);

  const summaryContext = useMemo(() => "Keep it focused, masculine, and execution-driven.", []);

  const requestQuote = async (signal) => {
    setQuoteStatus("loading");
    setQuoteError("");
    try {
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: { summary: summaryContext },
        }),
        signal,
      });

      if (!response.ok) {
        throw new Error(`Quote status ${response.status}`);
      }

      const data = await response.json();
      setQuote(sanitizeQuote(data?.quote));
      setQuoteStatus("success");
    } catch (error) {
      if (error.name === "AbortError") return;
      console.error("Quote fetch error:", error);
      setQuoteStatus("error");
      setQuoteError("Couldn't reach the quote engine. Try again.");
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    requestQuote(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaryContext]);

  const handleRegenerateQuote = () => {
    requestQuote();
  };

  const handleCoachSubmit = async (event) => {
    event.preventDefault();
    const cleaned = prompt.trim();
    if (!cleaned) {
      return;
    }

    const userMessage = { role: "user", text: cleaned };
    const historyForRequest = [...conversation];

    setConversation((prev) => [...prev, userMessage]);
    setPrompt("");
    setCoachStatus("loading");

    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: cleaned,
          history: historyForRequest,
        }),
      });

      if (!response.ok) {
        throw new Error(`Coach status ${response.status}`);
      }

      const data = await response.json();
      const reply = data?.message ?? "Execute. Report back when it's done.";
      setConversation((prev) => [...prev, { role: "coach", text: reply }]);
      setCoachStatus("success");
    } catch (error) {
      console.error("Coach console error:", error);
      setConversation((prev) => [
        ...prev,
        { role: "coach", text: "Line dropped. Reset and hit me with the next move." },
      ]);
      setCoachStatus("error");
    }
  };

  const displayName = user?.name ? `, ${user.name}` : "";

  return (
    <div className="min-h-screen bg-[var(--background-muted)] text-[var(--text-primary)]">
      <NavigationBar />
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-16 pt-12 sm:px-6 lg:px-10">
        <header className="flex flex-col items-center gap-4 text-center sm:items-start sm:gap-5 sm:text-left">
          <p className="text-xs uppercase tracking-[0.4em] text-[var(--text-muted)] sm:text-sm sm:tracking-[0.6em]">{dayStamp}</p>
          <h1 className="text-balance text-3xl font-bold sm:text-4xl lg:text-5xl">
            {greeting}
            {displayName}
          </h1>
          <p className="max-w-2xl text-sm text-[var(--text-secondary)] sm:text-base">
            Stand tall. Breathe once. Then move the needle.
          </p>
        </header>

        <main className="mt-14 flex-1 space-y-16">
          <section className="relative isolate overflow-hidden rounded-3xl border border-[var(--border)] bg-gradient-to-br from-[var(--surface)] via-[var(--surface)] to-[var(--surface-muted)] px-6 py-10 text-center shadow-sm sm:px-10 lg:py-14">
            <div className="mx-auto flex max-w-3xl flex-col items-center gap-6">
              <p className="text-xs uppercase tracking-[0.35em] text-[var(--text-muted)] sm:text-sm">Daily hit</p>
              <div className="text-balance text-2xl font-semibold leading-relaxed sm:text-3xl">
                {quoteStatus === "loading" && (
                  <span className="text-[var(--text-secondary)]">Pulling a shot of Top G fire...</span>
                )}
                {quoteStatus === "error" && (
                  <span className="text-[var(--danger)]">{quoteError}</span>
                )}
                {quoteStatus === "success" && quote && (
                  <blockquote className="text-pretty italic text-[var(--text-primary)]">&ldquo;{quote}&rdquo;</blockquote>
                )}
              </div>
              <button
                type="button"
                onClick={handleRegenerateQuote}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-5 py-2 text-sm font-semibold text-[var(--accent)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]/90"
              >
                Reload the spark
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-4 py-8 shadow-sm sm:px-7 lg:px-10 lg:py-10">
            <div className="flex flex-col gap-6 sm:gap-8">
              {/* --- Top Header stays the same --- */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--text-muted)] sm:text-sm">
                      Top G Relay
                    </p>
                    <h2 className="text-2xl font-semibold sm:text-3xl">Direct orders, zero fluff</h2>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.35em]">
                  {coachStatus === "loading" ? (
                    <span className="text-[var(--accent)]">Engaging . . .</span>
                  ) : (
                    <span className="text-[var(--text-muted)]">Live</span>
                  )}
                </div>
              </div>

              {/* --- Main area now styled like chat --- */}
              <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
                <div className="flex-1 flex flex-col rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 sm:p-5">
                  <div className="flex-1 max-h-[320px] sm:max-h-[360px] overflow-y-auto pr-1 space-y-4">
                    {conversation.map((entry, index) => {
                      const isUser = entry.role === "user";
                      return (
                        <div
                          key={`${entry.role}-${index}`}
                          className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm leading-relaxed
                              ${
                                isUser
                                  ? "bg-[var(--accent)] text-white rounded-br-none"
                                  : "bg-[var(--surface)] text-[var(--text)] rounded-bl-none"
                              }`}
                          >
                            {entry.text}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {coachStatus === "error" && (
                    <p className="mt-2 text-sm text-[var(--danger)]">
                      Connection dipped. The last command still stands.
                    </p>
                  )}
                </div>

                {/* --- Input area stays inside the right panel --- */}
                <form onSubmit={handleCoachSubmit} className="w-full space-y-4 lg:w-[360px]">
                  <div className="space-y-2">
                    <label
                      htmlFor="coach-prompt"
                      className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--text-muted)]"
                    >
                      Speak
                    </label>
                    <textarea
                      id="coach-prompt"
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                      placeholder="Tell me what needs to happen next..."
                      rows={4}
                      className="w-full resize-none rounded-2xl border border-[var(--border)]
                                bg-[var(--surface-muted)] px-4 py-3 text-sm leading-relaxed
                                focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white
                              transition hover:bg-[var(--accent)]/90 disabled:cursor-wait disabled:opacity-70"
                    disabled={coachStatus === "loading"}
                  >
                    {coachStatus === "loading" ? "Engaging . . ." : "Send orders"}
                  </button>
                </form>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}





