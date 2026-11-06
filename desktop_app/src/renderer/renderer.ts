/**
 * Renderer entry point.
 *
 * Boots the app:
 *   1. Initialize theme
 *   2. Try to fetch the current user (session-based)
 *   3. Register all routes
 *   4. Start the hash router
 */
import { initTheme, getUser, fetchMe, fetchRoles } from './lib/auth';
import { startRouter, registerRoute } from './lib/router';

// Public pages
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { LogoutPage } from './pages/LogoutPage';
import { Error403Page, Error404Page, Error500Page } from './pages/ErrorPage';

// Authenticated pages
import { DashboardPage } from './pages/DashboardPage';

// User management
import { UsersListPage } from './pages/UsersListPage';
import { UserFormPage } from './pages/UserFormPage';
import { UserDetailPage } from './pages/UserDetailPage';
import { UserDeletePage } from './pages/UserDeletePage';

// Students
import { StudentsListPage } from './pages/StudentsListPage';
import { StudentFormPage } from './pages/StudentFormPage';
import { StudentDetailPage } from './pages/StudentDetailPage';
import { StudentDeletePage } from './pages/StudentDeletePage';
import { StudentRecordInventoryPage } from './pages/StudentRecordInventoryPage';

// Counseling
import { CounselingListPage } from './pages/CounselingListPage';
import { CounselingFormPage } from './pages/CounselingFormPage';
import { CounselingDetailPage } from './pages/CounselingDetailPage';
import { CounselingDeletePage } from './pages/CounselingDeletePage';

// Referrals
import { ReferralsListPage } from './pages/ReferralsListPage';
import { ReferralFormPage } from './pages/ReferralFormPage';
import { ReferralDetailPage } from './pages/ReferralDetailPage';
import { ReferralDeletePage } from './pages/ReferralDeletePage';

// Inventory
import { InventoryListPage } from './pages/InventoryListPage';
import { InventoryFormPage } from './pages/InventoryFormPage';
import { InventoryDetailPage } from './pages/InventoryDetailPage';
import { InventoryDeletePage } from './pages/InventoryDeletePage';
import { StockMonitoringPage } from './pages/StockMonitoringPage';

// Borrowed items
import { BorrowedListPage } from './pages/BorrowedListPage';
import { BorrowedFormPage } from './pages/BorrowedFormPage';
import { BorrowedReturnPage } from './pages/BorrowedReturnPage';

// Reports
import { ReportsPage } from './pages/ReportsPage';
import { ReportDetailPage } from './pages/ReportDetailPage';

// System
import { NotificationsPage } from './pages/NotificationsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AccountPage } from './pages/AccountPage';
import { DatabasePage } from './pages/DatabasePage';

