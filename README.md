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

## Menu map — one consolidated ITIL service desk (5 groups, 42 pages)
No duplicates: the old *IT Helpdesk* / *ServiceDesk Plus* / *Enterprise* menus are merged. Every page below is cross-linked (buttons, not dead ends).
- **Dashboard** — live KPIs + ITIL coverage strip.
- **Service Desk** — *Operate:* Helpdesk Home, Tickets, Self-Service Portal (plus a floating live-chat bubble on every screen) · *ITIL workflows:* Problems · Changes · Releases, CMDB, Lifecycle Designer, Automation & SLA · *Intake & fulfilment:* Email to Ticket, Preventive Maintenance, Templates & Apps, Solutions & Catalog · *Plan & measure:* Projects & Follow-ups, Scheduler, Surveys, Advanced Reports · *Admin:* ITSM Admin, Enterprise (ESM).
- **Assets & Procurement** — *Asset register:* Hardware, Movements, Software Licences, Consumables, Asset Loans, Discovery & Catalog · *Contracts:* AMC Contracts ⇄ Other Contracts (linked both ways) · *Procurement:* Purchase Requests → Purchase Orders → Vendors (full chain, no re-typing).
- **People & Identity** — Employees ⇄ AD accounts, Onboarding & Offboarding ⇄ AD disable/provision, AD & Group Policy center, Roles & Access.
- **Govern & Compliance** — IT Workflow (Plan→Retire), IT Budget, Policy Compliance (ISO 27001 / NIST / NESA / ITIL), Archiving & Audit trail.
- **Administration** — Masters, Sites & Domains, Integrations, Settings.

## ITIL flow (how modules link)
Request (portal/email/chat/PM/template) → auto-route + auto-assign + SLA → resolve via Knowledge → close → survey. Repeat issues → Problem (root cause) → Change with CAB approval + CMDB blast-radius evidence → Release → linked assets/contracts update. Changes touching CIs attach the CMDB impact list; leavers trigger asset return + AD disable from one flow.

## ServiceDesk Plus extension (js/sdp-plus.js) — ITIL / audit coverage
Extra pages (data in `db.sdp`):

