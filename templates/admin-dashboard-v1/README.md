# Orbit — Admin Analytics Dashboard

A modern responsive admin workspace dashboard starter using plain HTML, CSS and vanilla JavaScript. It runs without a build system.

## Features
- KPI cards for revenue, projects, customers and conversion
- Revenue chart with week, month and year views
- Traffic-source visualization
- Recent projects table with status and progress
- Recent activity feed
- Create-project modal with local demo state
- CSV export of the sample project list
- Responsive sidebar and mobile layout

## Run locally
Open `index.html` in a modern browser, or serve the folder with a static web server. No package installation is needed.

## Customize
- Replace Orbit and Acme Creative branding.
- Update project and activity arrays in `app.js`.
- Replace chart sample values and KPI text with live API data.
- Adjust colors, typography and layout in `styles.css`.
- Update links and contact details in `index.html`.

## Production requirements
This is a front-end admin UI starter, not a secure administration backend. Before using with real business data, implement:
- Authentication, session management and role-based authorization
- Server-side authorization checks for every admin API
- Database-backed KPIs, projects, team and activity events
- Validated project creation and audit logging
- Server-generated exports for sensitive or large reports
- CSRF/XSS protections, rate limits, monitoring and backups

The project creation modal modifies only in-memory demo data. The chart and traffic metrics are illustrative sample values. The CSV export includes only the sample projects currently rendered. Never treat front-end visibility as an authorization boundary.

## Files
- `index.html` — dashboard structure
- `styles.css` — design system and responsive layouts
- `app.js` — sample data, chart controls, modal and CSV export

© YSCMT Enterprise template starter. Replace demo data and branding before production use.