# Build SP Net Worth Tracker

Build **SP Net Worth Tracker**, a polished personal net worth and asset allocation tracker. It should help me understand what I own, how my wealth changes, and whether I have too much money concentrated in one asset or category.

## Design

Use the **Powder & Coral** palette:

- Pale powder blue background: `#EEF6FB`
- White surfaces where needed: `#FCFEFF`
- Soft coral accents: `#DA8B7B`
- Dark main text: `#293844`
- Readable secondary text: `#4E6170`

Keep everything light. I find white text on dark backgrounds difficult to read, so avoid dark panels and dark mode styling. Use dark text on light buttons, too. Use a deeper coral shade where necessary for readable chart lines, focus indicators, or text.

Make the design spacious, attractive, and easy to scan. Use large, readable typography and a clean system font. Aim for 16–18px body text, prominent financial values, and strong contrast throughout.

Avoid excessive boxes, cards, badges, icon tiles, and decorative containers. Use whitespace, alignment, and subtle dividing lines to organize information. Filters can be simple text tabs; categories can use a small color dot and plain text.

Show the complete name **SP Net Worth Tracker** in the app header, browser title, metadata, and project documentation. Make sure the long name fits mobile screens.

## Dashboard hierarchy

1. **Net worth is the main focus.** Display it as one large dark number, around 64–72px on desktop, directly on the light background.
2. Show total assets and total debts as much smaller supporting inline figures underneath. Do not give them equal visual importance or put them in three matching cards.
3. **Holdings are the most important working section.** Place them immediately below the net worth summary, above all charts. Avoid an unnecessary outer frame around the table.
4. Place portfolio growth and allocation charts below the holdings.

Use simple navigation: **Holdings, Allocation, History**, plus Settings.

## Holdings and balances

Let me add, edit, and delete cash accounts, investments, other assets, and debts.

The holdings table should clearly show:

- Name and optional institution/account
- Category
- Current total value
- Percentage of total assets
- Edit and history actions

Make values, percentages, and categories immediately readable. Include search, category filtering, asset/debt filtering, and a quick bulk balance update flow.

Keep the **Add holding** form simple: asset or debt, name, current balance, and category for assets. Put optional account details behind a disclosure. Use plain labels, dark input text on white fields, clear validation, and obvious save/cancel actions.

## Allocation

Let me create and manage categories such as Cash, Bitcoin, High Risk, and Index Funds.

Allow target percentages totaling 100%. Compare each category's actual percentage with its target, showing the percentage difference and monetary amount above or below target.

Calculate allocation using **total assets before debts**. Calculate net worth as **assets minus debts**.

## Snapshots and history

Include a prominent **Take snapshot** action that captures:

- Total assets, total debts, and net worth
- Every holding's name, category, and value
- Each asset's percentage of total assets at that moment
- Capture date and time

Allow multiple snapshots on the same day. Saved snapshots must remain unchanged when I later edit, rename, recategorize, or delete holdings.

Also maintain automatic daily balance history. Clearly distinguish daily updates from explicitly saved snapshots.

Let me view history for the entire portfolio or an individual holding. For each asset, provide both **value over time** and **portfolio percentage over time**. Preserve recorded history for deleted holdings.

Make charts large and readable, with clear axis labels, date ranges, and accessible tooltips. Let me expand a saved snapshot to inspect its original holdings.

## Data and usability

Start with manual entries and one selectable currency. Clearly explain that changing the currency label does not convert amounts.

Save data between visits using browser local storage. Include JSON backup export and validated import. Preserve compatibility with existing portfolio data and backups, including backups from earlier product names. Keep the existing storage key so renaming the app does not lose saved data. Retain older total-only snapshots without inventing missing asset history.

Include a clearly labeled example portfolio and a **Start my portfolio** option.

Support desktop and mobile layouts, keyboard navigation, and readable forms on small screens. No bank connections, automatic prices, accounts, or cloud syncing are needed for this version.

## Implementation and validation

Use React, TypeScript, and Vite with sensible technical defaults. Build a working application, not just a visual mockup.

Verify calculations, persistence, portfolio editing, allocation targets, immutable snapshots, per-asset history, and backup restoration. Check text contrast and responsive layouts in a browser.

Deliver the source code, local startup instructions, and screenshots of the actual application.
