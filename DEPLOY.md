# Deploying Grow Room to Cloudflare Pages (free)

The app becomes a real website (e.g. `https://grow-room.pages.dev`) you can
open from any phone or PC. Shared data is stored in Cloudflare KV through the
same `/api/state` API the local server uses, protected by a passphrase only
you know. Everything fits in Cloudflare's free tier.

## One-time setup (~15 minutes)

1. **Create a free Cloudflare account** at https://dash.cloudflare.com/sign-up
   (no credit card needed).

2. **Build the clean upload copy** (keeps your private `data\` folder out of
   the cloud):

   ```powershell
   .\make-deploy.ps1
   ```

3. **Log the CLI into your account** (opens a browser window — click Allow):

   ```powershell
   npx wrangler login
   ```

4. **Deploy:**

   ```powershell
   npx wrangler pages deploy deploy --project-name grow-room
   ```

   Say yes to creating the project. When it finishes it prints your URL,
   like `https://grow-room.pages.dev`.

5. **Create the shared storage and passphrase** in the dashboard
   (https://dash.cloudflare.com):
   - **Storage & Databases → KV → Create namespace** — name it `GROW_KV`.
   - **Workers & Pages → grow-room → Settings → Bindings → Add →
     KV namespace** — variable name `GROW_KV`, select the namespace.
   - Same Settings page → **Variables and Secrets → Add** — type *Secret*,
     name `GROW_KEY`, value = a passphrase you invent. This is what keeps
     strangers out; make it a real one.

6. **Deploy once more so the bindings take effect:**

   ```powershell
   npx wrangler pages deploy deploy --project-name grow-room
   ```

7. **Move your data in:** open your old app (`http://localhost:4173`), click
   **Export**. Open the new URL, enter your passphrase when prompted, click
   **Import** and pick the exported file. Done — phone and PC now share the
   cloud copy from anywhere.

## Updating the app later

```powershell
.\make-deploy.ps1
npx wrangler pages deploy deploy --project-name grow-room
```

## Notes

- The passphrase is remembered per browser after the first prompt. To change
  it, update the `GROW_KEY` secret in the dashboard and redeploy; each device
  will prompt again. (To reset a saved passphrase in a browser, clear site
  data for the URL.)
- KV keeps the previous version of your data under `state-prev` — a one-step
  undo. KV free tier (100k reads / 1k writes per day) is far beyond what this
  app uses.
- The local `serve.js` workflow keeps working unchanged; it ignores the
  passphrase header. localhost and the pages.dev site are separate browser
  origins — they share data only through whichever server each one talks to.
- Your grow data lives in your Cloudflare account's KV under the passphrase.
  Keep using **Export** for periodic offline backups.
