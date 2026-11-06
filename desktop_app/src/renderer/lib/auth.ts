/**
 * Auth context — single source of truth for the current user + permissions.
 * Persists the user in localStorage so the app reloads to the same page.
 */
import type { User, Role } from '../../shared/types';
import { authApi } from './api';

const USER_KEY = 'guidance.user';
const THEME_KEY = 'guidance.theme';

let currentUser: User | null = null;
let roles: Role[] = [];
const listeners = new Set<(u: User | null) => void>();

function notify(): void {
  for (const fn of listeners) fn(currentUser);
}

export function getUser(): User | null {
  if (currentUser) return currentUser;
  try {
    const cached = localStorage.getItem(USER_KEY);
    if (cached) {
      currentUser = JSON.parse(cached);
      return currentUser;
    }
  } catch { /* ignore */ }
  return null;
}

export function setUser(user: User | null): void {
  currentUser = user;
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
  notify();
}

export function onAuthChange(fn: (u: User | null) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export async function fetchMe(): Promise<User | null> {
  try {
    const res = await authApi.me();
    if (res.success && res.data?.user) {
      setUser(res.data.user);
      return res.data.user;
    }
  } catch {
    setUser(null);
  }
  return null;
}

export async function fetchRoles(): Promise<Role[]> {
  if (roles.length) return roles;
  try {
    const res = await authApi.roles();
    if (res.success && res.data) roles = res.data;
  } catch { /* ignore */ }
  return roles;
}

// Permission helpers
export function can(user: User | null, permission: string): boolean {
  if (!user) return false;
  if (user.is_superuser) return true;
  const role = user.role?.name;
  if (!role) return false;
  const matrix: Record<string, string[]> = {
    'users.view': ['Administrator'],
    'users.manage': ['Administrator'],
    'students.view': ['Administrator', 'Guidance Staff', 'Counselor'],
    'students.manage': ['Administrator', 'Guidance Staff'],
    'counseling.view': ['Administrator', 'Guidance Staff', 'Counselor'],
    'counseling.manage': ['Administrator', 'Guidance Staff', 'Counselor'],
    'referrals.view': ['Administrator', 'Guidance Staff', 'Counselor'],
    'referrals.manage': ['Administrator', 'Guidance Staff', 'Counselor'],
    'inventory.view': ['Administrator', 'Guidance Staff'],
    'inventory.manage': ['Administrator', 'Guidance Staff'],
    'borrowing.view': ['Administrator', 'Guidance Staff'],
    'borrowing.manage': ['Administrator', 'Guidance Staff'],
    'reports.view': ['Administrator', 'Guidance Staff'],
    'database.manage': ['Administrator'],
    'settings.manage': ['Administrator'],
    'notifications.view': ['Administrator', 'Guidance Staff', 'Counselor'],
  };
  return (matrix[permission] || []).includes(role);
}

// Theme helpers
export function getTheme(): 'light' | 'dark' {
  return (localStorage.getItem(THEME_KEY) as 'light' | 'dark') || 'light';
}

export function setTheme(theme: 'light' | 'dark'): void {
  localStorage.setItem(THEME_KEY, theme);
  document.documentElement.setAttribute('data-theme', theme);
  // Sync with Electron's native theme if available
  try {
    if (typeof window !== 'undefined' && window.desktopApp?.setTheme) {
      window.desktopApp.setTheme(theme);
    }
  } catch {
    // Preload theme API not available — ignore
  }
}

export function initTheme(): void {
  setTheme(getTheme());
}
