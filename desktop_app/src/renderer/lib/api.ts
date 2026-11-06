/**
 * api.ts — API client for the Electron desktop app
 *
 * Every function here corresponds to an endpoint in Django's api.py.
 * The desktop app NEVER touches Django views directly — it goes through
 * this module, which talks HTTP/JSON to the Django backend.
 *
 * The base URL comes from window.desktopApp.apiBase (set by the main
 * process). The fallback below must match DEFAULT_API_BASE in main.ts —
 * PRODUCTION: replace with your deployed HTTPS Django URL.
 */
import type {
  ApiResponse, User, Role, Student, CounselingSession, CounselorNote,
  Referral, InventoryItem, StockMovement, BorrowedItem, Notification,
  SchoolSettings, SystemLog, LoginLog, Paginated, DashboardStats,
  StockMonitoring, AuditLogSummary, Guardian, ReferralUpdate,
  StudentRecordInventory,
} from '../../shared/types';

// ---------------------------------------------------------------------------
// Base URL — picked up from the preload bridge or fallback
// ---------------------------------------------------------------------------
declare global {
  interface Window {
    desktopApp?: {
      apiBase: string;
      platform: string;
      isElectron: boolean;
      version: string;
      // Theme control
      getTheme: () => 'light' | 'dark' | 'system';
      setTheme: (theme: 'light' | 'dark') => void;
      onThemeChange: (callback: (theme: 'light' | 'dark') => void) => void;
      // App lifecycle
      quit: () => void;
    };
  }
}

const API_BASE: string =
  (typeof window !== 'undefined' && window.desktopApp?.apiBase) ||
  '';

/** Resolve a media path to a full URL.
 *  - Absolute URLs (Cloudinary CDN) pass through unchanged.
 *  - Relative paths are joined onto the API base with exactly one slash,
 *    tolerating all backend formats: "media/x.png", "/media/x.png". */
export function resolveMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const base = API_BASE.replace(/\/+$/, '');
  const clean = path.replace(/^\/+/, '');
  return `${base}/${clean}`;
}

// ---------------------------------------------------------------------------
// Session storage — sessionid + csrftoken (set as cookies by Django)
// We let the browser/Electron handle cookies automatically via credentials:'include'.
// ---------------------------------------------------------------------------

let csrfToken: string | null = null;
let csrfFetchPromise: Promise<string | null> | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

function getCsrfTokenFromCookie(): string | null {
  const name = 'csrftoken';
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [cookieName, cookieValue] = cookie.trim().split('=');
    if (cookieName === name) {
      return decodeURIComponent(cookieValue);
    }
  }
  return null;
}

/** Fetch a fresh CSRF token from the server. */
async function fetchCsrfToken(): Promise<string | null> {
  try {
    const url = `${API_BASE}/api/csrf-token/`;
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Accept': 'application/json' },
    });
    const data = await response.json();
    if (data.success && data.data?.csrf_token) {
      csrfToken = data.data.csrf_token;
      return csrfToken;
    }
  } catch {}
  return null;
}

/** Get CSRF token — tries cookie first, then memory, then fetches from server. */
async function ensureCsrfToken(): Promise<string | null> {
  if (csrfToken) return csrfToken;
  // Try cookie
  csrfToken = getCsrfTokenFromCookie();
  if (csrfToken) return csrfToken;
  // Fetch from server (debounce concurrent calls)
  if (!csrfFetchPromise) {
    csrfFetchPromise = fetchCsrfToken().finally(() => { csrfFetchPromise = null; });
  }
  return csrfFetchPromise;
}

function getCsrfHeader(): Record<string, string> {
  // Try to get CSRF token from cookie if not set explicitly
  if (!csrfToken) {
    csrfToken = getCsrfTokenFromCookie();
  }
  if (csrfToken) return { 'X-CSRFToken': csrfToken };
  return {};
}

// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------
async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const method = (options.method || 'GET').toUpperCase();

  // Auto-fetch CSRF token for state-changing requests
  let csrfHeaders: Record<string, string> = {};
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    const token = await ensureCsrfToken();
    if (token) csrfHeaders = { 'X-CSRFToken': token };
  }

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...csrfHeaders,
    ...(options.headers as Record<string, string> || {}),
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // include session cookie
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok || data.success === false) {
      const err = new Error(data.error || `HTTP ${response.status}`) as Error & {
        status?: number;
        errors?: Record<string, string[]>;
        data?: unknown;
      };
      err.status = response.status;
      err.errors = data.errors;
      err.data = data;
      throw err;
    }
    return data as T;
  } catch (e) {
    if (e instanceof TypeError) {
      // Network error — likely Django isn't running
      throw new Error(
        `Cannot connect to backend, Please Contact the Administrator.`,
      );
    }
    throw e;
  }
}

function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

/** Keep the current desktop page connected to current server data while an
 * unsaved form or applied filter prevents its DOM from being replaced. */
export async function pollPageData(route: string): Promise<void> {
  const parts = route.split('/').filter(Boolean);
  const group = parts[0] || '';
  const pk = parts[1];
  let endpoint = '/api/auth/me/';
  if (group === 'dashboard') endpoint = '/api/dashboard/stats/';
  else if (group === 'student-record-inventory') endpoint = '/api/students/record-inventory/';
  else if (group === 'users') endpoint = pk && pk !== 'create' ? `/api/users/${encodeURIComponent(pk)}/` : '/api/users/';
  else if (group === 'students') endpoint = pk && pk !== 'create' ? `/api/students/${encodeURIComponent(pk)}/` : '/api/students/';
  else if (group === 'counseling') endpoint = pk && pk !== 'create' ? `/api/counseling/${encodeURIComponent(pk)}/` : '/api/counseling/';
  else if (group === 'referrals') endpoint = pk && pk !== 'create' ? `/api/referrals/${encodeURIComponent(pk)}/` : '/api/referrals/';
  else if (group === 'inventory') endpoint = pk === 'stock-monitoring' ? '/api/inventory/stock-monitoring/' : pk && pk !== 'create' ? `/api/inventory/${encodeURIComponent(pk)}/` : '/api/inventory/';
  else if (group === 'borrowed') endpoint = '/api/borrowed/';
  else if (group === 'notifications') endpoint = '/api/notifications/';
  else if (group === 'reports') endpoint = pk ? `/api/reports/${pk === 'user_activity' ? 'user-activity' : pk}/` : '/api/reports/';
  else if (group === 'settings') endpoint = '/api/school/settings/';
  else if (group === 'database') endpoint = '/api/audit/logs/';
  await request<ApiResponse>(endpoint, { method: 'GET' });
}

// ===========================================================================
// AUTH API
// ===========================================================================
export const authApi = {
  login: (username: string, password: string, remember_me = false) =>
    request<ApiResponse<{ user: User; csrf_token?: string }>>('/api/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ username, password, remember_me }),
    }),

  logout: () =>
    request<ApiResponse>('/api/auth/logout/', { method: 'POST' }),

  me: () =>
    request<ApiResponse<{ user: User }>>('/api/auth/me/', { method: 'GET' }),

  register: (data: {
    first_name: string; middle_name?: string; last_name: string;
    username: string; email: string;
    password1: string; password2: string;
    role: number;
  }) =>
    request<ApiResponse<{ user: User }>>('/api/auth/register/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  roles: () =>
    request<ApiResponse<Role[]>>('/api/roles/', { method: 'GET' }),
};

// ===========================================================================
// DASHBOARD API
// ===========================================================================
export const dashboardApi = {
  stats: () =>
    request<ApiResponse<DashboardStats>>('/api/dashboard/stats/', { method: 'GET' }),
};

// ===========================================================================
// USERS API
// ===========================================================================
export interface UserListParams {
  search?: string;
  role?: number | string;
  status?: string;
  page?: number;
  per_page?: number;
}

