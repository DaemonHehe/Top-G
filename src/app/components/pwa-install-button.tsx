"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type PwaInstallButtonProps = {
  label?: string;
  className?: string;
  wrapperClassName?: string;
  fullWidth?: boolean;
};

export function PwaInstallButton({
  label = "Install",
  className = "btn-secondary text-sm font-medium",
  wrapperClassName = "",
  fullWidth = false,
}: PwaInstallButtonProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const ios =
      /iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
      (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
    setIsIos(ios);

    const checkInstalled = () => {
      const standalone =
        window.matchMedia?.("(display-mode: standalone)")?.matches ||
        window.navigator.standalone === true;
      setIsInstalled(Boolean(standalone));
    };

    checkInstalled();

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const canShow = !isInstalled && (Boolean(deferredPrompt) || isIos);
  if (!canShow) return null;

  const handleClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice.catch(() => null);
      setDeferredPrompt(null);
      return;
    }

    if (isIos) {
      setShowHint(true);
      window.setTimeout(() => setShowHint(false), 4000);
    }
  };

  return (
    <div
      className={`relative ${fullWidth ? "w-full" : "inline-flex"} ${wrapperClassName}`.trim()}
    >
      <button type="button" onClick={handleClick} className={`${className} ${fullWidth ? "w-full" : ""}`.trim()}>
        {label}
      </button>
      {showHint && isIos && (
        <span className="absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--text-secondary)] shadow-lg">
          Use Share → Add to Home Screen
        </span>
      )}
    </div>
  );
}
