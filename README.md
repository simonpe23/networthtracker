# SP Net Worth Tracker

A personal net worth and asset allocation tracker, built with React, TypeScript, and Vite. The interface uses the selected Powder & Coral palette (pale blue surfaces, coral accents, dark text) and system fonts. Net worth is the main figure, with assets and debts as supporting inline totals. Holdings come before charts, with large readable values and fewer decorative frames.

The complete product brief is in [BUILD_PROMPT.md](BUILD_PROMPT.md).

## Run locally

Requires Node.js 22.12+ (Node 24 recommended) and npm.

```sh
npm ci
npm run dev
```

Open the localhost URL printed by Vite. In a cloud workspace, use `npm ci --cache /workspace/.npm-cache` if the home directory is read-only. To use port 3000 explicitly: `npm run dev -- --port 3000`.

## Validate

```sh
npm test
npm run build
```

Start the dev server on port 3000, then run `npm run test:e2e`. Browser tests use Chromium at `/usr/bin/chromium`; set `CHROMIUM_PATH` to an installed Chromium executable on another machine.

## Features

- Holdings-first dashboard, clear categories, and prominent asset values and portfolio percentages.
- Add, edit, and delete assets/debts. Bulk balance updates and category search/filtering.
- Net worth, total assets, total debts, and interactive large charts.
- Custom allocation targets with actual percentages, target amounts, and over/under comparisons.
- Explicit **Take snapshot** action saves the entire portfolio at that moment, including each holding's name, category, balance, and percentage of total assets.
- **History → History for** lets you select the portfolio or any current or removed holding. Switch between balance and portfolio share to track concentration over time.
- Expand a portfolio snapshot to inspect its original holding breakdown. Saved snapshots are immutable, even after editing or deleting a holding.
- Browser storage, JSON backup export/import, currency display preferences, and monetary privacy mode.
- Responsive layouts, keyboard-accessible forms, contrast checks, and reduced motion support.

## Data and calculations

No account or external service is required. Portfolio data is stored under the existing `folio-portfolio-v1` local storage key, preserving compatibility with the first version. Data belongs to the current browser and origin; there is no server storage, cross-device sync, price feed, or automatic currency conversion. Export a backup before clearing browser data, changing devices, or switching website addresses/ports.

The example portfolio contains clearly labeled illustrative historical data. Choose **Example portfolio → Start my portfolio** to clear it.

Net worth = assets − debts. Allocation percentages and target amounts use total assets before debts. Enter each holding's total value in your chosen currency. Changing currency relabels amounts without conversion.

Balance changes maintain a daily working record using the browser's local calendar day. **Take snapshot** creates a separate, timestamped saved record; multiple snapshots can be saved on the same day. Editing balances, names, or categories never alters a saved snapshot. Deleting a holding preserves its recorded history; subsequent detailed records correctly show zero value/share when it is absent.

Old backups and existing browser data are accepted. Old snapshots containing only portfolio totals are retained, but individual asset histories cannot be reconstructed from those totals. Per-asset tracking begins with the first detailed daily record or explicit saved snapshot. Import replaces the current portfolio.

## Production

`npm run build` writes a static website to `dist/`. Deploy that directory on a static host such as Vercel, Netlify, or GitHub Pages. No secrets or runtime environment variables are required. `npm run preview` serves the built site for local verification.

## Downloadable editions

After building, `python3 scripts/package.py` creates `release/sp-net-worth-tracker-powder-coral.html` (all application code, styles, and fonts embedded) and `release/sp-net-worth-tracker-powder-coral-source.zip`. An optional output-directory argument writes the downloads elsewhere. The single-file edition can also be served with any local HTTP server. Managed browsers may restrict local file URLs; the development server remains the recommended way to test.

## Publish with GitHub Pages

The repository includes a **Deploy SP Net Worth Tracker** GitHub Actions workflow. It builds and tests the app, then deploys the static site using GitHub's official Pages actions.

One-time setup in GitHub:

1. Open repository **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Open **Actions → Deploy SP Net Worth Tracker → Run workflow** and select `main`.

The deployment job reports the site's actual URL. Future pushes to `main` deploy automatically. GitHub Pages availability depends on repository visibility and the GitHub account's plan; no repository visibility change is required or performed by the app.

The Pages build sets the base path to `/networthtracker/` so scripts, styles, and the favicon load correctly at the project-site URL. Local development and deployment to a root domain still use Vite's default `/` base. For a manual Pages build:

```sh
npm run build -- --base=/networthtracker/
```

Your financial entries are browser-local and are not committed to GitHub or uploaded by this app. Export a backup from your local copy and import it on the live site, since browser storage is separate for each website address.
