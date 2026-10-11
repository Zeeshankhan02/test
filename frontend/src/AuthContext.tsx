import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, refreshSession } from "./api";
import type { Role, User, Volunteer } from "./types";

type VolunteerCreated = { volunteer: Volunteer; password: string };
type AuthValue = {
  user: User | null;
  ready: boolean;
  isAuthenticated: boolean;
  volunteers: Volunteer[];
  volunteersLoading: boolean;
  volunteersError: string;
  reloadVolunteers: () => void;
  login: (role: Role, email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  signupStudent: (email: string, password: string) => Promise<User>;
  createVolunteer: (email: string) => Promise<VolunteerCreated>;
  setVolunteerStatus: (
    id: string,
    status: Volunteer["status"],
  ) => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [volunteersLoading, setVolunteersLoading] = useState(false);
  const [volunteersError, setVolunteersError] = useState("");

  const reloadVolunteers = useCallback(() => {
    if (user?.role !== "admin") return;
    setVolunteersLoading(true);
    setVolunteersError("");
    void api
      .volunteers()
      .then(setVolunteers)
      .catch((cause: unknown) =>
        setVolunteersError(
          cause instanceof Error ? cause.message : "Could not load volunteers.",
        ),
      )
      .finally(() => setVolunteersLoading(false));
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    void refreshSession().then((session) => {
      if (!cancelled) {
        setUser(
          session
            ? {
                ...session.user,
                avatar: `https://i.pravatar.cc/150?u=${encodeURIComponent(session.user.email)}`,
              }
            : null,
        );
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (user?.role !== "admin") {
      setVolunteers([]);
      setVolunteersLoading(false);
      return;
    }
    reloadVolunteers();
  }, [reloadVolunteers, user]);

  const login = async (role: Role, email: string, password: string) => {
    const signedIn = await api.login(email, password);
    if (signedIn.role !== role) {
      await api.logout();
      return false;
    }
    setUser(signedIn);
    return true;
  };
  const logout = async () => {
    await api.logout().catch(() => undefined);
    setUser(null);
    setVolunteers([]);
  };
  const signupStudent = async (email: string, password: string) => {
    const name =
      email
        .trim()
        .split("@")[0]
        .replace(/[._-]+/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Student";
    const signedUp = await api.signup(name, email.trim(), password);
    setUser(signedUp);
    return signedUp;
  };
  const createVolunteer = async (email: string) => {
    const password = `${crypto.randomUUID()}${crypto.randomUUID().slice(0, 4)}`;
    const created = await api.createVolunteer(email, password);
    setVolunteers((current) => [created.volunteer, ...current]);
    return created;
  };
  const setVolunteerStatus = async (
    id: string,
    status: Volunteer["status"],
  ) => {
    await api.setVolunteerStatus(id, status);
    setVolunteers((current) =>
      current.map((item) => (item.id === id ? { ...item, status } : item)),
    );
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        ready,
        isAuthenticated: !!user,
        volunteers,
        volunteersLoading,
        volunteersError,
        reloadVolunteers,
        login,
        logout,
        signupStudent,
        createVolunteer,
        setVolunteerStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
