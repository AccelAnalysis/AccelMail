# AccelMail

**Small Batches. Big Returns.**
Local businesses shouldn’t have to commit to huge mailing minimums. AccelMail lets you send as few as **50** postage mailers using your own client list — saving time and money. 

---

## Table of Contents

* [Overview](#overview)
* [Live & Local Development](#live--local-development)
* [Project Structure](#project-structure)
* [Core Features](#core-features)
* [Batch Quantities & Pricing Flow](#batch-quantities--pricing-flow)
* [Front-End Architecture](#front-end-architecture)
* [Admin Dashboard](#admin-dashboard)
* [Google Apps Script Backend](#google-apps-script-backend)
* [Configuration](#configuration)
* [Accessibility & Performance](#accessibility--performance)
* [Contributing](#contributing)
* [License](#license)

---

## Overview

AccelMail is a lightweight, modular, and static-front-end project designed for GitHub Pages or any static host. The UI features a gradient hero with subtle, GPU-friendly animated envelopes and a two-column estimator layout (left: calculator with inline summary, right: design). Full flow implemented with scrollable sections.

---

## Live & Local Development

### Run locally

1. Clone or download this repo.
2. Open `index.html` in your browser. No build step is required.

### Deploy on GitHub Pages

1. Push to a public repo.
2. In **Settings → Pages**, set the branch to `main` and folder to `/root`.
3. The site will be served as a static page.

> The app is fully static: HTML + CSS with modular JS (`scripts/*.js`). 

---

## Project Structure
accelmail/
├── index.html
├── style.css
├── /assets/
│   ├── accelmail_logo.png
│   ├── accel_analysis_logo.png
│   ├── favicon.ico
├── /scripts/
│   ├── config.js
│   ├── form-handler.js
│   ├── date-utils.js
│   ├── ui.js
├── /admin/
│   ├── dashboard.html
│   ├── dashboard.js
│   └── style.css (symlink or copy from root)
└── Code.gs
└── README.md

---

## Core Features

* **Animated hero** with subtle, diagonal floating envelopes (pure CSS keyframes, GPU-friendly). 
* **Two-column estimator**: left calculator with inline total/estimate, right design toggle (upload/request). 
* **Quantity ranges** including **2000+** → triggers custom quote path. 
* **Full flow**: Mailing list upload (with email option), Tuesday-only calendar (Flatpickr, blackouts), checkout summary, confirmation.
* **Branding** aligned with Accel Analysis (logos + colorway in header/footer).  
* **Modular JS** (`config.js`, `form-handler.js`, `date-utils.js`, `ui.js`) for maintainability. 
* **Admin area** with grids for pricing/blackouts/quotes.
* **Apps Script backend (`Code.gs`)** for Sheets-driven data, file storage, automation.

---

## Batch Quantities & Pricing Flow

Available quantity ranges (UI buttons):

* 50–99, 100–249, 250–499, 500–749, 750–999, 1000–1999, **2000+** (quote request). 

**Flow**

1. Hero CTA scrolls to calculator.
2. Select size/quantity → inline total/estimate updates.
3. Continue scrolls to design (toggle upload/request).
4. Continue to mailing list (upload or email).
5. Continue to schedule (Tuesday calendar).
6. Continue to checkout (summary, pay/quote submit).
7. Backend processes, shows confirmation.

---

## Front-End Architecture

* **`index.html`** – Full shell with all sections, Flatpickr CDN.
* **`style.css`** – Theme, grid (two-column for calc/design), responsive.
* **`scripts/config.js`** – API URL, colors, email.
* **`scripts/form-handler.js`** – Config fetch, full submit (with action).
* **`scripts/date-utils.js`** – Flatpickr init (Tuesdays, blackouts).
* **`scripts/ui.js`** – Toggles, button activations, summary population, scrolls.

---

## Admin Dashboard

`/admin/dashboard.html` features:
* Pricing grid (editable cells, add/delete).
* Blackout date picker/list.
* Quote/design/submission tables (fetched from backend).

---

## Google Apps Script Backend

`Code.gs` supports:
* Sheets auto-setup.
* Config/pricing fetch.
* Order/quote submits with file saves (Google Drive).
* Design request logging.
* Tuesday/blackout validation.
* Notifications.

**Deploy**: Create Sheet, add to Apps Script, deploy as Web App.

---

## Configuration

Update `config.js` for SCRIPT_URL. Admin sets sizes/ranges/fees via dashboard (updates backend).

---

## Accessibility & Performance

* Semantic labels, ARIA for toggles/calendar.
* Light animation (transforms/opacity).
* Responsive: Stacks to single column <900px.

---

## Contributing

Fork, branch, maintain modular JS/pure CSS.

---

## License

© 2025 Accel Analysis, LLC. All rights reserved.