| Requested option | Page in app |
|---|---|
| Self-service portal, knowledge base, service catalog | Self-Service Portal (`#/portal`) + Solutions & Catalog |
| AD user self-service (password reset / unlock) | Portal → Password/unlock (auto-creates ticket + AD queue) |
| Live chat technician ↔ user | Floating bubble on every screen (user + agent reply, → ticket) + full console at `#/chat` |
| CMDB + relationship / impact analysis | CMDB (`#/cmdb`) — CIs, relationship map, 4-hop blast radius for change evidence |
| Purchase & contract management | Contracts (`#/contracts`) ⇄ AMC register — expiry/renewal tracking |
| Preventive maintenance tasks | Preventive Maintenance (`#/pmtasks`) — scheduled tasks generate real tickets |
| Email to ticket + auto routing | Email to Ticket (`#/mailticket`) — mailbox rules, simulate + convert |
| Business rules, tech auto-assign, smart notifications, SLA escalations | Automation & SLA (`#/automation`) — rules engine runs on open tickets + 30 s auto-check, escalation + notification log |
| Request / problem / change lifecycle designer | Lifecycle Designer (`#/lifecycles`) |
| Custom request templates, custom actions, custom apps (PaaS) | Templates & Apps (`#/templates`) — templates raise tickets with default tasks |
| IT asset discovery, tracking, inventory catalog, remote tools | Discovery & Catalog (`#/discovery`) — scans, import → asset, product catalog, remote-tool audit log |
| Asset loan tracking | Asset Loans (`#/loans`) — issue/return writes custody history |
| Multi-site support, custom domains | Sites & Domains (`#/sites`) — site scope switcher + custom portal URL |
| Fine-grained authorizations | Roles & Access (`#/roles`) — per-role actions + allowed modules (empty = all), enforced on nav, links and buttons; Auditor read-only; “Act as” to test; “Logged in as” user picker; Requester + Vendor/External get Requester pre-filled with their own name and locked; per-employee role via key icon (Employees) shown in Access-role column |
| Service desk scheduler | Scheduler (`#/scheduler`) — requests, tasks, time off, reminders |
| Surveys + survey reports | Surveys (`#/surveys`) — CSAT on resolved tickets + averages |
| Native / insightful / inventory reports | Advanced Reports (`#/reportsplus`) — **41 canned reports** in 6 families: General assets (11: product type/product/acquisition/expiry/requester/unassigned/not-in-contract/from-vendor), Software (4: category/purchased-vs-installed/manufacturer/CAL), Workstations (12: OS/manufacturer/domain/network + counts), Audit (3: by workstation/timeline/changes), Purchase (5: vendor/dates/status/cost-center), Contracts (6: active/max-value/status/vendor/expired/total-price); every table searches, sorts and exports CSV |
| ESM instances, single enterprise portal, mobile apps, best practices | Enterprise (ESM) (`#/esm`) — rapid-start HR/Facilities/Finance/Legal desks with starter catalogs + fulfilment groups; **Desk workspace** tab per live desk (KPIs, desk requests, desk catalog, connected flows: HR→onboarding, Facilities→PM, Finance→approvals/budget, Legal→follow-ups/contracts); tickets carry a Desk field (filter + column on Tickets, shown on detail); desk catalogs surface in the portal |
| Data archiving + audit trail | Archiving & Audit (`#/archiving`) — archive/restore old tickets, full event log |
| AI assistance (built-in, offline) | Ticket detail → **Assist**: keyword-based category suggestion, urgency signal, related-KB finder with one-click link, and reply templates inserted as public notes |
| Kanban + monitoring intake | Tickets → **Kanban** tab: visual columns with ◀ ▶ moves following your lifecycle; **Monitoring alert** button turns OpManager/Zabbix/Nagios/PRTG/Site24x7 alarms into routed Critical tickets |
| Asset lifecycle + spaces + one-touch | Lifecycle Designer shows the live asset flow (stock → in use → repair → disposal); Enterprise → **Spaces** manages campuses/buildings with one-click maintenance requests; Automation → **One-touch** (emergency CAB, broadcast, PM run) and per-rule **Simulate** sandbox |

