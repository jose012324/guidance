/**
 * Shared TypeScript types — mirror the JSON shapes returned by api.py
 */

export interface Role {
  id: number;
  name: string;
  description?: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  full_name: string;
  employee_id: string | null;
  contact_number: string;
  avatar: string | null;
  status: 'active' | 'inactive' | 'pending' | 'locked';
  status_display: string;
  date_joined: string | null;
  last_login: string | null;
  is_superuser: boolean;
  role: { id: number; name: string } | null;
}

export interface Student {
  id: number;
  student_number: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  full_name: string;
  gender: 'male' | 'female' | 'other' | '';
  gender_display: string;
  birthdate: string | null;
  age: number | null;
  address: string;
  contact_number: string;
  grade_level: string;
  section: string;
  school_year: string;
  status: 'active' | 'inactive' | 'graduated' | 'transferred' | 'inc';
  status_display: string;
  created_at: string | null;
  updated_at: string | null;
  guardians?: Guardian[];
  counseling_count?: number;
  referral_count?: number;
  counseling_sessions?: CounselingSession[];
  referrals?: Referral[];
  activities?: ActivityTimeline[];
  documents?: StudentDocument[];
}

export interface StudentRecordInventory {
  kpis: {
    total_students: number; active_students: number; inactive_students: number;
    newly_registered_students: number; with_guidance_records: number;
    without_guidance_records: number; active_cases: number; closed_cases: number;
    pending_referrals: number; referred_students: number; completed_referrals: number;
    urgent_cases: number; emergency_cases: number; counseling_students: number;
  };
  year_levels: Array<{ label: string; value: number }>;
  programs: Array<{ label: string; value: number }>;
  genders: Array<{ label: string; value: number }>;
  concerns: Array<{ label: string; value: number }>;
  referral_statuses: Array<{ label: string; value: number }>;
}

export interface Guardian {
  id: number;
  full_name: string;
  relationship: string;
  relationship_display: string;
  contact_number: string;
  email: string;
  address?: string;
  is_primary: boolean;
}

export interface StudentDocument {
  id: number;
  title: string;
  document_type: string;
  document_type_display: string;
  file: string | null;
  description: string;
  uploaded_at: string;
}

export interface ActivityTimeline {
  id: number;
  activity_type: string;
  activity_type_display: string;
  title: string;
  description: string;
  performed_by: User | null;
  timestamp: string;
}

export interface CounselingSession {
  id: number;
  student: Student;
  counselor: User;
  session_date: string;
  concern_type: string;
  concern_type_display: string;
  status: 'open' | 'ongoing' | 'closed';
  status_display: string;
  summary: string;
  notes: string;
  recommendations: string;
  follow_up_date: string | null;
  created_at: string | null;
  closed_at: string | null;
  notes_list?: CounselorNote[];
}

export interface CounselorNote {
  id: number;
  author: User | null;
  note: string;
  is_private: boolean;
  created_at: string;
}

export interface Referral {
  id: number;
  student: Student;
  referred_by: User;
  assigned_counselor: User | null;
  referral_type: string;
  referral_type_display: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  priority_display: string;
  reason: string;
  description: string;
  status: 'pending' | 'ongoing' | 'completed';
  status_display: string;
  referred_at: string;
  completed_at: string | null;
  updates?: ReferralUpdate[];
}

export interface ReferralUpdate {
  id: number;
  author: User | null;
  previous_status: string;
  new_status: string;
  note: string;
  created_at: string;
}

export interface InventoryItem {
  id: number;
  item_code: string;
  name: string;
  description: string;
  category: string;
  category_display: string;
  quantity: number;
  unit: string;
  unit_display: string;
  reorder_level: number;
  stock_status: 'available' | 'low_stock' | 'out_of_stock';
  stock_status_display: string;
  created_at: string | null;
  movements?: StockMovement[];
  borrowed_records?: BorrowedItem[];
}

export interface StockMovement {
  id: number;
  movement_type: 'in' | 'out' | 'adjust';
  movement_type_display: string;
  quantity: number;
  balance_after: number;
  note: string;
  performed_by: User | null;
  timestamp: string;
}

export interface BorrowedItem {
  id: number;
  borrower_name: string;
  department: string;
  borrower_user: User | null;
  item: InventoryItem;
  quantity: number;
  borrow_date: string;
  expected_return_date: string | null;
  actual_return_date: string | null;
  status: 'borrowed' | 'returned' | 'overdue';
  status_display: string;
  notes: string;
}

export interface Notification {
  id: number;
  category: string;
  category_display: string;
  priority: 'low' | 'normal' | 'high';
  priority_display: string;
  title: string;
  message: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

export interface SchoolSettings {
  id?: number;
  school_name: string;
  school_logo?: string | null;
  school_address: string;
  school_year: string;
  contact_email: string;
  contact_phone: string;
  system_title: string;
  footer_text: string;
  default_theme: 'light' | 'dark';
}

export interface SystemLog {
  id: number;
  timestamp: string;
  user: User | null;
  action: string;
  action_display: string;
  entity: string;
  entity_id: string;
  description: string;
  ip_address: string | null;
}

export interface LoginLog {
  id: number;
  username_attempted: string;
  action: string;
  action_display: string;
  user: User | null;
  ip_address: string | null;
  user_agent: string;
  timestamp: string;
}

export interface Pagination {
  page: number;
  per_page: number;
  total_pages: number;
  total_count: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface Paginated<T> {
  items: T[];
  pagination: Pagination;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
}

export interface DashboardStats {
  kpis: {
    total_students: number;
    active_students: number;
    sessions_total: number;
    sessions_open: number;
    referrals_total: number;
    referrals_pending: number;
    inventory_total: number;
    borrowed_active: number;
    low_stock_count: number;
    out_of_stock_count: number;
  };
  counseling_trend: { label: string; value: number }[];
  referral_trend: { label: string; value: number }[];
  concern_chart: { label: string; value: number }[];
  activity_logs: SystemLog[];
  low_stock_items: InventoryItem[];
}

export interface StockMonitoring {
  kpis: {
    total: number;
    available: number;
    low_stock: number;
    out_of_stock: number;
  };
  low_stock: InventoryItem[];
  out_of_stock: InventoryItem[];
}

export interface AuditLogSummary {
  total_logs: number;
  total_logins: number;
  logins_today: number;
  failed_logins: number;
}
