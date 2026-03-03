"use client";

import { createContext, useContext, useState, useCallback } from "react";

interface AdminAuthState {
  csrfToken: string;
  setCsrfToken: (token: string) => void;
  /**
   * Build fetch headers for admin API calls.
   * Automatically includes the CSRF token for mutating requests.
   */
  adminHeaders: (method?: string) => Record<string, string>;
}

const AdminAuthContext = createContext<AdminAuthState | null>(null);

export function AdminAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [csrfToken, setCsrfToken] = useState("");

  const adminHeaders = useCallback(
    (method = "GET"): Record<string, string> => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      // Include CSRF token on mutating requests
      if (method !== "GET" && csrfToken) {
        headers["X-CSRF-Token"] = csrfToken;
      }
      return headers;
    },
    [csrfToken]
  );

  return (
    <AdminAuthContext.Provider value={{ csrfToken, setCsrfToken, adminHeaders }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthState {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  }
  return context;
}