## Active Directory & Group Policy (`#/addirectory`, js/sdp-plus.js)
- **Connections**: LDAP/LDAPS profiles — host, port (389 / 636 / 3268 / 3269), encryption (None / STARTTLS / **SSL**), Base DN, bind account, DC certificate thumbprint. **Test** validates and shows the exact PowerShell as audit evidence.
- **Users**: provision from Employees (linked by employee no.), enable/disable, unlock, password reset (one-time temp password + `Set-ADAccountPassword` script, must-change flag). Disables mirror the offboarding flow.
- **Groups**: security/distribution groups with membership management (syncs back to user records).
- **Group Policy**: GPOs with linked OUs, versioned settings, Enforced/Linked states, one-click backup + HTML report scripts.
- **Runbooks**: ready PowerShell for starter provisioning, leaver offboarding, GPO health. **Sync log** records every action. (Browser apps can't bind LDAP directly — the app owns the profiles, objects and evidence, and generates the exact scripts the admin host runs; the existing AD connector under Administration → Integrations covers agent-based provisioning.)

| Requested option | Page in app |
|---|---|
| Self-service portal, knowledge base, service catalog | Self-Service Portal (`#/portal`) + Solutions & Catalog |
| AD user self-service (password reset / unlock) | Portal → Password/unlock (auto-creates ticket + AD queue) |
| Live chat technician ↔ user | Floating bubble on every screen (user + agent reply, → ticket) + full console at `#/chat` |
| CMDB + relationship / impact analysis | CMDB (`#/cmdb`) — CIs, relationship map, 4-hop blast radius for change evidence |
| Purchase & contract management | Contracts (`#/contracts`) — expiry/renewal tracking (AMC stays separate) |
| Preventive maintenance tasks | Preventive Maintenance (`#/pmtasks`) — scheduled tasks generate real tickets |
| Email to ticket + auto routing | Email to Ticket (`#/mailticket`) — mailbox rules, simulate + convert |
| Business rules, tech auto-assign, smart notifications, SLA escalations | Automation & SLA (`#/automation`) — rules engine runs on open tickets + 30 s auto-check, escalation + notification log |
| Request / problem / change lifecycle designer | Lifecycle Designer (`#/lifecycles`) |
| Custom request templates, custom actions, custom apps (PaaS) | Templates & Apps (`#/templates`) — templates raise tickets with default tasks |
| IT asset discovery, tracking, inventory catalog, remote tools | Discovery & Catalog (`#/discovery`) — scans, import → asset, product catalog, remote-tool audit log |
| Asset loan tracking | Asset Loans (`#/loans`) — issue/return writes custody history |
| Multi-site support, custom domains | Sites & Domains (`#/sites`) — site scope switcher + custom portal URL |
| Fine-grained authorizations | Roles & Access (`#/roles`) — per-role actions + allowed modules (empty = all), enforced on nav, links and buttons; Auditor read-only; “Act as” to test; “Logged in as” user picker; Requester + Vendor/External get Requester pre-filled with their own name and locked; per-employee role via key icon (Employees) shown in Access-role column |
| Service desk scheduler | Scheduler (`#/scheduler`) — requests, tasks, time off, reminders |
| Surveys + survey reports | Surveys (`#/surveys`) — CSAT on resolved tickets + averages |
| Native / insightful / inventory reports | Advanced Reports (`#/reportsplus`) — **41 canned reports** in 6 families: General assets (11: product type/product/acquisition/expiry/requester/unassigned/not-in-contract/from-vendor), Software (4: category/purchased-vs-installed/manufacturer/CAL), Workstations (12: OS/manufacturer/domain/network + counts), Audit (3: by workstation/timeline/changes), Purchase (5: vendor/dates/status/cost-center), Contracts (6: active/max-value/status/vendor/expired/total-price); every table searches, sorts and exports CSV |
| ESM instances, single enterprise portal, mobile apps, best practices | Enterprise (ESM) (`#/esm`) — rapid-start HR/Facilities/Finance/Legal desks with starter catalogs + fulfilment groups; **Desk workspace** tab per live desk (KPIs, desk requests, desk catalog, connected flows: HR→onboarding, Facilities→PM, Finance→approvals/budget, Legal→follow-ups/contracts); tickets carry a Desk field (filter + column on Tickets, shown on detail); desk catalogs surface in the portal |
| Data archiving + audit trail | Archiving & Audit (`#/archiving`) — archive/restore old tickets, full event log |
| AI assistance (built-in, offline) | Ticket detail → **Assist**: keyword-based category suggestion, urgency signal, related-KB finder with one-click link, and reply templates inserted as public notes |
| Kanban + monitoring intake | Tickets → **Kanban** tab: visual columns with ◀ ▶ moves following your lifecycle; **Monitoring alert** button turns OpManager/Zabbix/Nagios/PRTG/Site24x7 alarms into routed Critical tickets |
| Asset lifecycle + spaces + one-touch | Lifecycle Designer shows the live asset flow (stock → in use → repair → disposal); Enterprise → **Spaces** manages campuses/buildings with one-click maintenance requests; Automation → **One-touch** (emergency CAB, broadcast, PM run) and per-rule **Simulate** sandbox |

## Sign-in, logins & CSV migration (js/auth.js)
- **Login screen**: full-admin `bobby.sharon@example.com` (alias `bobby.sharon@esample.com`) / `Admin@12345`, bound to the `sysadmin` system identity (ID `sysadmin`, not a staff record — hidden from staff lists and pickers, fenced to IT/admin use). The bootstrap self-heals on **every** store change — any master reset recreates the admin with the default password, so you can never be locked out. The Administrator role itself cannot be deactivated, stripped of admin rights, or scope-limited. Session per browser tab; sign-out button top-right. Demo-grade local gate — production use needs server-side auth.
- **Employee logins**: key icon on each employee row (admin only) — create login (email + role + password) or reset password + change role.
- **CSV migration** (Employees, Hardware, Software, Consumables toolbars): **Sample CSV** downloads the exact accepted format with examples — fill it, then **Upload CSV** validates (missing columns, bad rows listed with row numbers) and imports new-or-update (matched by email/no, serial, name, description). Opening stock for migrated assets is imported as-recorded.
## HR & Finance (mandatory essentials, fully interlinked)
- **HR Management** (`#/hr`) — leave types + yearly allowances, apply → manager approve/reject (approval auto-writes a Scheduler time-off entry), live per-employee balances, exit clearance computed from real data (assets held, active system IDs, open tickets) with sign-off only when all clear, plus an in-module Staff directory (edit only — passwords, roles and deletes stay admin-only), **HR onboarding/offboarding requests with top buttons (HR adds or picks the employee → IT is notified → technician Accepts in Onboarding & Offboarding, assigns assets/IDs and prints the signature form → status flows back, printable from HR too)**, HR desk links. New HR Officer / Finance Officer roles fence each team to its own modules.
- **Finance** (`#/finance`) — expense claims (submit → approve → reject → pay; paying posts straight into IT Budget actuals **and the ledger**), vendor payments linked to approved POs (marks PO invoice Paid + payment voucher), **Journal with legal voucher numbers** (BILL/PV/EX/DEP/DSP/IS) auto-posted from every GRN (CAPEX→fixed assets / OPEX→stock, VAT split, AP), payment, expense, disposal write-off, stock issue and monthly depreciation run; **Ledger** per GL, **Trial Balance** with tally proof, **Reconciliation** (GRN vs bills vs GL per period + CAPEX/OPEX split), **COA** manager + category→GL map; links into Budget, POs, vendors, stock and reports.
## Test data for UAT (js/testdata.js)
Administration → Lists & Settings → Data → **Full test data**: wipes everything **except employees**, tops up a 16-head sample roster across 8 departments (Executive, Finance, HR, IT, Marketing, Operations, Administration, Security — skipped if already present), plus `TEST:` staff in every employment state (resigned/Left holding an asset to test return/delete guards, terminated/Left, inactive — logins correctly blocked for all non-Active), issues each a laptop/desktop/monitor/phone with M365 + ERP installs, sets company to **BOBBY SHARON**, and rebuilds every module with `TEST:`-prefixed fixtures covering all statuses and types —
PRs (open/partial/ordered/cancelled) → POs (draft/approved/partial/received/cancelled) → GRN stock; hardware in every status with issue/transfer/return history; licences expiring/expired/exhausted/perpetual with installs; consumables incl. a low-stock alert; AMCs active/expiring/expired/renewal; 12 tickets across all statuses, priorities and SLA states (incl. an overdue, a due-soon, an on-hold, a cancelled and a response-breach that triggers escalation); problems/changes/releases/follow-ups/KB/catalog/announcements in every status (incl. a 50h-stale CAB approval that triggers the escalation matrix); CMDB CIs + links, PM tasks (one overdue), inbox mail, schedules, templates, surveys + responses, chats (one 60min-waiting unassigned → auto-assign), loans (incl. overdue), products, scan results, AD users/groups/GPOs/devices, ESM desk, custom app records, live SMTP/IMAP profiles, support@tafaseel.ae desk address and a sample sent email. Budgets reseed; ISO 27001 gets 8 assessed controls across all verdicts. Live escalations and notification emails generate automatically as you test. **Top-up samples** (same screen) fills only empty screens — CMDB, PM tasks, contracts, loans, chats, schedules, templates, custom actions, surveys, inbox, AD objects, tools log and helpdesk basics — each in varied statuses, without touching existing data.
First launch loads your workbook (100 employees, 50 vendors, 97 PRs, 100 POs) and posts the GRNs so stock exists; a few consumables, AMCs and allocations are **sample** records. *Settings → Data* can reset to sample, workbook‑only (nothing received) or empty.

## Notes
- VAT defaults to 5 % (UAE); change in Settings. (The workbook mixed 20 % and 5 %.)
- Browser storage is per browser/device. For multi-user use, the `store` in `js/core.js` is the single place to swap for an API/database.
