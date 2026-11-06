# Guidance Office — Desktop App (Electron + TypeScript)

A desktop client for the Guidance Office Records Inventory Management System. Built with Electron 28 + TypeScript.

## Architecture

```
desktop_app/
├── package.json                  # Electron + TS deps, build scripts
├── tsconfig.json                 # TypeScript config (CommonJS output)
└── src/
    ├── main/
    │   └── main.ts               # Electron main process — creates BrowserWindow
    ├── preload/
    │   └── preload.ts            # Secure context bridge — exposes window.desktopApp
    ├── shared/
    │   └── types.ts              # TypeScript interfaces mirroring api.py responses
    └── renderer/
        ├── index.html            # App entry HTML
        ├── renderer.ts           # Boot script — registers all routes, starts router
        ├── styles/
        │   └── main.css          # Editorial Academic design system
        ├── lib/
        │   ├── api.ts            # API client — every endpoint (calls Django api.py)
        │   ├── auth.ts           # Current user state + permission helpers
        │   ├── dom.ts            # DOM helpers (el, div, button, icon, ...)
        │   ├── router.ts         # Hash-based router with auth guards
        │   └── toast.ts          # Toast notification system
        ├── components/
        │   ├── AppShell.ts       # Sidebar + topbar + footer layout
        │   ├── PageWrapper.ts    # Page header + actions pattern
        │   └── Table.ts          # Reusable table/pagination/filter-bar
        └── pages/
            ├── LandingPage.ts    # Public landing page
            ├── LoginPage.ts      # Login
            ├── RegisterPage.ts   # Register
            ├── DashboardPage.ts  # KPIs + charts + activity feed
            ├── UsersListPage.ts, UserFormPage.ts, UserDetailPage.ts
            ├── StudentsListPage.ts, StudentFormPage.ts, StudentDetailPage.ts
            ├── CounselingListPage.ts, CounselingFormPage.ts, CounselingDetailPage.ts
            ├── ReferralsListPage.ts, ReferralFormPage.ts, ReferralDetailPage.ts
            ├── InventoryListPage.ts, InventoryFormPage.ts, InventoryDetailPage.ts
            ├── StockMonitoringPage.ts
            ├── BorrowedListPage.ts, BorrowedFormPage.ts
            ├── ReportsPage.ts, ReportDetailPage.ts
            ├── NotificationsPage.ts
            ├── SettingsPage.ts
            ├── AccountPage.ts
            └── DatabasePage.ts
```

## How it talks to the backend

```
[Electron Renderer Process]
        ↓ fetch() + credentials: 'include'
[Django api.py at http://127.0.0.1:8000/api/*]
        ↓ calls Django views/models
[SQLite Database]
```

- **api.py** (in the Django project root) exposes a JSON REST API
- **api.ts** (desktop_app/src/renderer/lib/api.ts) is the typed client
- Session cookies are sent automatically (`credentials: 'include'`)
- The desktop app never talks to Django views directly — only through `api.py`

## Setup

### 1. Start the Django backend first

```bash
cd guidance_system
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

Django will be running at `http://127.0.0.1:8000`.

### 2. Build & run the desktop app

```bash
cd desktop_app
npm install            # install Electron + TypeScript
npm run dev         # tsc → compiles src/*.ts → dist/*.js

for builder
npx electron-builder
```

The Electron window opens, hits the Django backend at `http://127.0.0.1:8000/api/auth/me/` to check for an existing session, then routes to login or dashboard.

## Development

- `npm run watch` — TypeScript in watch mode (recompiles on save)
- `npm run dev` — builds + launches Electron with DevTools open

## Build for distribution

```bash
npm run build:prod     # builds + packages with electron-builder
```

Output goes to `desktop_app/release/`. NSIS installer on Windows, DMG on macOS, AppImage + deb on Linux.

## API endpoints summary

| Group | Endpoint | Method |
|-------|----------|--------|
| Auth | `/api/auth/login/`, `/api/auth/logout/`, `/api/auth/me/`, `/api/auth/register/` | POST / GET |
| Dashboard | `/api/dashboard/stats/` | GET |
| Users | `/api/users/`, `/api/users/create/`, `/api/users/<pk>/`, `/api/users/<pk>/update/`, `.../activate/`, `.../deactivate/`, `.../approve/`, `.../delete/` | GET / POST |
| Students | `/api/students/`, `/api/students/create/`, `/api/students/<pk>/`, `.../update/`, `.../delete/` | GET / POST |
| Counseling | `/api/counseling/`, `/api/counseling/create/`, `/api/counseling/<pk>/`, `.../update/`, `.../close/`, `.../notes/add/`, `.../delete/` | GET / POST |
| Referrals | `/api/referrals/`, `/api/referrals/create/`, `/api/referrals/<pk>/`, `.../update/`, `.../updates/add/`, `.../close/`, `.../delete/` | GET / POST |
| Inventory | `/api/inventory/`, `/api/inventory/create/`, `/api/inventory/<pk>/`, `.../update/`, `.../adjust/`, `.../delete/`, `/api/inventory/stock-monitoring/` | GET / POST |
| Borrowed | `/api/borrowed/`, `/api/borrowed/create/`, `/api/borrowed/<pk>/return/` | GET / POST |
| Notifications | `/api/notifications/`, `/api/notifications/unread-count/`, `/api/notifications/<pk>/read/`, `/api/notifications/mark-all-read/` | GET / POST |
| Reports | `/api/reports/`, `/api/reports/students/`, `/api/reports/counseling/`, `/api/reports/referrals/`, `/api/reports/inventory/`, `/api/reports/borrowing/`, `/api/reports/user-activity/` | GET |
| Settings | `/api/school/public/`, `/api/school/settings/`, `/api/school/settings/update/` | GET / POST |
| Account | `/api/account/profile/`, `/api/account/password/` | POST |
| Audit | `/api/audit/logs/`, `/api/audit/login-logs/` | GET |

## Notes

- The desktop app uses **session-based auth** (cookies) — same as the web version
- Theme is persisted in `localStorage` and synced to the OS via `nativeTheme`
- All routing is hash-based (`#/dashboard`, `#/students/123`, etc.)
- Permission checks happen both in api.py (authoritative) and in the renderer (UX hints)
