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
  id                    String   @id @default(uuid())
  userId                String   @map("user_id")
  month                 Int      // 1–12
  year                  Int
  daysInMonth           Int      @map("days_in_month")       // actual calendar days (28/29/30/31)
  weekdayPresentDays    Float    @map("weekday_present_days")
  weekendWorkedDays     Float    @map("weekend_worked_days") // Sat/Sun days with checkbox ticked
  approvedLeavesMonth   Float    @map("approved_leaves_month")
  excessLeaveDays       Float    @map("excess_leave_days")   // leaves beyond 14-day annual quota
  paidDays              Float    @map("paid_days")           // weekdayPresent + weekendWorked + paidLeaves
  perDaySalary          Float    @map("per_day_salary")
  grossSalary           Float    @map("gross_salary")
  leaveSalaryDeduction  Float    @map("leave_salary_deduction")
  professionalTax       Float    @map("professional_tax")
  netSalary             Float    @map("net_salary")
  generatedAt           DateTime @default(now()) @map("generated_at")
  user                  User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, month, year])
  @@map("payrolls")
}
```

### 1.4 Attendance model change

The existing `Attendance` model uses `startTime`/`endTime`. Extend it with:
- `startTime` → Clock In
- `endTime` → Clock Out
- `status` → `Present | Absent | HalfDay | WeeklyOff | Leave`
- **NEW**: `isWeekendWork Boolean @default(false)` — checkbox admin/employee ticks when someone voluntarily works on Saturday or Sunday

Add `WeeklyOff` and `Leave` to the `AttendanceStatus` enum.

```prisma
// Add to existing Attendance model:
isWeekendWork   Boolean  @default(false) @map("is_weekend_work")
```

> When `isWeekendWork = true` on a Saturday/Sunday record, that day counts as a **paid worked day** in the salary calculation.

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

---

#### Generalised Salary Formula

```
daysInMonth        = actual calendar days in the month
                     (Jan=31, Feb=28 or 29, Mar=31, Apr=30, May=31, Jun=30,
                      Jul=31, Aug=31, Sep=30, Oct=31, Nov=30, Dec=31)

perDaySalary       = monthlySalary / daysInMonth

weekdayPresent     = attendance days on Mon–Fri with status = Present (or HalfDay × 0.5)
weekendWorked      = Sat/Sun attendance records where isWeekendWork = true
approvedLeavesYTD  = total approved leave days from Jan 1 to end of current month (this year)
approvedLeavesThisMonth = approved leaves falling within the current month

excessLeavesYTD      = max(0, approvedLeavesYTD − 14)
  -- once the annual quota of 14 days is exhausted, further leaves are unpaid

excessInThisMonth    = min(excessLeavesYTD, approvedLeavesThisMonth)
  -- portion of the annual excess that falls in this month

paidDays             = weekdayPresent + weekendWorked + approvedLeavesThisMonth
  -- ALL approved leaves are included here (paid + excess)

grossSalary          = perDaySalary × paidDays
  -- gross is calculated on all days including excess leave days

leaveSalaryDeduction = perDaySalary × excessInThisMonth
  -- excess leave days are then explicitly deducted as a line item
  -- this makes the deduction visible on the slip (transparent to employee)

professionalTax      = calculatePT(monthlySalary, gender, month)  [see PT table]

