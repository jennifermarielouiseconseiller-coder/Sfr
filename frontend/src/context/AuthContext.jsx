import { createContext, useContext, useEffect, useState } from "react";
import { api, saveToken, clearToken, getToken } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = checking
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setUser(false);
      setReady(true);
      return;
    }
    api
      .get("/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => {
        clearToken();
        setUser(false);
      })
      .finally(() => setReady(true));
  }, []);

  const login = async (identifier, password, remember) => {
    const { data } = await api.post("/auth/login", {
      identifier,
      password,
      remember,
    });
    saveToken(data.token, remember);
    setUser(data.user);
    return data.user;
  };

  const verify = async (phone, email) => {
    const { data } = await api.post("/auth/verify", { phone, email });
    saveToken(data.token, false);
    setUser(data.user);
    return data; // { token, user, invoice_id }
  };

  const logout = () => {
    clearToken();
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, ready, login, verify, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
