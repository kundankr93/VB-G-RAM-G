# VB-G RAM-G --- Rural Development Works Monitoring Portal

A web-based portal for registering, monitoring, and analysing
rural-development works. The application combines a React dashboard and
GIS views with an Express REST API and MongoDB storage.

> **Data integrity note:** Demo records, demo coordinates, and sample
> administrative labels are synthetic. They are useful for testing the
> interface, but they are not verified government records or proof of
> on-site work.

## Contents

-   [Project overview](#project-overview)
-   [Features](#features)
-   [Technology stack](#technology-stack)
-   [Architecture](#architecture)
-   [Project structure](#project-structure)
-   [Requirements](#requirements)
-   [Run locally](#run-locally)
-   [Environment configuration](#environment-configuration)
-   [Demo data](#demo-data)
-   [API overview](#api-overview)
-   [Testing and validation](#testing-and-validation)
-   [Deployment](#deployment)
-   [Security and data-handling
    notes](#security-and-data-handling-notes)
-   [Known limitations](#known-limitations)

## Project overview

VB-G RAM-G provides a central place to maintain rural-development work
records and review their reported status, progress, expenditure, and
geographical distribution. It is intended to help administrators and
officers understand what has been entered into the system, identify work
items that may need attention, and produce filtered reports.

The portal supports three application roles:

  -----------------------------------------------------------------------
  Role                                Typical permissions
  ----------------------------------- -----------------------------------
  Admin                               Manage users and work records; use
                                      administrative and operational
                                      functions

  Officer                             Manage permitted work and
                                      operational records

  Viewer                              Read dashboard and work
                                      information; use permitted viewer
                                      actions such as submitting a
                                      grievance
  -----------------------------------------------------------------------

Actual access is enforced by the backend API. Hiding a button in the
frontend is not a security boundary.

## Features

### Core monitoring

-   Dashboard summaries for total, completed, in-progress, and delayed
    work.
-   Works registry with filtering and work-record management.
-   Work categories and lifecycle statuses.
-   Planned versus actual progress and expenditure fields.
-   CSV import and export.
-   Record attribution and timestamps for supported create/update
    operations.
-   Audit events for successful work deletions.

### GIS and geography

-   Interactive Leaflet map using OpenStreetMap tiles.
-   State and district boundary layers loaded as GeoJSON.
-   Work markers based on stored latitude and longitude.
-   Status legend for proposed, approved, started, and completed work.
-   Geographical views based on the locations present in the
    application's data.

The map is a visualization of records and coordinates stored in the
application. It does not independently verify a work site's location or
completion.

### Operations Hub

-   **Work assignments:** Admins/officers can assign work to an
    admin/officer, set priority and due date, and track Pending, In
    progress, or Completed status.
-   **Grievances:** Authenticated users can submit grievances.
    Admins/officers can update grievance status. The submitting account
    can receive an in-app status notification.
-   **Notifications:** Users can view their own notifications and mark
    them as read.
-   **Evidence register:** Admins/officers can attach HTTPS evidence
    links to a work item with a caption and stage. The application
    stores the link and metadata; it does not upload or store image
    binaries in this feature.
-   **Financial monitoring:** Work records include budget, amount
    released, and expenditure values. Admins/officers can update
    financial figures.
-   **Reports:** Export work data as CSV or use the browser's Print /
    Save as PDF feature.
-   **Risk insights:** Deterministic rules flag overdue works and cases
    where actual progress trails planned progress. These are review
    indicators, not AI predictions or independent verification.
-   **Responsive layout:** The Operations Hub adapts to smaller screens.
    It is not a native mobile application and does not provide
    background/offline synchronization.

## Technology stack

  Layer                 Technology
  --------------------- -----------------------------------
  Frontend              React 19, Vite 8, JavaScript, CSS
  Maps                  Leaflet, OpenStreetMap, GeoJSON
  Charts                Recharts
  Backend               Node.js, Express 4
  Database              MongoDB with Mongoose 8
  Authentication        JWT and bcrypt
  Security middleware   Helmet and API rate limits

## Architecture

``` mermaid
flowchart TD
    U[Admin / Officer / Viewer] --> FE[React + Vite frontend]
    FE -->|HTTP REST + Bearer token| API[Express API]
    API --> AUTH[Authentication and role checks]
    AUTH --> DB[(MongoDB)]
    FE --> GEO[Static GeoJSON boundary layers]
    API --> OPS[Works, assignments, grievances, notifications, reports]
    OPS --> DB
    DEVICE[Field device or API client] -->|Field API key| API
```

The browser calls the backend REST API. The backend validates requests,
applies authentication and role checks, and reads or writes MongoDB
documents. Map boundary files are served separately as static GeoJSON
assets.

## Project structure

``` text
VB-G-RAM-G/
├── backend/                  # Express API, models, routes, tests and scripts
├── frontend/                 # React/Vite application
├── data/                     # Geographic source and processed data
├── docs/                     # Project documentation and data notes
├── .gitignore
├── INSTALL.md
├── LICENSE
├── README.md
└── UPGRADE_NOTES.md
```

## Requirements

-   Node.js version compatible with the `engines` field in the backend
    and frontend `package.json` files.
-   npm.
-   A MongoDB database (local MongoDB or MongoDB Atlas).
-   Git (optional, for cloning and version control).

## Run locally

### 1. Get the source code

``` bash
git clone https://github.com/kundankr93/VB-G-RAM-G.git
cd VB-G-RAM-G
```

If you downloaded the ZIP instead, extract it and open the extracted
project folder in VS Code.

### 2. Configure the backend

``` bash
cd backend
npm ci
```

Copy the example environment file:

**Windows PowerShell**

``` powershell
Copy-Item .env.example .env
```

**macOS / Linux**

``` bash
cp .env.example .env
```

Edit `backend/.env` and set the required values described below. Do not
commit this file.

### 3. Start the backend

From the `backend` directory:

``` bash
npm run dev
```

The default API port is `53184`. The health endpoint is:

``` text
http://localhost:53184/api/health
```

A healthy response should indicate that the API is running and the
database is connected.

### 4. Install and start the frontend

Open a second terminal:

``` bash
cd frontend
npm ci
npm run dev
```

Open the local Vite URL printed in the terminal (normally
`http://localhost:5173`).

The Vite development proxy is configured for the backend's local API
port. If you change the backend port, update the proxy configuration in
`frontend/vite.config.js`.

### 5. Create the first administrator

If the database does not yet contain an administrator, configure the
`ADMIN_*` variables in `backend/.env` and run this from the `backend`
directory:

``` bash
npm run create-admin
```

Use a strong, unique password. Do not use demo credentials for
production.

## Environment configuration

The backend uses `backend/.env`. Refer to `backend/.env.example` for the
current complete list. Common settings include:

  -----------------------------------------------------------------------
  Variable                            Purpose
  ----------------------------------- -----------------------------------
  `PORT`                              API port; default is `53184`

  `MONGODB_URI`                       MongoDB connection string

  `MONGODB_URI_TEST`                  Separate disposable database URI
                                      for database-backed tests, if
                                      configured

  `MONGODB_DNS_SERVER`                Optional DNS resolver for MongoDB
                                      SRV lookup

  `CLIENT_ORIGIN`                     Exact allowed frontend origin(s)
                                      for CORS

  `TRUST_PROXY`                       Proxy trust setting; enable only
                                      when the deployment topology
                                      requires it

  `JWT_SECRET`                        Private JWT signing secret; use at
                                      least 32 random characters

  `FIELD_DEVICE_API_KEY`              Separate secret for field-update
                                      API requests

  `ADMIN_NAME`                        Optional initial administrator name

  `ADMIN_EMAIL`                       Optional initial administrator
                                      email

  `ADMIN_PASSWORD`                    Optional initial administrator
                                      password

  `DEMO_ACCOUNT_PASSWORD`             Password used when creating
                                      demo-only accounts; required by the
                                      demo seed
  -----------------------------------------------------------------------

Never put MongoDB credentials, JWT secrets, field-device keys, or
administrator passwords in frontend variables or Git.

## Demo data

The backend includes a demo seeding workflow that inserts 180 synthetic
work records, sample categories/statuses, and field-update history. The
records are tagged as demo data.

To seed a **disposable demo/test database only**:

1.  Set `DEMO_ACCOUNT_PASSWORD` in `backend/.env` (12--128 characters).
2.  Set `MONGODB_URI` to a database whose database name contains `demo`
    or `test`.
3.  From `backend`, run:

``` bash
npm run seed-demo
```

The seed script has a database-name safety check. Do not bypass it
against a production or real-data database. Re-running the seed requires
clearing the existing demo data first:

``` bash
npm run clear-demo
```

The clear script is intended to remove only tagged demo records and
related demo-only data. Read the script and backend documentation before
running data-removal commands.

Demo login emails created by the seed:

-   `admin.demo@vbgramg.invalid`
-   `officer.demo@vbgramg.invalid`
-   `viewer.demo@vbgramg.invalid`

All demo accounts use the `DEMO_ACCOUNT_PASSWORD` value configured by
you. Do not reuse that password in production.

The UI's **Show demo data** option controls whether demo records are
included in supported views. Demo records and their coordinates are
synthetic and must be labelled as such in demonstrations.

## API overview

The backend exposes REST endpoints. The following is a high-level
overview; inspect the route files for request bodies, validation rules,
and exact access requirements.

  ------------------------------------------------------------------------------------------
  Method                  Endpoint                                   Purpose
  ----------------------- ------------------------------------------ -----------------------
  GET                     `/api/health`                              API and database health

  POST                    `/api/auth/register`                       Viewer registration

  POST                    `/api/auth/login`                          Login and token
                                                                     issuance

  GET / POST              `/api/auth/users`                          User listing/creation
                                                                     (role restricted)

  PATCH                   `/api/auth/users/:id`                      User updates (role
                                                                     restricted)

  GET                     `/api/categories`                          Work category catalogue

  GET / POST              `/api/works`                               List/create work
                                                                     records

  GET / PATCH / DELETE    `/api/works/:id`                           Read/update/delete a
                                                                     work record

  GET                     `/api/works/locations`                     Location values used by
                                                                     work records

  POST                    `/api/works/import`                        Import work records
                                                                     from CSV

  GET                     `/api/works/export.csv`                    Export work records to
                                                                     CSV

  POST                    `/api/field-updates`                       Submit an
                                                                     API-key-protected field
                                                                     update

  GET                     `/api/field-updates`                       View field-update
                                                                     history (authenticated)

  GET                     `/api/dashboard/summary`                   Dashboard summaries and
                                                                     geography metrics

  POST                    `/api/reporting-coverage`                  Manual district
                                                                     zero-work report

  GET / POST              `/api/operations/assignments`              List/create work
                                                                     assignments

  PATCH                   `/api/operations/assignments/:id`          Update an assignment

  GET / POST              `/api/operations/grievances`               List/create grievances

  PATCH                   `/api/operations/grievances/:id`           Update grievance status

  GET                     `/api/operations/notifications`            View the signed-in
                                                                     user's notifications

  PATCH                   `/api/operations/notifications/:id/read`   Mark a notification as
                                                                     read

  GET / POST              `/api/operations/works/:workId/evidence`   List/add evidence links
                                                                     for a work

  PATCH                   `/api/operations/works/:workId/finance`    Update work financial
                                                                     values

  GET                     `/api/operations/insights`                 Rule-based work risk
                                                                     indicators

  GET                     `/api/operations/reports/works.csv`        Export work report
  ------------------------------------------------------------------------------------------

Most endpoints require a bearer token. Field updates use the separate
field-device API key. Role restrictions are enforced by the backend.

## Testing and validation

Run commands from the relevant package directory.

**Backend**

``` bash
cd backend
npm test
```

**Frontend**

``` bash
cd frontend
npm test
npm run lint
npm run build
```

Additional geography/catalogue scripts are documented in
`backend/package.json` and the files under `backend/src/seed`. Use a
disposable test database for any test that writes to MongoDB. Never
point automated tests at the production database.

## Deployment

The application can be deployed as separate frontend and backend
services.

### Backend (for example, Render)

-   Root directory: `backend`
-   Build command: `npm install` (or `npm ci` when the lockfile is used)
-   Start command: `npm start`
-   Configure the backend environment variables in the hosting provider.
-   Configure MongoDB Atlas network access and database credentials for
    the backend host.
-   Set `CLIENT_ORIGIN` to the exact deployed frontend origin.

### Frontend

-   Root directory: `frontend`
-   Build command: `npm install && npm run build` (or
    `npm ci && npm run build`)
-   Publish/output directory: `dist`
-   Set `VITE_API_BASE_URL` to the deployed backend origin if required
    by the frontend configuration.
-   Rebuild the frontend after changing Vite environment variables; Vite
    variables are embedded at build time.

After deployment, verify the backend health endpoint at:

``` text
https://YOUR-BACKEND-HOST/api/health
```

A database connection failure must be diagnosed from backend logs and
MongoDB Atlas configuration. Do not expose database credentials in logs,
screenshots, or the frontend.

## Security and data-handling notes

-   Keep `.env` files out of Git. Commit only sanitized example files
    such as `.env.example`.
-   Use long, unique production secrets for JWT and field-device
    authentication.
-   Use HTTPS for deployed services.
-   Restrict MongoDB network access to trusted sources where practical.
-   Back up production data before schema or operational changes.
-   Evidence entries in this release store HTTPS URLs and metadata, not
    uploaded files. Use a controlled storage provider and access
    permissions for sensitive evidence.
-   Grievance records may contain personal information. Define access,
    retention, and deletion policies before production use.
-   CSV/PDF exports may contain operational data. Share them only with
    authorized recipients.
-   Risk insights are rule-based indicators intended for human review;
    they are not an AI model, official audit, or proof of site
    conditions.

## Known limitations

-   The application does not connect to a verified live government data
    feed.
-   Demo works, coordinates, and some administrative labels are
    synthetic.
-   The map boundary layers are third-party geoBoundaries data and may
    be simplified, outdated, or different from official administrative
    records.
-   Verified block and Gram Panchayat boundary layers and official join
    codes are not included.
-   The official 318-work catalogue has not been verified/integrated.
-   Manual zero-work reporting is a user-entered declaration for a date
    range, not an official data feed.
-   Field-update API support exists, but IoT hardware is not integrated
    in this release.
-   The evidence register stores links and metadata, not uploaded image
    binaries.
-   The Operations Hub responsive layout is not a native/offline mobile
    app.
-   Work records only describe information entered or imported into this
    application's database.

For additional implementation and data-provenance details, see the
`docs/` directory, `INSTALL.md`, `UPGRADE_NOTES.md`, and
`backend/README.md`.

## License

See [LICENSE](LICENSE).
