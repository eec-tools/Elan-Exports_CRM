# Attendance, Leave & Payroll System — Implementation Plan

## Tech Stack
- **Backend**: Node.js + TypeScript + Express + Prisma ORM + PostgreSQL
- **Frontend**: React + TypeScript + Tailwind CSS
- **Auth**: Existing JWT auth system (re-use)
- **DB**: Extend existing Prisma schema with new models

---

## 1. Database Schema Changes

### 1.1 Extend `users` table (add new columns)

```prisma
model User {
  // ... existing fields ...

  // NEW FIELDS
  monthlySalary     Float?    @map("monthly_salary")
  employeeStatus    EmployeeStatus @default(probation) @map("employee_status")
  gender            Gender?
  designation       String?
  bankAccountNumber String?   @map("bank_account_number")
  bankName          String?   @map("bank_name")
  bankIfsc          String?   @map("bank_ifsc")

  // Relations
  leaves            Leave[]
  payrolls          Payroll[]
}

enum EmployeeStatus {
  intern
  probation
  confirmed
}

enum Gender {
  male
  female
}
```

### 1.2 New `Leave` model

```prisma
model Leave {
  id          String      @id @default(uuid())
  userId      String      @map("user_id")
  startDate   DateTime    @map("start_date") @db.Date
  endDate     DateTime    @map("end_date") @db.Date
  numberOfDays Int        @map("number_of_days")
  reason      String?
  status      LeaveStatus @default(pending)
  reviewedBy  String?     @map("reviewed_by")
  reviewedAt  DateTime?   @map("reviewed_at")
  createdAt   DateTime    @default(now()) @map("created_at")
  updatedAt   DateTime    @updatedAt @map("updated_at")
  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([startDate, endDate])
  @@map("leaves")
}

enum LeaveStatus {
  pending
  approved
  rejected
}
```

### 1.3 New `Payroll` model

```prisma
model Payroll {
  id               String   @id @default(uuid())
  userId           String   @map("user_id")
  month            Int      // 1–12
  year             Int
  workingDays      Int      @map("working_days")
  presentDays      Float    @map("present_days")
  approvedLeaves   Float    @map("approved_leaves")
  absentDays       Float    @map("absent_days")
  grossSalary      Float    @map("gross_salary")
  professionalTax  Float    @map("professional_tax")
  netSalary        Float    @map("net_salary")
  generatedAt      DateTime @default(now()) @map("generated_at")
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, month, year])
  @@map("payrolls")
}
```

### 1.4 Attendance model changes

The existing `Attendance` model uses `startTime`/`endTime`. We will re-use it as-is and alias:
- `startTime` → Clock In
- `endTime` → Clock Out
- `status` → `Present | Absent | HalfDay | WeeklyOff | Leave`

Add `WeeklyOff` and `Leave` to the `AttendanceStatus` enum.

### 1.5 Settings model (configurable weekly offs)

```prisma
model AttendanceSettings {
  id              String  @id @default(uuid())
  saturdayOff     Boolean @default(true)  @map("saturday_off")
  sundayOff       Boolean @default(true)  @map("sunday_off")

  @@map("attendance_settings")
}
```

---

## 2. Backend Implementation

### 2.1 File Structure (new files to create)

```
backend/src/
  controllers/
    leave.controller.ts         ← Leave CRUD + approve/reject
    payroll.controller.ts       ← Generate + fetch payroll
    employees.controller.ts     ← Employee management (salary, status, etc.)
  routes/
    leave.routes.ts
    payroll.routes.ts
    employees.routes.ts
  services/
    payroll.service.ts          ← Core salary calculation logic
    leave.service.ts            ← Leave balance logic
    attendance.service.ts       ← Extend existing utils
  utils/
    professionalTax.ts          ← PT calculation rules
```

### 2.2 Attendance Module Changes

**File**: `backend/src/controllers/attendance.controller.ts` (extend existing)

#### Clock In
- Check if attendance record exists for today (IST date)
- If exists → return error "Already clocked in"
- Create new attendance record with `startTime = now()`
- Set status to `Present`

#### Clock Out
- Fetch today's attendance record
- If no record or `startTime` is null → return error "Not clocked in"
- If `endTime` already set → return error "Already clocked out"
- Update `endTime = now()`

#### Absent Marking (Daily Cron / Admin trigger)
- For each active employee, if no attendance record for today and today is a working day → create record with `status = Absent`

