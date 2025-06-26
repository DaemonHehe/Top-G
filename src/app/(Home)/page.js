"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/check");
        if (response.ok) {
          setIsAuthenticated(true);
          router.push("/dashboard");
        }
      } catch (error) {
        console.log("Not authenticated", error);
      }
    };

    checkAuth();
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Daily Task Tracker
          </h1>
          <p className="text-gray-600 mb-8">
            Stay organized and productive every day
          </p>

          <div className="space-y-4">
            <Link
              href="/register"
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition duration-200 block text-center"
            >
              Get Started
            </Link>

            <Link
              href="/login"
              className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 transition duration-200 block text-center"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
