"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function GoogleLoginClient() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    // Dynamically load Google Identity Services script
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    script.onload = () => {
      if (window.google?.accounts?.id) {
        // Initialize Google Identity Services with your Client ID
        window.google.accounts.id.initialize({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
          auto_select: false,
        });

        // Render the "Sign in with Google" button
        const buttonContainer = document.getElementById("googleSignInButton");
        if (buttonContainer) {
          window.google.accounts.id.renderButton(buttonContainer, {
            theme: "outline",
            size: "large",
          });
        }

        // Display One-Tap prompt (shows when user is not signed into Google)
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            // One-Tap UI not available; the button will handle authentication
          }
        });
      }
    };

    return () => {
      // Cleanup: remove script on component unmount
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  const handleCredentialResponse = async (response) => {
    setIsLoading(true);
    setError("");

    try {
      // Send the ID token to the backend for verification and user creation/login
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Include cookies
        body: JSON.stringify({
          idToken: response.credential,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // Success: redirect to dashboard
        router.replace("/dashboard");
        router.refresh();
      } else {
        // Show error message from backend
        setError(data.message || "Google login failed");
      }
    } catch (err) {
      console.error("Google login request failed:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Error message display */}
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Google Sign-In button container */}
      <div id="googleSignInButton" className="flex justify-center lg:justify-start" />

      {/* Divider with "Or continue with email" text */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[var(--border)]"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-[var(--surface)] px-2 text-[var(--text-secondary)]">
            Or continue with email
          </span>
        </div>
      </div>
    </div>
  );
}