#### Weekly Off Logic
- Read `AttendanceSettings` (saturdayOff, sundayOff)
- On those days, automatically create attendance with `status = WeeklyOff` (do not require clock in)

### 2.3 Leave Controller (`leave.controller.ts`)

```
POST /api/leaves              ← Employee submits leave
GET  /api/leaves              ← Employee views own leaves
GET  /api/leaves/balance      ← Employee views leave balance
GET  /api/admin/leaves        ← Admin views all pending leaves
PATCH /api/admin/leaves/:id/approve   ← Admin approves
PATCH /api/admin/leaves/:id/reject    ← Admin rejects
```

#### Leave Balance Logic
- Confirmed employees get 14 days/year
- Count approved leaves in the current calendar year for the user
- Balance = 14 − used

#### Eligibility Check
- If `employeeStatus` is `intern` or `probation` → reject with "Only confirmed employees can apply for paid leave"

### 2.4 Payroll Service (`services/payroll.service.ts`)

#### Core Function: `generatePayroll(userId, month, year)`

```typescript
async function generatePayroll(userId: string, month: number, year: number) {
  const user = await getUser(userId); // includes monthlySalary, gender, employeeStatus

  // 1. Determine working days in the month
  const workingDays = getWorkingDaysInMonth(month, year, settings);
  // All days in month INCLUDING Sat/Sun per spec

  // 2. Count present days (attendance status = Present or HalfDay)
  const presentDays = await countPresentDays(userId, month, year);

  // 3. Count approved leaves
  const approvedLeaves = await countApprovedLeaves(userId, month, year);

  // 4. Calculate
  const perDaySalary = user.monthlySalary / workingDays;
  const paidDays = presentDays + approvedLeaves;
  const grossSalary = perDaySalary * paidDays;
  const absentDays = workingDays - paidDays;

  // 5. Professional Tax
  const professionalTax = calculatePT(user.monthlySalary, user.gender, month);

  // 6. Net Salary
  const netSalary = grossSalary - professionalTax;

  // 7. Upsert payroll record
  return prisma.payroll.upsert({ ... });
}
```

#### Working Days Calculation

```typescript
function getWorkingDaysInMonth(month: number, year: number, settings: AttendanceSettings): number {
  // Count ALL days in the month (calendar days)
  // Per spec: "Per Day Salary = Monthly Salary / Working Days (Includes Saturdays and Sundays)"
  // So working days = total days in month minus configured weekly offs
  const daysInMonth = new Date(year, month, 0).getDate();
  let workingDays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay(); // 0=Sun, 6=Sat
    if (dow === 0 && settings.sundayOff) continue;
    if (dow === 6 && settings.saturdayOff) continue;
    workingDays++;
  }
  return workingDays;
}
```

#### Professional Tax (`utils/professionalTax.ts`)

```typescript
function calculatePT(monthlySalary: number, gender: Gender, month: number): number {
  // February override
  if (month === 2) {
    // Only if PT is applicable
    if (gender === 'female' && monthlySalary <= 25000) return 0;
    if (gender === 'male' && monthlySalary <= 7500) return 0;
    return 300;
  }

  if (gender === 'female') {
    if (monthlySalary <= 25000) return 0;
    return 200;
  }

  // Male
  if (monthlySalary <= 7500) return 0;
  if (monthlySalary <= 10000) return 175;
  return 200;
}
```

### 2.5 Payroll Controller (`controllers/payroll.controller.ts`)

```
POST /api/admin/payroll/generate         ← Generate for all employees (month/year)
GET  /api/admin/payroll?month=&year=     ← Get monthly payroll summary table
GET  /api/admin/payroll/:userId          ← Get payroll history for one employee
GET  /api/payroll/me                     ← Employee views own payroll
GET  /api/admin/payroll/:id/slip         ← Generate payroll slip (PDF or HTML)
```

### 2.6 Employee Controller (`controllers/employees.controller.ts`)

Extends existing `members.controller.ts` or creates new admin-only endpoints:

```
GET    /api/admin/employees              ← List all with salary/status
POST   /api/admin/employees             ← Create employee (with salary, status, gender)
PATCH  /api/admin/employees/:id         ← Update salary, status, designation, bank details
DELETE /api/admin/employees/:id         ← Deactivate
```

---

## 3. Frontend Implementation

