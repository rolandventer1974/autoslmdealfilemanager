export interface AuthUser {
  id: number;
  username: string;
  name: string;
  email: string | null;
  role: string;
  dealerCode: string;
  levelId: string | null;
  rid: string | null;
  retailerName: string | null;
  mobile: string | null;
  mobileLogo: string | null;
  createdAt: string;
}

const TOKEN_KEY = "autoslm_token";
const USER_KEY = "autoslm_user";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setSession(token: string, user: AuthUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken() && !!getUser();
}

export function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
