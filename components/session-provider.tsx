"use client";

import { createContext, useContext, ReactNode, useMemo } from "react";
import { authClient } from "@/lib/auth-client";

type SessionContextType = {
  session: ReturnType<typeof authClient.useSession>["data"];
  isPending: boolean;
};

const SessionContext = createContext<SessionContextType | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();

  const value = useMemo(() => ({ session, isPending }), [session, isPending]);

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSessionContext() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSessionContext must be used within SessionProvider");
  }
  return context;
}
