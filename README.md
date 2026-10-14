# College Classroom Allocator & Reservation System

A production-ready, secure, serverless college classroom allocation and reservation web application built with **React**, **TypeScript**, **Vite**, and **Supabase PostgreSQL**.

---

## 1. System Overview & Technology Stack

- **Frontend:** React 19, TypeScript, Vite.
- **Visual Design:** Strictly two solid colors throughout the entire application:
  - **Pure White:** `#FFFFFF`
  - **Solid Purple:** `#5B21B6`
  - Zero gradients, zero neon colors, zero multicolor backgrounds.
  - All room states (Available, Occupied by Official Lecture, Reserved by Faculty, Inactive) are communicated with clear typography, high-contrast badges, and accessible SVG icons.
- **Database & Auth:**
  - Supabase PostgreSQL with database-enforced Row Level Security (RLS).
  - PostgreSQL exclusion constraints (`btree_gist`) and transactional advisory locking (`pg_advisory_xact_lock`) to mathematically eliminate concurrent double bookings.
  - Supabase Auth for one-way password hashing and secure session issuance.
  - Server-side username-to-authentication mapping via Supabase Edge Functions.
  - Supabase Realtime / cross-tab broadcast for live availability synchronization.
- **Dual-Mode Engine:**
  - Fully connects to cloud Supabase when `.env.local` is configured.
  - Seamlessly runs in local verified database & auth mode with identical schemas, transactional checks, and initial bootstrap accounts for immediate offline verification.

---

## 2. Access Modes & Roles

| Role | Access Mode | Permissions |
| :--- | :--- | :--- |
| **Reader** | Public (Unauthenticated) | Can view floors, classrooms, availability for selected dates/times, and scheduled timetable lectures and faculty reservations (with faculty name and interval). Redirected to login if attempting to reserve. |
| **Faculty** | Authenticated (`role: 'faculty'`) | Can browse availability, make transactional classroom reservations, cancel their own eligible bookings, view other faculty reservation intervals, and change their username & password. Must change temporary password on first login. |
| **Admin** | Authenticated (`role: 'admin'`) | Full control over floors (CRUD), classrooms (CRUD), timetable management (CSV/Excel upload, conflict detection, manual schedule), faculty account provisioning and credential resets, all reservation records, and usage analytics. |

---

## 3. Initial Built-in Administrator Account

The application supports an initial bootstrap administrator account with these bootstrap credentials:

- **Username:** `Admin123`
- **Password:** `Admin@123`
- **Role:** `admin`

### Forced Password Change on First Access
- Upon initial sign-in, the security layer intercepts the session and displays the **`REQUIRED: CHANGE INITIAL PASSWORD`** modal.
- Dashboard access is strictly blocked until the default password is replaced with a new secure password.
- Once updated, `must_change_password` is set to `false`, and normal administration access is granted.
- The bootstrap procedure automatically disables itself once an administrator exists, preventing unauthorized creation of subsequent administrators.

---

## 4. Environment Configuration

### Frontend Variables (`.env.local`)
Create a `.env.local` file in the project root:

```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

An `.env.example` file is included with template placeholders.

> **Security Rule:** Never place secret service-role keys or database passwords into `VITE_` frontend variables. All privileged operations are executed through server-side Edge Functions or PostgreSQL functions.

---

## 5. Database Schema & Migrations

The full PostgreSQL migration script is located at:
[`supabase/migrations/20241014000000_init_classroom_allocator.sql`](supabase/migrations/20241014000000_init_classroom_allocator.sql)

### Core Tables
1. **`profiles`**: User ID (`auth.users`), `username` (case-insensitive unique index), `full_name`, `role` (`admin`/`faculty`/`reader`), `status` (`active`/`disabled`), `must_change_password`.
2. **`floors`**: `id`, `name` (unique), `display_order`.
3. **`classrooms`**: `id`, `room_number` (unique), `floor_id`, `capacity`, `is_active`.
4. **`timetable_events`**: `id`, `classroom_id`, `subject`, `faculty_name`, `day_of_week` (1=Mon ... 7=Sun), `start_time`, `end_time`, `specific_date`, `semester`, `is_active`.
5. **`reservations`**: `id`, `classroom_id`, `faculty_id`, `start_time` (TIMESTAMPTZ), `end_time` (TIMESTAMPTZ), `purpose`, `status` (`confirmed`/`cancelled`).
   - Protected by exclusion constraint `exclude_overlapping_confirmed_reservations` using `btree_gist`.
6. **`audit_logs`**: `id`, `actor_id`, `action`, `entity_type`, `entity_id`, `details`, `created_at`.
7. **`auth_username_lookup`**: Private server-side lookup mapping `username` to internal Auth identity `email`.

### Database Functions (RPC)
- `check_classroom_availability(p_classroom_id, p_start, p_end)`: Computes availability based on timetable events and reservations. Overlap formula:
  $$\text{requested\_start} < \text{existing\_end} \quad \text{AND} \quad \text{requested\_end} > \text{existing\_start}$$
  Consecutive bookings ($\text{requested\_start} = \text{existing\_end}$) are explicitly permitted.
- `reserve_classroom(p_classroom_id, p_start, p_end, p_purpose)`: Concurrency-safe booking function utilizing `pg_advisory_xact_lock`.
- `cancel_reservation(p_reservation_id)`: Verifies ownership or admin role, marks reservation as `cancelled`, and writes to `audit_logs`.
- `change_username(p_new_username)`: Validates format, enforces case-insensitive uniqueness, updates `profiles` and `auth_username_lookup`.
- `admin_detect_timetable_conflicts(...)`: Detects if a new lecture schedule conflicts with existing faculty reservations.

---

## 6. Server-Side Supabase Edge Functions

Located in [`supabase/functions/`](supabase/functions/):

1. **`bootstrap-admin`**: Privately creates `Admin123` with `Admin@123` if no administrator exists yet.
2. **`auth-login`**: Resolves usernames case-insensitively, verifies active status, and authenticates through Supabase Auth without exposing internal email identities.
3. **`admin-create-faculty`**: Admin-only endpoint using Supabase Auth Admin API to provision new faculty accounts and set `must_change_password = true`.
4. **`admin-reset-password`**: Admin-only endpoint to set a new temporary password and force a password change upon next login.

---

## 7. Official Timetable Import Format (CSV)

To bulk-import semester lecture schedules, upload a CSV file with the following headers:

```csv
Room Number,Subject,Faculty,Day,Start Time,End Time,Semester
G-101,Advanced Algorithms,Prof. John Smith,1,09:00,10:30,Fall 2026
G-102,Computer Architecture,Dr. Clara Watson,2,11:00,12:30,Fall 2026
F-201,Software Engineering,Dr. Robert Lang,3,14:00,15:30,Fall 2026
F-202,Cloud Computing,Prof. Sarah Jenkins,4,09:30,11:00,Fall 2026
S-301,Compiler Design,Prof. Michael Chang,5,10:00,11:30,Fall 2026
```

### Import Rules:
- **Day:** Integer from 1 (Monday) to 7 (Sunday).
- **Time:** 24-hour format `HH:mm` (e.g. `09:00`, `14:30`).
- **Conflict Prevention:** The import preview validates room existence, time formats, and automatically identifies conflicts with active faculty reservations before committing.

---

## 8. Running the Application Locally

```bash
# 1. Install dependencies
npm install

# 2. Build and verify TypeScript types
npm run build

# 3. Start development server
npm run dev
```

Open `http://localhost:5173/` in your browser.

---

## 9. Verification Summary

- [x] **Strict Visual Design:** Pure white `#FFFFFF` and solid purple `#5B21B6` palette strictly applied.
- [x] **Reader Mode:** Publicly viewable, real-time schedule displays, booking attempts redirected to login.
- [x] **Bootstrap Admin:** Provisioned `Admin123` / `Admin@123`, forced initial password change before dashboard access.
- [x] **Faculty Workflow:** Username/password authentication, room availability filter, transactional booking, and cancellation.
- [x] **Overlap Prevention:** Mathematical interval check (`requested_start < existing_end AND requested_end > existing_start`), back-to-back booking support.
- [x] **Timetable Import:** CSV parsing, row error validation, and reservation conflict detection.
- [x] **Admin Analytics:** Computed from database records (Total bookings, hours, per faculty, per room, floor usage, cancellation tracking, trends).
- [x] **Zero TypeScript Errors:** Verified with `tsc -b && vite build`.
