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

## Workflow, masters & integrations (js/workflow.js)
- **Onboarding** (Workflow → Onboarding & Offboarding): pick or create the employee, tick spare assets, tick systems → assets are issued and AD / biometric / ERP IDs are registered in one click → signature form opens.
- **Offboarding**: per asset choose *return to spare*, *repair*, *dispose* or *reassign to a colleague*; tick the system IDs to disable → employee marked Left, clearance form opens. Left employees still holding assets/IDs are flagged and shown as a badge on the menu.
- **Integrations**: systems master with seven connection methods — *Webhook* (middleware), *REST API* (templates for Entra ID Graph, Google Workspace, Okta, ERP, biometric servers), *SCIM 2.0*, *File / script export* (AD PowerShell, biometric / ERP CSV), *Email request*, *Manual task* and *Simulation*. Add a system from a ready template; request/body templates use placeholders such as `{{accountId}} {{name}} {{email}} {{dept}} {{tempPassword}}`. Offline methods leave the account **Pending** until IT clicks *Mark done*; failed API calls can be retried.
- **Masters**: departments, locations, designations, brands, operating systems and system types feed every dropdown; in-use values cannot be removed.
- **Asset record** now shows the full custody history: each holder, from–to dates, days, issuing/returning document, condition and remarks.

## Data
First launch loads your workbook (100 employees, 50 vendors, 97 PRs, 100 POs) and posts the GRNs so stock exists; a few consumables, AMCs and allocations are **sample** records. *Settings → Data* can reset to sample, workbook‑only (nothing received) or empty.

## Notes
- VAT defaults to 5 % (UAE); change in Settings. (The workbook mixed 20 % and 5 %.)
- Browser storage is per browser/device. For multi-user use, the `store` in `js/core.js` is the single place to swap for an API/database.