### 3.1 New Pages

```
frontend/src/pages/
  LeavePage.tsx                ← Employee: apply for leave, view balance & history
  PayrollPage.tsx              ← Employee: view own payroll slips
  admin/
    AdminLeavesPage.tsx        ← Admin: approve/reject leave requests
    AdminPayrollPage.tsx       ← Admin: generate & view payroll summary
    AdminEmployeesPage.tsx     ← Admin: manage employees (salary, status, bank)
    PayrollSlipPage.tsx        ← Admin: view/print individual payroll slip
```

### 3.2 Employee UI Changes

**Attendance Dashboard** (`AttendanceDashboardPage.tsx`) — already exists, extend with:
- Simple Clock In / Clock Out buttons (keep existing logic)
- Show today's status clearly

**Leave Page** (`LeavePage.tsx`):
- Leave balance widget (used / remaining out of 14)
- Apply leave form: date range picker + reason
- Leave history table: date range, days, status (pending/approved/rejected)
- Disable form if `employeeStatus` is intern or probation with message

**Payroll Page** (`PayrollPage.tsx`):
- Dropdown to select month/year
- Payroll slip card showing all fields
- Print / Download slip button

### 3.3 Admin UI Changes

**Admin Leaves Page** (`AdminLeavesPage.tsx`):
- Table of all leave requests with employee name, dates, days, reason, status
- Approve / Reject buttons on pending rows

**Admin Payroll Page** (`AdminPayrollPage.tsx`):
- Month/Year selector
- "Generate Payroll" button → calls generate API
- Summary table:

| Employee | Designation | Present | Leaves | Absent | Gross | PT | Net |
|----------|-------------|---------|--------|--------|-------|----|-----|

- Row click → open PayrollSlipPage

**Admin Employees Page** (`AdminEmployeesPage.tsx`):
- List employees with name, designation, status, monthly salary
- Add/Edit employee modal with all fields:
  - Name, Email, Password (on create)
  - Monthly Salary
  - Status (intern/probation/confirmed)
  - Gender
  - Designation
  - Bank details (account number, bank name, IFSC)

### 3.4 Payroll Slip (`PayrollSlipPage.tsx`)

Printable slip layout:

```
┌─────────────────────────────────────────────┐
│           ELAN EXPORTS                      │
│         Salary Slip — March 2026            │
├──────────────────┬──────────────────────────┤
│ Employee Name    │ John Doe                 │
│ Designation      │ Sales Manager            │
│ Month / Year     │ March 2026               │
├──────────────────┼──────────────────────────┤
│ Working Days     │ 26                       │
│ Present Days     │ 22                       │
│ Approved Leaves  │ 2                        │
│ Absent Days      │ 2                        │
├──────────────────┼──────────────────────────┤
│ Monthly Salary   │ ₹ 30,000                 │
│ Per Day Salary   │ ₹ 1,153.85              │
│ Gross Salary     │ ₹ 27,692.31             │
├──────────────────┼──────────────────────────┤
│ Professional Tax │ - ₹ 200                  │
├──────────────────┼──────────────────────────┤
│ NET SALARY       │ ₹ 27,492.31             │
└──────────────────┴──────────────────────────┘
│ Bank: HDFC Bank  | A/C: XXXX1234 | IFSC: HDFC0001 │
```

Use `window.print()` with print-specific CSS, or generate PDF via a library like `jsPDF` or `html2canvas`.

---

## 4. API Routes Summary

### Auth (existing)
| Method | Route | Role |
|--------|-------|------|
| POST | /api/auth/login | Public |

### Attendance (extend existing)
| Method | Route | Role |
|--------|-------|------|
| POST | /api/attendance/clock-in | Employee |
| POST | /api/attendance/clock-out | Employee |
| GET | /api/attendance/today | Employee |
| GET | /api/attendance/me?month=&year= | Employee |
| GET | /api/admin/attendance?date=&userId= | Admin |

### Leave
| Method | Route | Role |
|--------|-------|------|
| POST | /api/leaves | Employee |
| GET | /api/leaves | Employee |
| GET | /api/leaves/balance | Employee |
| GET | /api/admin/leaves | Admin |
| PATCH | /api/admin/leaves/:id/approve | Admin |
| PATCH | /api/admin/leaves/:id/reject | Admin |

