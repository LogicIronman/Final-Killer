import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api, clearToken, getToken, setToken } from "./api";
import type { User } from "./types";

type Mode = "loading" | "authenticated" | "guest" | "anonymous";

interface AuthContextValue {
  mode: Mode;
  user: User | null;
  isGuest: boolean;
  isAdmin: boolean;
  login(username: string, password: string): Promise<void>;
  register(username: string, password: string): Promise<void>;
  enterGuest(): void;
  logout(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<Mode>("loading");

  useEffect(() => {
    if (!getToken()) {
      setMode("anonymous");
      return;
    }

    api
      .me()
      .then((result) => {
        setUser(result.user);
        setMode("authenticated");
      })
      .catch(() => {
        clearToken();
        setMode("anonymous");
      });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      mode,
      user,
      isGuest: mode === "guest",
      isAdmin: mode === "authenticated" && user?.role === "admin",
      async login(username, password) {
        const result = await api.login(username, password);
        setToken(result.token);
        setUser(result.user);
        setMode("authenticated");
      },
      async register(username, password) {
        const result = await api.register(username, password);
        setToken(result.token);
        setUser(result.user);
        setMode("authenticated");
      },
      enterGuest() {
        clearToken();
        setUser(null);
        setMode("guest");
      },
      logout() {
        clearToken();
        setUser(null);
        setMode("anonymous");
      }
    }),
    [mode, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return value;
}
