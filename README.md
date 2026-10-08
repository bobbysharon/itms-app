# ITMS — IT Service & Asset Management

A zero-build web app (plain HTML/CSS/JS) generated from the **ITSM_2026.xlsx** workbook. Left menu, right workspace, light‑neon 3D glass UI. Data lives in the browser (`localStorage`) with JSON backup/restore.

## Run locally
Open `index.html` in a browser — no server or install needed.

## Deploy on Render (static site)
Build command: *(none)* · Publish directory: `.`

## Modules (workbook sheet → app page)
| Page | Replaces workbook sheets |
|---|---|
| Dashboard | Dashboard (both ITMS and ISMS versions) — all tables + charts, computed live |
| Employees | Employee Master (+ Asset Issuance / Return forms) |
| Vendors | Vendor Master (+ Payment Terms) |
| Purchase Requests | Purchase Request + Purchase Request Print |
| Purchase Orders | Purchase Order + Purchase Order Print (+ GRN log) |
| Hardware Assets | Hardware Asset Master |
| Asset Movements | Asset Transfer List + Issuance / Return forms (Issue · Return · Transfer) |
| Software Licences | Software Asset Master + Installed Software |
| Consumables | Consumables Master + Purchase + Issue |
| AMC Contracts | AMC Master |
| Lists & Settings | Data Validation Master, Payment Terms, company profile, backup |

## How modules are linked (no re-typing)
- **PR → PO**: *Convert* lists open PR lines; tick lines, optionally lower the quantity (partial order). One PO per vendor is created with vendor, currency, terms, description, quantity and class auto-filled. Un-ordered quantity stays open on the PR; PR status updates automatically.
- **PO → Stock (GRN)**: receiving an approved PO creates Hardware assets (*In Stock*), adds Software licences, or adds Consumable stock. Partial receipts are supported.
- **Issue / Return / Transfer** change asset status and custody, keep a full history, compute days‑in‑service / end‑of‑life / replacement, and open a printable form.
- **Software installs** consume licences (remaining = total − installed); blocked when expired or exhausted.
- **Consumable issues** reduce available stock (blocked if insufficient); low‑stock alerts feed the dashboard.
- **AMC** contracts stamp their dates onto the covered assets; expiring contracts raise alerts.

## Plan & Govern — end-to-end workflow, budget, compliance (js/budget.js, js/compliance.js)
- **IT Workflow** (`#/workflow`): 7 live stages — 1 Plan (budget) · 2 Procure (PR→PO) · 3 Receive (GRN→stock) · 4 Deploy (issue + onboarding) · 5 Operate (tickets, AMC, installs) · 6 Govern (compliance) · 7 Retire (return/dispose). Each card shows live counts and jumps straight into the module.
- **IT Budget** (`#/budget`): set planned budget per category per financial year (Hardware, Software & Licences, Consumables, AMC & Maintenance, Network & Infrastructure, Cloud & Services, Security, Staffing & Training, Other). Actuals are computed live from approved PO lines (incl. VAT) + AMC values + manual “additional actual”. Shows Planned vs Actual + Difference + Var %, current vs previous year with YoY deltas, utilisation ring, over-budget badges, copy-previous-year, CSV and printable budget report.
- **Policy Compliance** (`#/compliance`): dropdown of frameworks — ISO/IEC 27001:2022 (16 controls), NIST CSF 2.0 (12), UAE NESA IA (10), ITIL 4 practices (8). You must **Confirm before proceeding**, then assess controls **one by one**: Compliant / Partially / Non-compliant / N/A, current status, owner, due date, action item, and the **document/evidence needed for conformance** (pre-filled per control). Readiness score, donut, open-action list, re-assess, CSV and printable readiness report. Switching frameworks keeps prior assessments.

## Workflow, masters & integrations (js/workflow.js)
- **Onboarding** (Workflow → Onboarding & Offboarding): pick or create the employee, tick spare assets, tick systems → assets are issued and AD / biometric / ERP IDs are registered in one click → signature form opens.
- **Offboarding**: per asset choose *return to spare*, *repair*, *dispose* or *reassign to a colleague*; tick the system IDs to disable → employee marked Left, clearance form opens. Left employees still holding assets/IDs are flagged and shown as a badge on the menu.
- **Integrations** (now under Administration): choose a system type and the form asks only for the settings that type needs — Microsoft Entra ID (Graph), Google Workspace, Okta, SCIM 2.0, Active Directory (PowerShell script), biometric / ERP user APIs, biometric / ERP CSV files, email request, manual task, webhook, plus custom REST / file for anything else. Each connector sends the standard API call (or builds the standard script / CSV) itself; API systems have a **Test connection** button. Offline types stay **Pending** until IT clicks *Mark done*; failed API calls can be retried.
- **Masters**: departments, locations, designations, brands, operating systems and system types feed every dropdown; in-use values cannot be removed.
- **Asset record** now shows the full custody history: each holder, from–to dates, days, issuing/returning document, condition and remarks.

## ITSM suite (js/itsm.js) — independent ServiceDesk-style helpdesk
- **Tickets**: incidents and service requests with requester, 3-level category (category › subcategory › item), impact × urgency → priority, level, mode, affected asset, auto-routing to a group, auto-assign to the least-loaded technician, SLA due dates (paused on hold), conversation (public / private), worklogs, tasks, approvals, resolution + closure code, full history, reopen, cancel.
- **Problems · Changes · Releases**: linked to requests and assets; change approvals (CAB).
- **Projects & Follow-ups**: project items with status, priority, owner, pending-with, auto timeline status, latest update, next action; views by owner / pending-with / project; Excel paste import and CSV export.
- **Solutions & Catalog**: knowledge base (save a resolution as a solution), service catalog with optional approval, announcements.
- **Home dashboard & Reports**: status, priority, workload, SLA, ageing, approvals, overdue follow-ups.
- **Admin**: technicians, groups, categories, SLA and routing rules, and all masters.

- **Sample data**: Helpdesk Home → *Load sample data* adds 24 tickets (all statuses and SLA states), 4 problems, 5 changes, 2 releases, 6 solutions, 7 catalog items, announcements, 10 follow-up items, 4 sample employees (two leavers still holding assets and IDs), 36 system accounts, onboarding/offboarding records and software installs. *Remove sample data* deletes only those flagged records and restores asset custody. A brand-new install loads it automatically once.
- **Assigned to**: tickets can only be assigned to staff whose role is assignable (default: *Technician*; change under ITSM Admin → SLA & routing).

## Data
First launch loads your workbook (100 employees, 50 vendors, 97 PRs, 100 POs) and posts the GRNs so stock exists; a few consumables, AMCs and allocations are **sample** records. *Settings → Data* can reset to sample, workbook‑only (nothing received) or empty.

## Notes
- VAT defaults to 5 % (UAE); change in Settings. (The workbook mixed 20 % and 5 %.)
- Browser storage is per browser/device. For multi-user use, the `store` in `js/core.js` is the single place to swap for an API/database.
