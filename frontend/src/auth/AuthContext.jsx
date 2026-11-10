import React, { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);
const KEY = "gather.session";

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
  });

  const save = (data) => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* storage full or blocked */ } setSession(data); };
  const signIn = (data) => save(data);
  const logout = () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } setSession(null); };
  // Merge new profile fields (name, phone) into the logged-in user without logging out.
  const updateUser = (patch) => save({ ...session, user: { ...session.user, ...patch } });

  return (
    <AuthContext.Provider value={{ user: session?.user ?? null, token: session?.token ?? null, signIn, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
