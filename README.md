# LTMS – Leather Tanning Management System

**A student-developed project to digitise traditional leather tanning factory operations.**

## About the Project

LTMS (Leather Tanning Management System) is a web-based application developed to simplify and organise the day-to-day operations of a leather tanning factory.

In many traditional tanneries, production records, chemical inventory, drum activities and batch information are maintained manually using registers and paper documents.

LTMS aims to bring these activities into one digital platform, making factory information easier to record, manage, monitor and access.

The idea behind this project comes from a real-world leather factory environment. The goal is to use technology to solve practical problems in the tanning industry.

## Why LTMS?

Leather tanning involves several production stages, chemicals, machinery, workers and batches. Managing all this information manually can become complicated.

LTMS aims to make this process more organised by providing a centralised system for managing factory operations.

## Key Features

### 1. Dashboard
- Overview of factory operations.
- Important production statistics.
- Quick access to different modules.

### 2. Company Management
- Manage multiple companies.
- Maintain company information.
- Access company-related factory records.

### 3. Drum Management
- Maintain tanning drum records.
- Track drum capacity and location.
- Monitor drum availability and running status.

### 4. Chemical Inventory
- Maintain chemical stock records.
- Record stock receipts and issues.
- Monitor available quantities.
- Identify low-stock chemicals.

### 5. Process Library
- Maintain leather processing templates.
- Organise production stages.
- Associate chemicals with process stages.
- Store process-related information.

### 6. Production Management
- Create and manage production batches.
- Assign batches to companies and drums.
- Track batch status.
- Monitor production from start to completion.

### 7. Production Monitoring
- Record individual production stages.
- Track stage starting and completion times.
- Record actual pH and temperature readings.
- Maintain operator notes and production history.

### 8. Reports & Analytics
- Production summary.
- Batch status distribution.
- Monthly production trends.
- Company-wise production.
- Drum utilisation.
- Chemical consumption.
- Production batch history.

Graphical reports help make factory information easier to understand.

## How LTMS Helps the Leather Tanning Industry

LTMS is designed to support everyday tannery operations by:

- Reducing dependency on paper-based records.
- Making production information easier to access.
- Improving chemical stock management.
- Helping supervisors monitor tanning drums.
- Maintaining records of production stages.
- Making batch history easier to track.
- Providing useful production summaries and graphical reports.

The objective is to improve information management without changing the actual chemistry or technical requirements of leather tanning.

## Technology Stack

| Technology | Purpose |
|---|---|
| React.js | Frontend development |
| Node.js | Backend runtime |
| Express.js | Backend API |
| MySQL | Database |
| JWT | Authentication |
| Recharts | Graphical reports |
| CSS | User interface styling |

## Project Structure

```text
LTMS/
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── routes/
│   │   └── server.js
│   ├── scripts/
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── api.js
│   │   └── styles.css
│   └── package.json
│
├── database/
│   └── schema.sql
│
├── README.md
└── .gitignore
```

## Important Production Note

LTMS is a production-record management application, not an automated tanning control system.

Actual chemical recipes, dosage calculations, process sequences and operating conditions must be verified by a qualified tannery chemist before operational use.

The application does not independently determine or authorise chemical dosing.

## Future Improvements

Some ideas for future development include:

- Advanced production analytics.
- PDF and Excel report generation.
- QR-based drum identification.
- Temperature sensor integration.
- More detailed production tracking.
- Cloud deployment.
- Additional user roles and permissions.

These are planned improvements and may not be part of the current implementation.

## Project Purpose

LTMS is an ongoing Computer Science student project developed around a real-world industrial problem.

It represents an effort to bring digitalisation into traditional leather tanning operations and explore how software development can help improve everyday factory management.