export const usersApi = {
  list: (params: UserListParams = {}) =>
    request<ApiResponse<Paginated<User>>>(`/api/users/${buildQuery(params as any)}`, { method: 'GET' }),

  detail: (pk: number) =>
    request<ApiResponse<{ user: User; recent_logs: any[] }>>(`/api/users/${pk}/`, { method: 'GET' }),

  create: (data: Partial<User> & { password?: string }) =>
    request<ApiResponse<{ user: User }>>('/api/users/create/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (pk: number, data: Partial<User> & { password?: string }) =>
    request<ApiResponse<{ user: User }>>(`/api/users/${pk}/update/`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  activate: (pk: number) =>
    request<ApiResponse<{ user: User }>>(`/api/users/${pk}/activate/`, { method: 'POST' }),

  deactivate: (pk: number) =>
    request<ApiResponse<{ user: User }>>(`/api/users/${pk}/deactivate/`, { method: 'POST' }),

  approve: (pk: number) =>
    request<ApiResponse<{ user: User }>>(`/api/users/${pk}/approve/`, { method: 'POST' }),

  delete: (pk: number) =>
    request<ApiResponse>(`/api/users/${pk}/delete/`, { method: 'POST' }),
};

// ===========================================================================
// STUDENTS API
// ===========================================================================
export interface StudentListParams {
  search?: string;
  grade_level?: string;
  gender?: string;
  status?: string;
  school_year?: string;
  page?: number;
  per_page?: number;
}

export const studentsApi = {
  recordInventory: () =>
    request<ApiResponse<StudentRecordInventory>>('/api/students/record-inventory/', { method: 'GET' }),

  list: (params: StudentListParams = {}) =>
    request<ApiResponse<Paginated<Student>>>(`/api/students/${buildQuery(params as any)}`, { method: 'GET' }),

  /** Lightweight autocomplete for student pickers (counseling/referral
   *  forms). Returns up to 10 matches across first/middle/last name and
   *  student number, debounced by the caller. */
  lookup: (q: string) =>
    request<ApiResponse<{ items: Array<{
      id: number; student_number: string; first_name: string;
      middle_name: string; last_name: string; full_name: string;
      grade_level: string; section: string; status: string;
    }> }>>(`/api/students/lookup/${buildQuery({ q })}`, { method: 'GET' }),

  detail: (pk: number) =>
    request<ApiResponse<{ student: Student }>>(`/api/students/${pk}/`, { method: 'GET' }),

  create: (data: Partial<Student>) =>
    request<ApiResponse<{ student: Student }>>('/api/students/create/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (pk: number, data: Partial<Student>) =>
    request<ApiResponse<{ student: Student }>>(`/api/students/${pk}/update/`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  delete: (pk: number) =>
    request<ApiResponse>(`/api/students/${pk}/delete/`, { method: 'POST' }),

  // Guardians (sub-resource)
  addGuardian: (studentPk: number, data: {
    full_name: string;
    relationship: string;
    contact_number?: string;
    email?: string;
    address?: string;
    is_primary?: boolean;
  }) =>
    request<ApiResponse<{ guardian: Guardian }>>(`/api/students/${studentPk}/guardians/add/`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteGuardian: (studentPk: number, guardianPk: number) =>
    request<ApiResponse>(`/api/students/${studentPk}/guardians/${guardianPk}/delete/`, {
      method: 'POST',
    }),

  // Documents (sub-resource — uses multipart/form-data for file upload)
  addDocument: async (studentPk: number, data: {
    title: string;
    document_type: string;
    description?: string;
    file: File;
  }) => {
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('document_type', data.document_type);
    if (data.description) formData.append('description', data.description);
    formData.append('file', data.file);
    const token = await ensureCsrfToken();
    const csrfHeaders: Record<string, string> = token ? { 'X-CSRFToken': token } : {};
    const response = await fetch(`${API_BASE}/api/students/${studentPk}/documents/add/`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers: csrfHeaders,
    });
    return response.json();
  },

  deleteDocument: (studentPk: number, documentPk: number) =>
    request<ApiResponse>(`/api/students/${studentPk}/documents/${documentPk}/delete/`, {
      method: 'POST',
    }),
};

// ===========================================================================
// COUNSELING API
// ===========================================================================
export interface CounselingListParams {
  search?: string;
  counselor?: number | string;
  concern_type?: string;
  status?: string;
  page?: number;
  per_page?: number;
}

export const counselingApi = {
  list: (params: CounselingListParams = {}) =>
    request<ApiResponse<Paginated<CounselingSession>>>(`/api/counseling/${buildQuery(params as any)}`, { method: 'GET' }),

  detail: (pk: number) =>
    request<ApiResponse<{ session: CounselingSession & { notes_list: CounselorNote[] } }>>(`/api/counseling/${pk}/`, { method: 'GET' }),

  create: (data: any) =>
    request<ApiResponse<{ session: CounselingSession }>>('/api/counseling/create/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (pk: number, data: any) =>
    request<ApiResponse<{ session: CounselingSession }>>(`/api/counseling/${pk}/update/`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  close: (pk: number) =>
    request<ApiResponse<{ session: CounselingSession }>>(`/api/counseling/${pk}/close/`, { method: 'POST' }),

  addNote: (pk: number, note: string, is_private = false) =>
    request<ApiResponse<{ note: CounselorNote }>>(`/api/counseling/${pk}/notes/add/`, {
      method: 'POST',
      body: JSON.stringify({ note, is_private }),
    }),

  delete: (pk: number) =>
    request<ApiResponse>(`/api/counseling/${pk}/delete/`, { method: 'POST' }),
};

// ===========================================================================
// REFERRALS API
// ===========================================================================
export interface ReferralListParams {
  search?: string;
  status?: string;
  priority?: string;
  referral_type?: string;
  page?: number;
  per_page?: number;
}

export const referralsApi = {
  list: (params: ReferralListParams = {}) =>
    request<ApiResponse<Paginated<Referral>>>(`/api/referrals/${buildQuery(params as any)}`, { method: 'GET' }),

  detail: (pk: number) =>
    request<ApiResponse<{ referral: Referral & { updates: ReferralUpdate[] } }>>(`/api/referrals/${pk}/`, { method: 'GET' }),

  create: (data: any) =>
    request<ApiResponse<{ referral: Referral }>>('/api/referrals/create/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (pk: number, data: any) =>
    request<ApiResponse<{ referral: Referral }>>(`/api/referrals/${pk}/update/`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  addUpdate: (pk: number, new_status: string, note: string) =>
    request<ApiResponse<{ update: ReferralUpdate }>>(`/api/referrals/${pk}/updates/add/`, {
      method: 'POST',
      body: JSON.stringify({ new_status, note }),
    }),

  close: (pk: number) =>
    request<ApiResponse<{ referral: Referral }>>(`/api/referrals/${pk}/close/`, { method: 'POST' }),

  delete: (pk: number) =>
    request<ApiResponse>(`/api/referrals/${pk}/delete/`, { method: 'POST' }),
};

// ===========================================================================
// INVENTORY API
// ===========================================================================
export interface InventoryListParams {
  search?: string;
  category?: string;
  stock_status?: string;
  page?: number;
  per_page?: number;
}

export const inventoryApi = {
  list: (params: InventoryListParams = {}) =>
    request<ApiResponse<Paginated<InventoryItem>>>(`/api/inventory/${buildQuery(params as any)}`, { method: 'GET' }),

  detail: (pk: number) =>
    request<ApiResponse<{ item: InventoryItem & { movements: StockMovement[]; borrowed_records: BorrowedItem[] } }>>(`/api/inventory/${pk}/`, { method: 'GET' }),

  create: (data: any) =>
    request<ApiResponse<{ item: InventoryItem }>>('/api/inventory/create/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (pk: number, data: any) =>
    request<ApiResponse<{ item: InventoryItem }>>(`/api/inventory/${pk}/update/`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  adjust: (pk: number, movement_type: 'in' | 'out' | 'adjust', quantity: number, note?: string) =>
    request<ApiResponse<{ item: InventoryItem; movement: StockMovement }>>(`/api/inventory/${pk}/adjust/`, {
      method: 'POST',
      body: JSON.stringify({ movement_type, quantity, note }),
    }),

  delete: (pk: number) =>
    request<ApiResponse>(`/api/inventory/${pk}/delete/`, { method: 'POST' }),

  stockMonitoring: () =>
    request<ApiResponse<StockMonitoring>>('/api/inventory/stock-monitoring/', { method: 'GET' }),
};

// ===========================================================================
// BORROWED ITEMS API
// ===========================================================================
export interface BorrowedListParams {
  search?: string;
  status?: string;
  page?: number;
  per_page?: number;
}

export const borrowedApi = {
  list: (params: BorrowedListParams = {}) =>
    request<ApiResponse<Paginated<BorrowedItem>>>(`/api/borrowed/${buildQuery(params as any)}`, { method: 'GET' }),

  create: (data: any) =>
    request<ApiResponse<{ item: BorrowedItem }>>('/api/borrowed/create/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  return: (pk: number, data: { actual_return_date?: string; notes?: string } = {}) =>
    request<ApiResponse<{ item: BorrowedItem }>>(`/api/borrowed/${pk}/return/`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ===========================================================================
// NOTIFICATIONS API
// ===========================================================================
export const notificationsApi = {
  list: (filter: 'all' | 'unread' = 'all', page = 1, per_page = 20) =>
    request<ApiResponse<Paginated<Notification> & { unread_count: number }>>(
      `/api/notifications/${buildQuery({ filter, page, per_page })}`,
      { method: 'GET' },
    ),

  unreadCount: () =>
    request<ApiResponse<{ count: number }>>('/api/notifications/unread-count/', { method: 'GET' }),

  markRead: (pk: number) =>
    request<ApiResponse<{ notification: Notification }>>(`/api/notifications/${pk}/read/`, { method: 'POST' }),

  markAllRead: () =>
    request<ApiResponse>('/api/notifications/mark-all-read/', { method: 'POST' }),
};

// ===========================================================================
// REPORTS API
// ===========================================================================
export const reportsApi = {
  home: () =>
    request<ApiResponse<{ reports: any[] }>>('/api/reports/', { method: 'GET' }),

  students: () =>
    request<ApiResponse<StudentRecordInventory>>('/api/reports/students/', { method: 'GET' }),

  counseling: () =>
    request<ApiResponse<{ items: CounselingSession[]; count: number }>>('/api/reports/counseling/', { method: 'GET' }),

  referrals: () =>
    request<ApiResponse<{ items: Referral[]; count: number }>>('/api/reports/referrals/', { method: 'GET' }),

  inventory: () =>
    request<ApiResponse<{ items: InventoryItem[]; count: number }>>('/api/reports/inventory/', { method: 'GET' }),

  borrowing: () =>
    request<ApiResponse<{ items: BorrowedItem[]; count: number }>>('/api/reports/borrowing/', { method: 'GET' }),

  userActivity: () =>
    request<ApiResponse<{ items: SystemLog[]; count: number }>>('/api/reports/user-activity/', { method: 'GET' }),
};

// ===========================================================================
// SETTINGS / SCHOOL API
// ===========================================================================
export const settingsApi = {
  public: () =>
    request<ApiResponse<{ settings: Partial<SchoolSettings> }>>('/api/school/public/', { method: 'GET' }),

  get: () =>
    request<ApiResponse<{ settings: SchoolSettings }>>('/api/school/settings/', { method: 'GET' }),

  update: (data: Partial<SchoolSettings>) =>
    request<ApiResponse<{ settings: SchoolSettings }>>('/api/school/settings/update/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  uploadLogo: async (file: File): Promise<ApiResponse<{ school_logo: string | null }>> => {
    const url = `${API_BASE}/api/school/logo/`;
    const token = await ensureCsrfToken();
    const formData = new FormData();
    formData.append('school_logo', file);
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (token) headers['X-CSRFToken'] = token;
    const response = await fetch(url, { method: 'POST', headers, body: formData, credentials: 'include' });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok || data.success === false) throw new Error(data.error || 'Upload failed');
    return data;
  },
};

// ===========================================================================
// ACCOUNT API
// ===========================================================================
export const accountApi = {
  updateProfile: (data: Partial<User>) =>
    request<ApiResponse<{ user: User }>>('/api/account/profile/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  uploadAvatar: async (file: File): Promise<ApiResponse<{ user: User }>> => {
    const url = `${API_BASE}/api/account/avatar/`;
    const token = await ensureCsrfToken();
    const formData = new FormData();
    formData.append('avatar', file);
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (token) headers['X-CSRFToken'] = token;
    const response = await fetch(url, { method: 'POST', headers, body: formData, credentials: 'include' });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok || data.success === false) throw new Error(data.error || 'Upload failed');
    return data;
  },

  changePassword: (data: { old_password: string; new_password1: string; new_password2: string }) =>
    request<ApiResponse>('/api/account/password/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ===========================================================================
// DATABASE / AUDIT API
// ===========================================================================
export interface AuditLogParams {
  entity?: string;
  action?: string;
  page?: number;
  per_page?: number;
}

export const databaseApi = {
  auditLogs: (params: AuditLogParams = {}) =>
    request<ApiResponse<Paginated<SystemLog> & {
      entities: string[];
      actions: { value: string; label: string }[];
      summary: AuditLogSummary;
    }>>(`/api/audit/logs/${buildQuery(params as any)}`, { method: 'GET' }),

  loginLogs: (page = 1, per_page = 25) =>
    request<ApiResponse<Paginated<LoginLog>>>(`/api/audit/login-logs/${buildQuery({ page, per_page })}`, { method: 'GET' }),

  /** Triggers a backup and returns the file as a Blob (for download). */
  backup: async (): Promise<Blob> => {
    const token = await ensureCsrfToken();
    const csrfHeaders: Record<string, string> = token ? { 'X-CSRFToken': token } : {};
    const response = await fetch(`${API_BASE}/api/database/backup/`, {
      method: 'POST',
      credentials: 'include',
      headers: csrfHeaders,
    });
    if (!response.ok) {
      const text = await response.text();
      try {
        const data = JSON.parse(text);
        throw new Error(data.error || `HTTP ${response.status}`);
      } catch {
        throw new Error(`Backup failed: HTTP ${response.status}`);
      }
    }
    return response.blob();
  },

  /** Lists all existing backup files on the server. */
  backupsList: () =>
    request<ApiResponse<{ backups: Array<{ filename: string; size_bytes: number; size_mb: number; created_at: string }>; count: number }>>('/api/database/backups/', { method: 'GET' }),

  /** Restore the database from an uploaded .sqlite3 file (multipart/form-data). */
  restore: async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('confirm', 'true');
    const token = await ensureCsrfToken();
    const csrfHeaders: Record<string, string> = token ? { 'X-CSRFToken': token } : {};
    const response = await fetch(`${API_BASE}/api/database/restore/`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers: csrfHeaders,
    });
    const text = await response.text();
    try {
      const data = text ? JSON.parse(text) : {};
      if (!response.ok || data.success === false) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      return data;
    } catch {
      throw new Error(`Restore failed: HTTP ${response.status}`);
    }
  },

  /** Delete a backup file from the server. */
  deleteBackup: (filename: string) =>
    request<ApiResponse>(`/api/database/backups/${encodeURIComponent(filename)}/delete/`, {
      method: 'POST',
    }),
};

// ---------------------------------------------------------------------------
// Export the base URL for the renderer (for download links etc.)
// ---------------------------------------------------------------------------
export const API_BASE_URL = API_BASE;