### Payroll
| Method | Route | Role |
|--------|-------|------|
| POST | /api/admin/payroll/generate | Admin |
| GET | /api/admin/payroll | Admin |
| GET | /api/admin/payroll/:userId | Admin |
| GET | /api/admin/payroll/:userId/slip | Admin |
| GET | /api/payroll/me | Employee |

### Employees
| Method | Route | Role |
|--------|-------|------|
| GET | /api/admin/employees | Admin |
| POST | /api/admin/employees | Admin |
| PATCH | /api/admin/employees/:id | Admin |

---

## 5. Business Rules Summary

| Rule | Logic |
|------|-------|
| One clock-in per day | Check existing attendance record before insert |
| One clock-out per day | Check `endTime` is null before update |
| No clock-out without clock-in | Check `startTime` is not null |
| Present if clocked in, no clock-out | `status = Present` as long as `startTime` exists |
| Weekly off (Sat/Sun configurable) | Auto-create `WeeklyOff` records; excluded from absent calc |
| Intern/Probation no paid leave | Return 403 if `employeeStatus !== confirmed` |
| Leave eligibility | 14 days/year for confirmed employees |
| Approved leave = paid | Count in `paidDays` for salary |
| Rejected/no request = unpaid | Not counted in `paidDays` |
| PT Maharashtra (Male) | ≤7500→0, 7501-10000→175, >10000→200, Feb→300 |
| PT Maharashtra (Female) | ≤25000→0, >25000→200, Feb→300 |
| Per day salary | `monthlySalary / workingDaysInMonth` |
| Gross salary | `perDaySalary × (presentDays + approvedLeaves)` |
| Net salary | `grossSalary − professionalTax` |

---

## 6. Implementation Order

### Phase 1 — Schema & Backend Foundation
1. Add new fields to `User` model (monthlySalary, employeeStatus, gender, designation, bank details)
2. Add `Leave` model and `Payroll` model to Prisma schema
3. Add `WeeklyOff` and `Leave` to `AttendanceStatus` enum
4. Add `AttendanceSettings` model
5. Run Prisma migration
6. Seed default `AttendanceSettings` row

### Phase 2 — Employee Management API
7. Create `employees.controller.ts` and `employees.routes.ts`
8. Add admin routes for CRUD on employees

### Phase 3 — Leave System API
9. Create `leave.controller.ts` and `leave.routes.ts`
10. Implement leave balance calculation
11. Implement approve/reject endpoints

### Phase 4 — Payroll API
12. Create `professionalTax.ts` utility
13. Create `payroll.service.ts` with full calculation logic
14. Create `payroll.controller.ts` and `payroll.routes.ts`
15. Implement generate payroll endpoint
16. Implement payroll slip endpoint

### Phase 5 — Frontend: Employee Views
17. Update `AttendanceDashboardPage.tsx` with clean clock-in/out UI
18. Create `LeavePage.tsx`
19. Create `PayrollPage.tsx`

### Phase 6 — Frontend: Admin Views
20. Create `AdminEmployeesPage.tsx`
21. Create `AdminLeavesPage.tsx`
22. Create `AdminPayrollPage.tsx`
23. Create `PayrollSlipPage.tsx` with print support

### Phase 7 — Routing & Navigation
24. Add new pages to router
25. Add nav links for admin vs employee role
26. Guard routes by role

---

## 7. Key Decisions & Notes

- **Existing attendance system**: The current system uses `startTime`/`endTime` + heartbeats for tracking. The new clock-in/out for payroll will reuse this exact model — `startTime` = clock-in, `endTime` = clock-out.
- **IST timezone**: Existing code uses `ATTENDANCE_TZ_OFFSET_MINUTES=330` — keep this for all date operations.
- **Working days definition**: Per spec, working days include Saturdays and Sundays by default (only weekly-off-configured days are excluded). The "Per Day Salary" divides by these working days.
- **No cron required for MVP**: Absent marking can be done lazily when payroll is generated, or triggered manually by admin. Keep it simple.
- **Payroll slip**: Use browser print (`window.print()`) for MVP. No PDF library needed initially.
- **Leave overlap**: Validate that a new leave request doesn't overlap with an existing approved/pending leave.
- **Backend enums**: Add `EmployeeStatus`, `Gender`, `LeaveStatus` enums to Prisma schema.
- **Auth**: Reuse existing JWT middleware. Admin check = role `admin` in `UserRole` table.
