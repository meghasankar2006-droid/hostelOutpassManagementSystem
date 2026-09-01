# Smart Hostel Management System

A role-based hostel management platform for Students, Department staff (Advisor/HOD),
Wardens, and a Super Admin — built with plain HTML/CSS/JS on the frontend and
Node.js + Express + MongoDB on the backend, exactly as specified (no frameworks).

---

## 1. Setup

**Requirements:** Node.js 18+, MongoDB running locally (or a connection string to
a remote instance, e.g. MongoDB Atlas).

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# then edit .env — at minimum change JWT_SECRET to your own random string,
# and point MONGO_URI at your MongoDB instance if it isn't local.

# 3. Make sure MongoDB is running
#    (locally: `mongod`, or use a MongoDB Atlas URI in .env)

# 4. Seed demo data (departments, hostels, rooms, one user per role)
npm run seed

# 5. Start the server (serves both the API and the frontend on the same port)
npm start
```

Then open **http://localhost:5000** (or whatever `PORT` you set) in your browser.

### Demo logins (after seeding, password for all: `password123`)

| Role | Email |
|---|---|
| Super Admin | admin@hostel.com |
| HOD | hod.cs@hostel.com |
| Advisor | advisor.cs@hostel.com |
| Warden | warden.a@hostel.com |
| Student | student1@hostel.com |

---

## 2. What was actually wrong with the original project

The **backend** was genuinely well-built — a real approval-chain state machine on
the `Request` model, proper role-based middleware, clean Mongoose schemas. It was
not the "almost nothing works" state the brief described. The real problems were:

1. **A confirmed dead workflow:** the Department dashboard's frontend called
   `GET /department/requests/hod` and `GET /department/requests/advisor`, but
   those routes never existed on the backend (the real route was always
   `GET /department/requests`). The entire Department queue silently failed to load.
2. **Hardcoded `http://localhost:5000`** in the frontend JS — broke the moment the
   app wasn't run on that exact host/port.
3. A literal **`<button disabled>Edit</button>`** on the departments table.
4. **No password reset** anywhere in the system.
5. **No edit/delete** for Hostels, Blocks, Rooms, or Departments — create-only.
6. The Student dashboard surfaced almost none of what the backend already
   supported (room info, notifications, mess feedback, approval history).
7. Department/Warden/Admin dashboards were missing stats, analytics, room
   occupancy, and management screens relative to what the backend could do.
8. Notifications only ever reached the student — advisors/HODs were never
   notified that a new request needed their review.

## 3. What changed

### Backend
- Fixed `server.js`: static file serving now resolves relative to the file
  itself (not the process's working directory), added an SPA-style catch-all
  route, mounted a new shared `/api/notifications` router.
- Added `PUT /api/auth/change-password` (self-service) and
  `PUT /api/admin/users/:id/reset-password` (Super Admin resets anyone).
- Added full edit/delete for Hostels, Blocks, Rooms, and Departments — all with
  guardrails (e.g. you can't delete a hostel that still has blocks, or a room
  with students still allocated to it).
- Added `POST /api/admin/deallocate` to remove a student from their room.
- Wired notifications so Advisors/HODs are notified the moment a student
  submits a request, and Wardens are notified on new complaints (previously
  only the student ever received notifications).
- Extracted a generic `notificationController`/`notificationRoutes` shared by
  every role instead of duplicating notification code per-role.

### Frontend — complete rebuild
- **New design system** (`css/style.css`): an institutional identity (ink navy
  + brass) built around the subject of the app — a chain-of-approval ledger —
  rather than a generic SaaS template. Includes a signature "approval ledger"
  stepper component used everywhere a request's Student → Advisor/HOD → Warden
  history needs to be shown, always populated from real MongoDB data (real
  names, real timestamps, real rejection reasons — never hardcoded).
- **`js/common.js`**: shared runtime used by every dashboard — a relative-URL
  `fetchApi` wrapper (fixes the hardcoded-host bug), real toast notifications,
  a real confirm-modal (replacing every `alert()`/`confirm()`/`prompt()`),
  the auth guard, sidebar navigation, and the notification bell.
- **Login page**: role tabs, password visibility toggle, real loading/error
  states, demo credentials shown per role.
- **Student dashboard**: overview with live stats, the full outpass/leave flow
  including the Advisor-vs-HOD routing choice, complaints (Hostel/Room/Mess),
  mess feedback with a real star rating, and room/hostel/roommates info.
- **Department dashboard** (Advisor & HOD share one dashboard, gated by role
  via `GET /department/me`): analytics, a "needs my action" queue plus full
  history, student roster, advisor roster (HOD-only), and attendance marking.
- **Warden dashboard**: hostel-wide analytics, final outpass approval, complaint
  triage with status + resolution notes, a room-occupancy grid grouped by
  block, and mess feedback.
- **Super Admin dashboard**: full system analytics, user management (create/edit/
  disable/delete/reset password, role-conditional fields), department
  management, hostel & block management, and room management with student
  allocation/deallocation.
- Every button that previously did nothing now calls a real endpoint; every
  list is populated from a real API response; there are no hardcoded stats,
  names, or records anywhere in the rebuilt pages.

## 4. What I verified, and how

Because the rebuild happened in an environment without MongoDB or a browser,
I could not click through the running app the way a full QA pass normally
would. What I *did* verify, mechanically, not just by inspection:

- Every backend file passes `node --check` (syntax-valid).
- Every route file (`authRoutes`, `adminRoutes`, `studentRoutes`,
  `departmentRoutes`, `wardenRoutes`, `notificationRoutes`) loads without any
  undefined-handler errors — i.e. every controller function referenced by a
  route actually exists and is exported.
- Every frontend JS file passes `node --check`.
- Every `fetchApi(...)` call across all five pages was cross-referenced
  line-by-line against the real backend route list — zero mismatches, zero
  leftover dead endpoints.
- Every `getElementById(...)` referenced in each dashboard's JS was
  cross-referenced against that dashboard's HTML — zero missing IDs.
- Every `onclick="..."` handler (both static, in the HTML, and dynamically
  generated inside template strings in the JS) was cross-referenced against
  actual function definitions — zero missing functions.
- Every model field name used by the frontend (e.g. `advisorApprovedBy`,
  `wardenStatus`, `occupants`, `roommates`) was checked directly against the
  Mongoose schema it comes from.

## 5. What is **not** verified

I want to be direct about this rather than imply a false "PASS":

- **No live database test was performed.** I could not start `mongod` or run
  the seeder against a real database in this environment, so record creation,
  updates, and the exact shape of populated documents at runtime are not
  confirmed — only the code that produces them.
- **No browser test was performed.** No clicking through the actual rendered
  UI, no checking the browser console for runtime errors, no visual QA on
  responsive breakpoints, no confirming CSS renders as intended.
- **The full end-to-end user journey in the original spec** (Super Admin
  creates a department → HOD → Advisor → Warden → Student → student applies
  → advisor approves → HOD approves → warden approves → student sees the
  right names) was traced through the code path by path, but never actually
  executed.
- I have **not** extracted this ZIP into a fresh folder and run it end-to-end,
  because doing so requires the same MongoDB/browser environment noted above.

If you run this locally and hit anything, the two most useful things to check
first are the backend terminal output and the browser console — please share
either if something doesn't work as expected.

## 6. Tech stack (unchanged, as required)

HTML, CSS, JavaScript, Node.js, Express.js, MongoDB (Mongoose). No React,
Vue, Angular, TypeScript, Tailwind, Bootstrap, or any other framework was
introduced.
