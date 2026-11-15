# LTMS — Leather Tanning Management System

Local-first starter for digitising tannery production records. Stack: React + Vite, Node.js + Express, MySQL 8.

## Important production note
The two uploaded paper sheets are treated as **reference documents**, not validated recipes. Do not use software-calculated quantities as chemical instructions until a qualified tannery chemist verifies every chemical identity, percentage basis, sequence, pH target, temperature, float, and timing. The starter intentionally does not auto-dose machinery.

## Requirements
- macOS on Apple Silicon (M2)
- Node.js 20+
- MySQL 8.x (Homebrew or MySQL installer)
- VS Code

## 1. Create the database
Open Terminal in this folder:
```bash
mysql -u root -p < database/schema.sql
```
Use the password configured for your local MySQL root account. If root has no password, omit `-p`.

## 2. Configure the backend
```bash
cd backend
cp .env.example .env
```
Edit `.env` and set your MySQL password and a long random JWT_SECRET.
```bash
npm install
npm run dev
```
API runs at http://localhost:5000. Health check: http://localhost:5000/api/health

## 3. Create the first supervisor
In a second Terminal tab:
```bash
cd backend
npm run create-supervisor
```
Follow the prompts. The password is stored as a bcrypt hash.

## 4. Start the frontend
In another Terminal tab:
```bash
cd frontend
npm install
npm run dev
```
Open the local URL printed by Vite (normally http://localhost:5173).

## Project structure
```text
LTMS/
├── backend/
│   ├── src/
│   │   ├── config/db.js
│   │   ├── middleware/auth.js
│   │   ├── routes/auth.js
│   │   ├── routes/dashboard.js
│   │   ├── routes/companies.js
│   │   ├── routes/chemicals.js
│   │   └── server.js
│   ├── scripts/create-supervisor.js
│   ├── .env.example
│   └── package.json
├── database/schema.sql
└── frontend/
    ├── src/
    │   ├── components/Sidebar.jsx
    │   ├── pages/Login.jsx
    │   ├── pages/Dashboard.jsx
    │   ├── pages/Companies.jsx
    │   ├── pages/Inventory.jsx
    │   ├── api.js
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── styles.css
    ├── index.html
    └── package.json
```

## Included in this first milestone
- Required supervisor login
- Company creation/listing
- Dashboard summary cards
- Chemical inventory list and low-stock flag
- Database foundation for drums, process templates, process steps, production batches, batch logs and stock movements

## Suggested next modules
1. Drum register: drum code, capacity, location, material, status, maintenance history.
2. Process library: species/product/thickness/colour, stages, chemical items, percentage basis, float %, target pH and time.
3. Batch execution: select company → product/process template → drum → batch weight → calculated draft quantities → supervisor confirmation.
4. Chemical stock: goods receipt, issue to batch, returns, adjustments, supplier and batch/lot tracking.
5. Audit trail, reports, PDF process sheet and backups.

## Local security
Keep `.env` private and never commit it. Create individual supervisor accounts; do not share root database credentials with the app. Back up MySQL regularly. This starter is not yet hardened for internet exposure or direct machine control.
