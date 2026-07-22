# SS Flow — V26 · Email Login & Role-Based Access

Open the link, sign in to the planner. Data is backed by Vercel Blob storage.

## Setup (once)

1. **Blob storage** (skip if already done): Vercel → Storage → Create → Blob → Connect.
2. **Auth Secret**: Vercel → Settings → Environment Variables → add `JWT_SECRET` = a random string (e.g. `openssl rand -base64 32`). Redeploy.
3. **The costs passphrase**: Vercel → Settings → Environment Variables → add `COSTS_KEY` = a phrase you choose. Redeploy.

## How it works

- **First user is Admin**: The first person to visit the app will see a "Create admin account" screen. They create the master account.
- **Role-based Access**: Admins can invite new users, change roles, and edit all data. Viewers can see the board but cannot make edits.
- **Costs are double-locked**: The rate card lives on the server. Even if you are an Admin, you must click **Costs** in Time & Clients and enter the `COSTS_KEY` passphrase to see or edit money. The rates are never sent to a browser without it.
- Old URLs self-forward to **wg-dashboard-three.vercel.app** — stale bookmarks can't strand anyone.
- **Export CSV** in the planner is your backup.
