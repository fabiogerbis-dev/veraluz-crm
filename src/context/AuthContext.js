import { createContext, useContext, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { apiRequest, clearAuthToken, setAuthToken } from "services/apiClient";
import { getInitials } from "utils/formatters";

const AuthContext = createContext();

const PERSISTENT_STORAGE_KEY = "veraluz-crm-auth-v3";
const SESSION_STORAGE_KEY = "veraluz-crm-auth-session-v3";
const LEGACY_STORAGE_KEYS = ["veraluz-crm-auth", "veraluz-crm-auth-v2"];

function clearLegacyStorage() {
  if (typeof window === "undefined") {
    return;
  }

  LEGACY_STORAGE_KEYS.forEach((key) => {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  });
}

function mapApiUser(user) {
  const fullName = user?.fullName || user?.name || "";

  return {
    id: String(user?.id || ""),
    name: fullName,
    email: user?.email || "",
    role: user?.role || "",
    onlyOwnLeads: Boolean(user?.onlyOwnLeads),
    avatar: getInitials(fullName),
  };
}

function readStoredSession() {
  if (typeof window === "undefined") {
    return { token: "", user: null, persistSession: false };
  }

  clearLegacyStorage();

  try {
    const persistentValue = window.localStorage.getItem(PERSISTENT_STORAGE_KEY);

    if (persistentValue) {
      const parsedValue = JSON.parse(persistentValue);
      return {
        token: parsedValue?.token || "",
        user: parsedValue?.user || null,
        persistSession: true,
      };
    }

    const sessionValue = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    const parsedValue = sessionValue ? JSON.parse(sessionValue) : null;

    return {
      token: parsedValue?.token || "",
      user: parsedValue?.user || null,
      persistSession: false,
    };
  } catch (error) {
    return { token: "", user: null, persistSession: false };
  }
}

function persistSession(session, rememberMe) {
  if (typeof window === "undefined") {
    return;
  }

  clearLegacyStorage();
  window.localStorage.removeItem(PERSISTENT_STORAGE_KEY);
  window.sessionStorage.removeItem(SESSION_STORAGE_KEY);

  if (!session?.token) {
    return;
  }

  const storage = rememberMe ? window.localStorage : window.sessionStorage;
  const storageKey = rememberMe ? PERSISTENT_STORAGE_KEY : SESSION_STORAGE_KEY;
  storage.setItem(storageKey, JSON.stringify(session));
}

function clearStoredSession() {
  if (typeof window === "undefined") {
    return;
  }

  clearLegacyStorage();
  window.localStorage.removeItem(PERSISTENT_STORAGE_KEY);
  window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

export function AuthProvider({ children }) {
  const storedSession = useMemo(() => readStoredSession(), []);
  const [currentUser, setCurrentUser] = useState(storedSession.user);
  const [persistSessionState, setPersistSessionState] = useState(storedSession.persistSession);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const bootstrapAuth = async () => {
      if (!storedSession.token) {
        clearAuthToken();
        setAuthReady(true);
        return;
      }

      try {
        setAuthToken(storedSession.token);
        const response = await apiRequest("/api/auth/me");
        const mappedUser = mapApiUser(response.user);

        setCurrentUser(mappedUser);
        persistSession(
          {
            token: storedSession.token,
            user: mappedUser,
          },
          storedSession.persistSession
        );
      } catch (error) {
        clearAuthToken();
        clearStoredSession();
        setCurrentUser(null);
        setPersistSessionState(false);
      } finally {
        setAuthReady(true);
      }
    };

    bootstrapAuth();
  }, [storedSession]);

  async function login(email, password, rememberMe = false) {
    try {
      const response = await apiRequest("/api/auth/login", {
        method: "POST",
        auth: false,
        body: {
          email,
          password,
        },
      });

      const mappedUser = mapApiUser(response.user);

      setAuthToken(response.token);
      setCurrentUser(mappedUser);
      setPersistSessionState(rememberMe);
      persistSession(
        {
          token: response.token,
          user: mappedUser,
        },
        rememberMe
      );

      return { ok: true, user: mappedUser };
    } catch (error) {
      clearAuthToken();
      return {
        ok: false,
        message: error.message || "Credenciais invalidas. Confira o e-mail e a senha.",
      };
    }
  }

  function logout() {
    clearAuthToken();
    clearStoredSession();
    setCurrentUser(null);
    setPersistSessionState(false);
  }

  function hasRole(roles = []) {
    if (!roles.length) {
      return true;
    }

    return Boolean(currentUser && roles.includes(currentUser.role));
  }

  const value = useMemo(
    () => ({
      currentUser,
      isAuthenticated: Boolean(currentUser),
      authReady,
      persistSession: persistSessionState,
      login,
      logout,
      hasRole,
    }),
    [authReady, currentUser, persistSessionState]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
