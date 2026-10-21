# College Classroom Allocator & Reservation System

A production-ready, secure, serverless college classroom allocation and reservation web application built with **React**, **TypeScript**, **Vite**, and **Supabase PostgreSQL**.

---

## 1. System Overview & Technology Stack

- **Frontend:** React 19, TypeScript, Vite.
- **Visual Design:** High-contrast solid purple and white monochrome palette:
  - **Solid Deep Purple:** `#3B0B3A`
  - **Pure White:** `#FFFFFF`
  - Strict performance rule: zero transitions, zero animations, crisp instant state updates.
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
| **Faculty** | Authenticated (`role: 'faculty'`) | Can browse availability, make transactional classroom reservations for current/future slots only (past slot bookings strictly blocked), cancel their own eligible bookings, view other faculty reservation intervals, and change their username & password. Official timetable is hidden. Must change temporary password on first login. |
| **Admin** | Authenticated (`role: 'admin'`) | Full control over floors (CRUD), classrooms (CRUD), timetable management (Mon–Sat CSV import with sections, conflict detection, manual schedule), faculty account provisioning and credential resets, all reservation records with multi-range date filters, and usage analytics. |

---

## 3. Responsive Mobile Navigation

The application provides a fully optimized mobile experience:
- **Stable Navigation Subbar:** Positioned directly beneath the top bar for both Admin and Faculty modes, in natural document flow with zero floating or overlapping over user badges or headers.
- **Symbol-Only Button:** A clean, minimal toggle button (`PanelLeftOpen`) without cluttering text.
- **Full-Screen Sidebar Drawer:** When expanded on mobile screens (`<= 768px`), the navigation drawer covers the entire screen (`100vw` / `100vh`), providing large, touch-friendly navigation options and a dedicated top-right close button (`X`).

---

## 4. Initial Built-in Administrator Account

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

## 5. Official Timetable Import Format (CSV)

To bulk-import semester lecture schedules, upload a CSV file following these specifications:

### Supported CSV Structure
```csv
Section: BCA A
Day,Time,Room,Floor,Subject,Faculty
Monday,09:00 AM - 10:30 AM,101,Ground Floor,Database Management Systems,Dr. Sharma
Tuesday,11:00 AM - 12:30 PM,202,Second Floor,Operating Systems,Prof. Patil
Wednesday,01:00 PM - 02:30 PM,301,Third Floor,Computer Networks,Dr. Kulkarni
Thursday,09:00 AM - 10:30 AM,102,Ground Floor,Software Engineering,Prof. Deshmukh
Friday,11:00 AM - 12:30 PM,203,Second Floor,Data Structures & Algorithms,Dr. Joshi
Saturday,02:00 PM - 03:30 PM,302,Third Floor,Web Development Lab,Prof. Verma
```

### Import Rules:
1. **Section Heading or Column:**
   - The section (e.g. `BCA A`, `BCA B`) can be specified **once at the very top of the CSV** as a heading (e.g., `Section: BCA A`, `Section - BCA B`, or a standalone header cell `BCA A`).
   - Alternatively, a dedicated `Section` column can be included to set sections on a per-row basis.
2. **Day Column:**
   - Day names must be provided as text (e.g., `Monday` or `Mon`, `Tuesday` or `Tues` ... `Saturday` or `Sat`).
   - **Sunday is strictly disallowed** for college timetables; Sunday entries are flagged with validation errors.
3. **Combined Time Slot Column:**
   - Recognizes combined start and end times effortlessly:
     - `09:00 AM - 10:30 AM`
     - `1:00 PM - 2:30 PM`
     - `09:00 - 10:30` (24-hour)
     - `9:00am to 10:30am`
4. **Room & Floor Explicit Assignment:**
   - Missing classrooms are automatically created under the **exact Floor specified in the CSV**.
   - Room-number prefix digit floor assumptions (e.g., `2xx -> 2nd Floor`) have been completely removed.
5. **Conflict Prevention:**
   - The import preview validates room existence, time formats, and automatically identifies conflicts with active faculty reservations before committing.

---

## 6. Past Booking Prevention

Faculty cannot schedule rooms for past dates or times:
- **Date Picker Constraint:** The filter bar date selector sets `min` to today's local date, preventing past date selection.
- **Real-Time Room Availability:** If today's date is selected with a start time that has already elapsed (e.g. at 7:00 PM selecting 9:00 AM), available rooms display `"Time Slot Passed"` and the reserve button is disabled.
- **Modal Block:** The schedule modal checks requested slot against current wall-clock time, shows an alert warning banner, and disables form submission.
- **Storage & Backend Security:** Rejections are enforced at the storage engine and PostgreSQL database level (`reserve_classroom` stored procedure).

---

## 7. Admin Panel: All Reservations Date Filter

Under the **All Reservations** tab, administrators can filter records by date:
- **Defaults to Today** on initial load.
- Dropdown options:
  - **Today**
  - **Yesterday**
  - **Last Week** (past 7 days)
  - **Last Month** (past 30 days)
  - **Custom Date** (renders interactive calendar date picker)
  - **All Dates**

---

## 8. Database Schema & Migrations

Located in [`supabase/migrations/`](supabase/migrations/):

1. **`20241014000000_init_classroom_allocator.sql`**: Initial schema, tables (`profiles`, `floors`, `classrooms`, `timetable_events`, `reservations`, `audit_logs`), Row Level Security (RLS), and transactional RPCs (`check_classroom_availability`, `reserve_classroom`, `cancel_reservation`).
2. **`20241015000000_cascade_floor_classroom_deletion.sql`**: Foreign key cascade rules for classroom and floor deletions.
3. **`20241016000000_prevent_past_reservations_and_add_section.sql`**: Adds `section` column to `timetable_events` and enforces past-booking prevention inside `reserve_classroom` RPC.

---

## 9. Environment Configuration

### Frontend Variables (`.env.local`)
Create a `.env.local` file in the project root:

```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

An `.env.example` file is included with template placeholders.

> **Security Rule:** Never place secret service-role keys or database passwords into `VITE_` frontend variables. All privileged operations are executed through server-side Edge Functions or PostgreSQL security-definer functions.

---

## 10. Running the Application Locally

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

## 11. Verification Checklist

- [x] **Strict Visual Design:** High-contrast solid purple `#3B0B3A` and pure white `#FFFFFF` palette. Zero animations.
- [x] **Mobile Sidebar:** Full-screen drawer (`100vw`/`100vh`) with top-right close button and stable subbar toggle trigger below top bar.
- [x] **Symbol-Only Button:** Sidebar trigger shows only the icon symbol on mobile, no cluttering text.
- [x] **Faculty Past Booking Blocked:** Past slots display `"Time Slot Passed"` with disabled buttons and server-side RPC validation.
- [x] **Faculty Timetable Hidden:** Official timetable view is completely hidden for faculty.
- [x] **All Reservations Date Filter:** Admin view defaults to Today, supports Yesterday, Last Week, Last Month, Custom Date, and All Dates.
- [x] **Timetable CSV Import:** Supports section preamble headings/columns, Mon–Sat day names (Sunday rejected), combined time slots, and explicit floor assignment without digit prefix guessing.
- [x] **Dual-Mode Engine:** Fully functional in both live Supabase mode and local offline verified mode.
- [x] **Zero Build / Lint Errors:** Verified with `tsc -b && vite build` and `oxlint`.
