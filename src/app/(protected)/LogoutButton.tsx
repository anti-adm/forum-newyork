"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    try {
      setLoading(true);
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="px-3 py-1.5 rounded-xl text-xs font-medium
                 border border-white/20 bg-black/40
                 hover:bg-red-500/20 hover:border-red-400
                 transition disabled:opacity-40"
    >
      {loading ? "Выходим..." : "Выйти"}
    </button>
  );
}