netSalary            = grossSalary − leaveSalaryDeduction − professionalTax
```

> **Why Method B (explicit deduction)?**
> `paidDays` includes ALL approved leaves so the gross shows what would have been earned..
> The `leaveSalaryDeduction` line item is then shown separately on the payroll slip — the employee
> can clearly see "you took 2 excess leave days, here is the exact amount deducted." This is more
> transparent than silently lowering `paidDays` with no explanation.
> There is **no double deduction** because excess days ARE included in `grossSalary` first,
> and deducted exactly once as `leaveSalaryDeduction`.

**Example — April 2026 (30 days), salary ₹30,000, 16 approved leaves YTD by April end**

| Variable | Value |
|---|---|
| daysInMonth | 30 |
| perDaySalary | ₹30,000 / 30 = **₹1,000** |
| weekdayPresent | 18 days |
| weekendWorked | 2 days (ticked checkbox) |
| approvedLeavesThisMonth | 4 days |
| approvedLeavesYTD | 16 days |
| excessLeavesYTD | 16 − 14 = **2 days** |
| excessInThisMonth | min(2, 4) = **2 days** |
| paidDays | 18 + 2 + 4 = **24 days** (all leaves included) |
| grossSalary | ₹1,000 × 24 = **₹24,000** |
| leaveSalaryDeduction | ₹1,000 × 2 = **−₹2,000** (excess leave line item) |
| professionalTax | **−₹200** |
| **netSalary** | 24,000 − 2,000 − 200 = **₹21,800** ✅ |

---

#### Core Function: `generatePayroll(userId, month, year)`

```typescript
async function generatePayroll(userId: string, month: number, year: number) {
  const user = await getUser(userId); // includes monthlySalary, gender, employeeStatus

  // 1. Actual calendar days in the month (28/29/30/31)
  const daysInMonth = new Date(year, month, 0).getDate();
  const perDaySalary = user.monthlySalary / daysInMonth;

  // 2. Weekday present days (Mon–Fri, status = Present)
  //    HalfDay counts as 0.5
  const weekdayPresent = await countWeekdayPresentDays(userId, month, year);

  // 3. Weekend worked days (Sat/Sun with isWeekendWork = true)
  const weekendWorked = await countWeekendWorkedDays(userId, month, year);

  // 4. Approved leaves this month
  const approvedLeavesThisMonth = await countApprovedLeavesInMonth(userId, month, year);

  // 5. Annual leave quota check (Jan 1 → end of current month)
  const approvedLeavesYTD = await countApprovedLeavesYTD(userId, year, month);
  const excessLeavesYTD   = Math.max(0, approvedLeavesYTD - 14);

  // 6. Portion of excess that falls in THIS month
  //    (excess is attributed to the latest month's leaves first)
  const excessInThisMonth = Math.min(excessLeavesYTD, approvedLeavesThisMonth);

  // 7. Paid days — ALL approved leaves included (excess deducted as a separate line item below)
  const paidDays = weekdayPresent + weekendWorked + approvedLeavesThisMonth;

  // 8. Salary calculations (Method B — explicit deduction, no double count)
  //    grossSalary includes excess leave days, then they are deducted once as leaveSalaryDeduction
  const grossSalary          = perDaySalary * paidDays;
  const leaveSalaryDeduction = perDaySalary * excessInThisMonth; // deducted exactly once
  const professionalTax      = calculatePT(user.monthlySalary, user.gender, month);
  const netSalary            = grossSalary - leaveSalaryDeduction - professionalTax;

  // 9. Upsert payroll record
  return prisma.payroll.upsert({
    where: { userId_month_year: { userId, month, year } },
    create: {
      userId, month, year, daysInMonth,
      weekdayPresentDays:   weekdayPresent,
      weekendWorkedDays:    weekendWorked,
      approvedLeavesMonth:  approvedLeavesThisMonth,
      excessLeaveDays:      excessInThisMonth,
      paidDays,             perDaySalary,
      grossSalary,          leaveSalaryDeduction,
      professionalTax,      netSalary,
    },
    update: { /* same fields */ },
  });
}
```

#### Weekend Work Checkbox Logic

- Saturday/Sunday attendance records have an `isWeekendWork` boolean field.
- **Employee** can tick the checkbox when clocking in on a weekend — or **Admin** can tick it manually.
- If `isWeekendWork = false` on a Sat/Sun → that day is `WeeklyOff` (not paid, not absent).
- If `isWeekendWork = true` on a Sat/Sun → that day counts as a **paid present day**.
- Frontend: When clocking in on a Saturday or Sunday, show a prominent checkbox:
  > ☑ I am working today (Saturday/Sunday) — this day will be counted as a paid workday.

#### Leave Deduction Rules

| Scenario | Effect |
|---|---|
| Approved leaves ≤ 14 for the year | All leaves are **paid** — no deduction |
| Approved leaves > 14 for the year | Excess days = **unpaid** — `perDaySalary × excessDays` deducted |
| Intern / Probation employee on leave | Leave still not paid (not eligible for 14-day quota) |
| Rejected / Pending leave | Day treated as **absent** — not counted in paidDays |

#### Professional Tax (`utils/professionalTax.ts`)

```typescript
function calculatePT(monthlySalary: number, gender: Gender, month: number): number {
  // February: higher slab
  if (month === 2) {
    if (gender === 'female' && monthlySalary <= 25000) return 0;
    if (gender === 'male'   && monthlySalary <= 7500)  return 0;
    return 300;
  }

  if (gender === 'female') {
    if (monthlySalary <= 25000) return 0;
    return 200;
  }

  // Male
  if (monthlySalary <= 7500)  return 0;
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
- "Generate Payroll" button → calls generate API for all employees
- Full salary breakdown table (one row per employee, all calculation columns visible):

| # | Employee | Designation | Days in Month | Per Day Salary | Weekday Present | Weekend Worked | Approved Leaves | Excess Leaves (Unpaid) | Paid Days | Gross Salary | Leave Deduction | Prof. Tax | **Net Salary** |
|---|----------|-------------|:---:|---:|:---:|:---:|:---:|:---:|:---:|---:|---:|---:|---:|
| 1 | John Doe | Sales Mgr | 30 | ₹1,000.00 | 18 | 2 | 4 | 2 | 24 | ₹24,000 | −₹2,000 | −₹200 | **₹21,800** |
| 2 | Jane Smith | Accounts | 30 | ₹833.33 | 22 | 0 | 1 | 0 | 23 | ₹19,166 | ₹0 | ₹0 | **₹19,166** |

Column definitions shown as tooltip or footer key:
- **Days in Month** — actual calendar days (28/29/30/31)
- **Per Day Salary** — Monthly Salary ÷ Days in Month
- **Weekday Present** — Mon–Fri days clocked in (HalfDay = 0.5)
- **Weekend Worked** — Sat/Sun with "working today" checkbox ticked
- **Approved Leaves** — leaves approved by admin falling this month
- **Excess Leaves** — portion beyond 14-day annual quota (unpaid, deducted)
- **Paid Days** — Weekday Present + Weekend Worked + All Approved Leaves (excess included)
- **Gross Salary** — Per Day Salary × Paid Days
- **Leave Deduction** — Per Day Salary × Excess Leave Days (days beyond 14-day annual quota)
- **Prof. Tax** — Professional Tax per Maharashtra slab
- **Net Salary** — Gross − Leave Deduction − Prof. Tax

Formula row at table footer (always visible):

```
Net Salary = (Monthly Salary ÷ Days in Month)
             × (Weekday Present + Weekend Worked + All Approved Leaves This Month)
             − (Monthly Salary ÷ Days in Month) × Excess Leave Days
             − Professional Tax
```

Where:
- `Excess Leave Days = max(0, Approved Leaves YTD − 14)` capped to this month's approved leaves
- Gross already includes excess leave days; deduction brings them back out as a transparent line item

- Row click → open PayrollSlipPage for that employee

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
┌────────────────────────────────────────────────────┐
│                  ELAN EXPORTS                      │
│             Salary Slip — April 2026               │
├────────────────────────┬───────────────────────────┤
│ Employee Name          │ John Doe                  │
│ Designation            │ Sales Manager             │
│ Month / Year           │ April 2026                │
│ Employee Status        │ Confirmed                 │
├────────────────────────┼───────────────────────────┤
│ ATTENDANCE BREAKDOWN   │                           │
├────────────────────────┼───────────────────────────┤
│ Days in Month          │ 30                        │
│ Weekday Present Days   │ 18                        │
│ Weekend Days Worked    │ 2  (Sat/Sun, opt-in)      │
│ Approved Leave Days    │ 4                         │
│ Paid Days              │ 24 (18 + 2 + 4)           │
├────────────────────────┼───────────────────────────┤
│ SALARY CALCULATION     │                           │
├────────────────────────┼───────────────────────────┤
│ Monthly Salary         │ ₹ 30,000.00               │
│ Per Day Salary         │ ₹  1,000.00  (÷ 30 days) │
│ Gross Salary           │ ₹ 24,000.00  (× 24 days) │
├────────────────────────┼───────────────────────────┤
│ DEDUCTIONS             │                           │
├────────────────────────┼───────────────────────────┤
│ Excess Leave Deduction │ − ₹  2,000.00             │
│   (2 days over quota)  │   (₹1,000 × 2 days)      │
│ Professional Tax       │ − ₹    200.00             │
├────────────────────────┼───────────────────────────┤
│ NET SALARY             │ ₹ 21,800.00               │
└────────────────────────┴───────────────────────────┘
│ Bank: HDFC Bank  | A/C: XXXX1234 | IFSC: HDFC0001  │
└────────────────────────────────────────────────────┘
```

Formula printed at slip bottom (small text):
```
Net = (₹30,000 ÷ 30) × 24 days − (₹1,000 × 2 excess leave days) − ₹200 PT = ₹21,800
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
| Weekend work opt-in | `isWeekendWork` checkbox on Sat/Sun — ticked = paid workday, unticked = weekly off |
| Intern/Probation no paid leave | Return 403 if `employeeStatus !== confirmed` |
| Leave eligibility | 14 days/year for confirmed employees |
| Approved leave ≤ 14 days YTD | All approved leaves = paid; counted in paidDays |
| Approved leave > 14 days YTD | Days beyond 14 = unpaid; deducted as `leaveSalaryDeduction` |
| Rejected/no request = absent | Not counted in `paidDays`, treated as absent for that day |
| PT Maharashtra (Male) | ≤7500→₹0, 7501–10000→₹175, >10000→₹200, Feb→₹300 |
| PT Maharashtra (Female) | ≤25000→₹0, >25000→₹200, Feb→₹300 |
| Days in month | Real calendar days: 28/29/30/31 (no fixed value) |
| Per day salary | `monthlySalary ÷ daysInMonth` |
| Paid days | `weekdayPresent + weekendWorked + paidLeavesThisMonth` |
| Gross salary | `perDaySalary × paidDays` |
| Leave deduction | `perDaySalary × excessLeaveDaysThisMonth` |
| Net salary | `grossSalary − leaveSalaryDeduction − professionalTax` |

---

## 6. Implementation Order

### Phase 1 — Schema & Backend Foundation
1. Add new fields to `User` model (monthlySalary, employeeStatus, gender, designation, bank details)
2. Add `Leave` model and updated `Payroll` model to Prisma schema
3. Add `WeeklyOff` and `Leave` to `AttendanceStatus` enum
4. Add `isWeekendWork Boolean @default(false)` to `Attendance` model
5. Add `AttendanceSettings` model
6. Run Prisma migration
7. Seed default `AttendanceSettings` row

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
- **Days in month = real calendar days**: Per day salary divides by the actual days in the month (28, 29, 30, or 31) — NOT a fixed 26 or 30. This is the canonical denominator.
- **Weekend work is opt-in per day**: `isWeekendWork` is set per attendance record, not a global per-employee flag. This lets one employee work some Saturdays and skip others.
- **14-day leave quota is annual (Jan–Dec)**: Excess is tracked cumulatively across the year. If an employee takes 10 leaves in Q1 and 5 more in Q2, the 15th leave day triggers the deduction in Q2 (in whichever month it falls).
- **Excess leave attribution**: Excess is applied to the current month's leaves first (latest leaves are the unpaid ones). This keeps the logic simple and deterministic.
- **No cron required for MVP**: Absent marking can be done lazily when payroll is generated, or triggered manually by admin. Keep it simple.
- **Payroll slip**: Use browser print (`window.print()`) for MVP. No PDF library needed initially.
- **Leave overlap**: Validate that a new leave request doesn't overlap with an existing approved/pending leave.
- **Backend enums**: Add `EmployeeStatus`, `Gender`, `LeaveStatus` enums to Prisma schema.
- **Auth**: Reuse existing JWT middleware. Admin check = role `admin` in `UserRole` table.
