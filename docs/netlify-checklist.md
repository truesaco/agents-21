# Netlify setup checklist (M1, updated M4)

These steps are done by you in the Netlify web UI. The build agents can't log
into your Netlify account, so none of this has been done for you. Menu names
match the Netlify UI as of late 2026 and may move slightly.

## 1. Connect the repo
1. Netlify → **Add new project** (or "Add new site") → **Import an existing project** → **GitHub**.
2. Authorize Netlify for the repository and pick it.
3. Build settings come from `netlify.toml`, so leave them as detected:
   - Build command: `npm run build` (this also runs the secret scan before and after the Vite build)
   - Publish directory: `dist`
   - Functions directory: `netlify/functions` (the default)
4. Production branch: `main`. Click **Deploy**. The first production deploy builds `main`.

## 2. Turn on deploy previews and branch deploys
**Project configuration → Build & deploy → Continuous deployment → Branches and deploy contexts → Configure**
- **Deploy previews:** "Any pull request against your production branch". Netlify builds a preview for every PR.
- **Branch deploys:** "All", or "Let me add individual branches" and add `claude/eloquent-pasteur-991nv2`. You get a preview of the branch without opening a PR.

## 3. Add the API key, scoped to Functions only
**Project configuration → Environment variables → Add a variable → Add a single variable**
- Key: `ANTHROPIC_API_KEY`
- Value: `<your key>` (paste it only here, never into the repo, chat or an issue)
- If your plan offers it, tick **Contains secret values**. Netlify then hides the value and runs its own secret scan on build output.
- **Scopes:** choose **Specific scopes** and tick **Functions** only. Leave Builds, Runtime and Post processing unticked. The build then never sees the key, so it can't be inlined into the browser bundle.
- **Deploy contexts:** "Same value for all deploy contexts", or set it only for Production and Deploy previews/Branch deploys if you want to keep live mode off in some contexts.
- Do **not** create any variable whose name starts with `VITE_` for secrets. Vite copies `VITE_*` variables into the browser JavaScript.

Optional variables (same screen, scope them to Functions too):

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_MODEL` | `claude-opus-5-5` | Model used for live analysis |
| `ANTHROPIC_EFFORT` | `low` | Keeps each vendor within Netlify's 60-second streaming limit |
| `RATE_LIMIT_PER_HOUR` | `12` | Live vendor analyses per IP per hour |
| `RATE_LIMIT_GLOBAL_PER_DAY` | `150` | Live vendor analyses per day for the whole site |
| `LIVE_PASSCODE` | unset | Optional shared passcode for live mode. When set, live analysis asks for it; when unset or blank, live mode is open as before. Demo mode never needs it. |

## 4. Trigger a deploy
Environment variable changes only apply to new deploys.
- **Deploys → Trigger deploy → Deploy project** (production), or
- for a branch or PR preview, open that deploy and click **Retry deploy**, or push a commit to the branch.

Check the deploy log. You should see two lines starting with `check-secrets: OK.` (one before the Vite build, one after). If either says `FAILED`, the build stops on purpose. The log lists `file:line` for each finding.

## 5. Find the preview URL
- **Deploys** list → click the deploy for the branch or PR → **Open deploy preview** (top of the page).
- URL patterns:
  - PR deploy preview: `https://deploy-preview-<PR number>--<project-name>.netlify.app`
  - Branch deploy: `https://<branch-name-with-slashes-as-dashes>--<project-name>.netlify.app`, for example `https://claude-eloquent-pasteur-991nv2--<project-name>.netlify.app`
- On GitHub, the PR's checks section also links to the Netlify deploy preview.

## 6. M1 test steps (from the PRD)
1. Open the preview URL and click **Load sample data → Next → Run comparison**. The demo table appears.
2. In DevTools, open **Sources**, press Ctrl/Cmd+Shift+F to search all files, and search for `sk-ant` and then `ANTHROPIC`. Neither has any matches.
3. Visit `<preview URL>/api/status`. It returns `{"liveEnabled":true}` (or `false` if the key isn't set for that context) and nothing else.
4. In DevTools, open **Network**, reload, click the first (document) request, and look at **Response Headers**. `Content-Security-Policy`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff` and `Permissions-Policy` are all there.

While you're in DevTools, also check that the **Console** shows no red "violates the following Content Security Policy directive" messages.

## 7. M4: optional live-mode passcode
Use this if you don't want anyone with the URL to spend your live quota.

1. **Project configuration → Environment variables → Add a variable**
   - Key: `LIVE_PASSCODE`
   - Value: `<your passcode>`. Use a long passphrase of ASCII characters (for example four or more random words). There is no lockout after wrong guesses, so length is what protects it.
   - Tick **Contains secret values** if offered. **Scopes:** **Functions** only, like the API key.
   - Do **not** name it `VITE_LIVE_PASSCODE` or put it anywhere in the repo.
2. Trigger a new deploy (section 4). Variable changes only apply to new deploys.
3. Check: `<site URL>/api/status` now returns `{"liveEnabled":true,"passcodeRequired":true}`. The passcode itself is never shown.
4. Open the site in a private window and try live mode. It asks for the passcode; a wrong one is refused with a generic message.
5. Share the passcode out of band. To rotate it, change the value and redeploy. To turn it off, delete the variable and redeploy.

The rate limit (`RATE_LIMIT_PER_HOUR`, `RATE_LIMIT_GLOBAL_PER_DAY`) still applies on top of the passcode. Since M4 the counters use atomic conditional writes in Netlify Blobs; if Blobs is unreachable, live analysis is refused with a 503 rather than running unmetered.
