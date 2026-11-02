# Pitlane Bridge

Connect local Pitlane to DeepSeek and the original Antigravity App through its official Remote Control UI. This is a separate extension from Codex's browser extension.

## Install and pair

1. Review `manifest.json` and the source files in this folder.
2. In the Chrome profile where DeepSeek is signed in, open `chrome://extensions`.
3. Enable Developer mode, choose **Load unpacked**, and select this folder.
4. In Pitlane, open the gear next to DeepSeek → **Pitlane Bridge** → **Generate pairing code**.
5. Open the Pitlane Bridge popup from Chrome's Extensions menu, paste the code, and choose **Connect**. The code works once and expires after five minutes.
6. Refresh the existing DeepSeek tab once after installation so its content scripts are loaded. Keep that signed-in tab open.
7. The DeepSeek card should become Connected. Use **Test connection** in its settings, then send a message to `@DeepSeek Web` in Pitlane.

Chrome and the Pitlane backend must remain running. The backend uses port 4318. The extension wakes itself using Chrome alarms and polls the backend while connected; Codex does not need to remain active.

## Access and credentials

- Host access: `https://chat.deepseek.com/*`, `https://antigravity.google.com/*`, `https://antigravity.static.usercontent.goog/*`, and `http://127.0.0.1/*` (the code contacts only `127.0.0.1:4318`).
- Chrome permissions: `storage`, `alarms`, and `scripting` (rendered editor discovery in the permitted Antigravity frame). No debugger, cookies, browser-history, or all-sites permission.
- No account password, cookie, or DeepSeek token is read or copied.
- A dedicated Pitlane credential is stored in extension-local storage restricted to trusted extension contexts. The backend stores only its SHA-256 hash under ignored `data/`.
- **Disconnect** in Pitlane revokes that credential. Re-pairing replaces the previous grant. Server restart preserves the grant but requires a fresh extension heartbeat before showing Connected.

## What happens to messages

For each request, a temporary tab is opened in the same signed-in Chrome profile. Pitlane's assembled prompt (including the selected Soul Memory, Project Memory, decisions, and transcript) is entered there. The page's own send control and network request are used; no internal API request is manufactured with a copied account token.

The page hook reads the response stream for that exact prompt and forwards it to local Pitlane. Only answer fragments are displayed. A completed stream is required; errors, interrupted streams, unsupported formats, and expired request IDs fail closed. The temporary tab closes when the job ends or is cancelled. The original DeepSeek tab stays open. DeepSeek can retain the generated conversation in its own history.

Images for the current request are fetched from the authenticated local bridge route, uploaded through DeepSeek's page input, and checked for an upload-success response before sending. Unsupported or failed upload stops the request. Other files are included as extracted text by Pitlane.

If DeepSeek asks for login or CAPTCHA, complete it yourself in Chrome. This extension does not solve or bypass verification. Changes to DeepSeek's UI or stream format can require an extension update.

## Files to review

- `background.js`: pairing credential, scoped backend requests, job-tab ownership and lifecycle.
- `content.js`: message entry, upload, and stream relay in the bridge-created tab only.
- `page-hook.js`: response observation in the page world; no cookie, storage, or auth-header access.
- `popup.html`, `popup.js`, `popup.css`: pairing UI.
- `manifest.json`: identity and host permissions.

The manifest key is a public extension identity key, not a login credential. Keep it unchanged when updating this unpacked extension so the backend recognizes its origin.


## Original Antigravity App chat

Enable Remote Control in the Antigravity App, then sign in at `https://antigravity.google.com` using the same account. Open the native conversation there. In Pitlane, open the project menu → Linked App Chat → Antigravity, select that conversation and paste its Remote Control chat URL. No Roblox game folder is required; a local agent workspace is created automatically when needed.

Install this extension in that Chrome profile. Generate a code from the project's App bridge setup, select **Antigravity App** in this extension popup, paste the code and Connect. This pairing is separate from DeepSeek: the services can use different profiles without revoking each other's grants. After updating the unpacked extension, Reload it. The worker installs its frame reader in an already-open healthy Remote Control tab; a page refresh and pairing again are unnecessary. Keep Chrome, the Remote Control tab, Antigravity App, Roblox Studio and Pitlane running.

`app-worker.js` finds the permitted native frame, scopes jobs to that tab/frame and routes requests through the existing chat. `app-content.js` enters a structured JSON context bundle using the visible editor and clicks its Send button. It reads only the new response after the unique submitted Pitlane marker. No account cookies/tokens or private App APIs are used. It never creates a CLI copy or approves native tool prompts. Handle approvals in the original App. Native App permissions and model remain in effect. Stop targets only a native turn whose latest user message has the matching Pitlane request marker.

Before showing Saved, the backend verifies the unique request marker was appended to the original App conversation database using read-only SQLite queries. A rendered old reply, a draft, a different chat, a lost worker, or a reconnecting Remote Control page cannot count as success. CLI quota data is not used as a substitute for the App account's limits.

Verified on 2026-11-02: an automated Pitlane message reached the original App chat and invoked Roblox_Studio/list_roblox_studios, returning Garage Town (Place ID 104575679795433). A subsequent automated receive test returned PITLANE_NATIVE_HISTORY_OK to Pitlane, parsed its checkpoint, verified its request marker in the original App database, and delivered the result through the production Next.js SSE route. The receive reader handles both the native live-response markup and hidden tool traces. Remote Control itself has intermittently stalled at “Connecting to instance…”; keep a healthy signed-in tab open and use a fresh device tab if necessary. These tests were read-only and did not edit the game.