async function boot(): Promise<void> {
  initTheme();

  // Initialize AOS animations
  if (typeof (window as any).AOS !== 'undefined') {
    (window as any).AOS.init({
      duration: 600,
      easing: 'ease-out-cubic',
      once: true,
    });
  }

  const root = document.getElementById('root');
  if (!root) return;

  // Try to restore session
  await fetchMe();
  await fetchRoles();

  // ==================== Public routes ====================
  registerRoute('/', () => LandingPage());
  registerRoute('/login', () => LoginPage());
  registerRoute('/register', () => RegisterPage());
  registerRoute('/logout', () => LogoutPage());

  // Error pages
  registerRoute('/error/403', () => Error403Page());
  registerRoute('/error/404', () => Error404Page());
  registerRoute('/error/500', () => Error500Page());

  // ==================== Dashboard ====================
  registerRoute('/dashboard', () => DashboardPage(), { requiresAuth: true });

  // ==================== Users ====================
  registerRoute('/users', () => UsersListPage(), { requiresAuth: true, permission: 'users.view' });
  registerRoute('/users/create', () => UserFormPage(), { requiresAuth: true, permission: 'users.manage' });
  registerRoute('/users/:pk', (p) => UserDetailPage(p.pk), { requiresAuth: true, permission: 'users.view' });
  registerRoute('/users/:pk/edit', (p) => UserFormPage(p.pk), { requiresAuth: true, permission: 'users.manage' });
  registerRoute('/users/:pk/delete', (p) => UserDeletePage(p.pk), { requiresAuth: true, permission: 'users.manage' });

  // ==================== Students ====================
  registerRoute('/student-record-inventory', () => StudentRecordInventoryPage(), { requiresAuth: true, permission: 'students.view' });
  registerRoute('/students', () => StudentsListPage(), { requiresAuth: true });
  registerRoute('/students/create', () => StudentFormPage(), { requiresAuth: true });
  registerRoute('/students/:pk', (p) => StudentDetailPage(p.pk), { requiresAuth: true });
  registerRoute('/students/:pk/edit', (p) => StudentFormPage(p.pk), { requiresAuth: true });
  registerRoute('/students/:pk/delete', (p) => StudentDeletePage(p.pk), { requiresAuth: true });

  // ==================== Counseling ====================
  registerRoute('/counseling', () => CounselingListPage(), { requiresAuth: true });
  registerRoute('/counseling/create', () => CounselingFormPage(), { requiresAuth: true });
  registerRoute('/counseling/:pk', (p) => CounselingDetailPage(p.pk), { requiresAuth: true });
  registerRoute('/counseling/:pk/edit', (p) => CounselingFormPage(p.pk), { requiresAuth: true });
  registerRoute('/counseling/:pk/delete', (p) => CounselingDeletePage(p.pk), { requiresAuth: true });

  // ==================== Referrals ====================
  registerRoute('/referrals', () => ReferralsListPage(), { requiresAuth: true });
  registerRoute('/referrals/create', () => ReferralFormPage(), { requiresAuth: true });
  registerRoute('/referrals/:pk', (p) => ReferralDetailPage(p.pk), { requiresAuth: true });
  registerRoute('/referrals/:pk/edit', (p) => ReferralFormPage(p.pk), { requiresAuth: true });
  registerRoute('/referrals/:pk/delete', (p) => ReferralDeletePage(p.pk), { requiresAuth: true });

  // ==================== Inventory ====================
  registerRoute('/inventory', () => InventoryListPage(), { requiresAuth: true, permission: 'inventory.view' });
  registerRoute('/inventory/create', () => InventoryFormPage(), { requiresAuth: true, permission: 'inventory.manage' });
  registerRoute('/inventory/stock-monitoring', () => StockMonitoringPage(), { requiresAuth: true, permission: 'inventory.view' });
  registerRoute('/inventory/:pk', (p) => InventoryDetailPage(p.pk), { requiresAuth: true, permission: 'inventory.view' });
  registerRoute('/inventory/:pk/edit', (p) => InventoryFormPage(p.pk), { requiresAuth: true, permission: 'inventory.manage' });
  registerRoute('/inventory/:pk/delete', (p) => InventoryDeletePage(p.pk), { requiresAuth: true, permission: 'inventory.manage' });

  // ==================== Borrowed items ====================
  registerRoute('/borrowed', () => BorrowedListPage(), { requiresAuth: true, permission: 'borrowing.view' });
  registerRoute('/borrowed/create', () => BorrowedFormPage(), { requiresAuth: true, permission: 'borrowing.manage' });
  registerRoute('/borrowed/:pk/return', (p) => BorrowedReturnPage(p.pk), { requiresAuth: true, permission: 'borrowing.manage' });

  // ==================== Reports ====================
  registerRoute('/reports', () => ReportsPage(), { requiresAuth: true, permission: 'reports.view' });
  registerRoute('/reports/:type', (p) => ReportDetailPage(p.type), { requiresAuth: true, permission: 'reports.view' });

  // ==================== System ====================
  registerRoute('/notifications', () => NotificationsPage(), { requiresAuth: true });
  registerRoute('/settings', () => SettingsPage(), { requiresAuth: true, permission: 'settings.manage' });
  registerRoute('/account', () => AccountPage(), { requiresAuth: true });
  registerRoute('/database', () => DatabasePage(), { requiresAuth: true, permission: 'database.manage' });

  // Boot router
  startRouter(root);
}

boot().catch(err => {
  console.error('Boot failed:', err);
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = '<div class="loading-screen"><i class="bi bi-exclamation-triangle" style="font-size:3rem;color:#b91c1c;"></i><h2>Failed to start</h2><p>' + (err.message || err) + '</p></div>';
  }
});
