# TallyAI Local Gateway Bridge

The **TallyAI Bridge** is a lightweight, zero-dependency local proxy that connects the TallyAI Web Application (running locally or deployed on Render Cloud) to your local **TallyPrime** installation.

---

## Why is the Bridge Needed?

1. **CORS & Private Network Access Protection**: TallyPrime's built-in HTTP server (`localhost:9000`) does not send browser CORS headers or Chrome Private Network Access headers. Directly sending `fetch()` requests from a web app to Tally is blocked by the browser.
2. **Cloud Deployment Compatibility (Render)**: When TallyAI is deployed on Render Cloud (`https://tally-ai-workstation.onrender.com`), the cloud server is located in an external data center and cannot reach your computer's `localhost:9000`. The local bridge runs on your workstation and allows your browser to push vouchers directly to TallyPrime.

---

## How to Start the Bridge

### Option A: Windows 1-Click (Recommended)
Double-click `start-bridge.bat` in the project root directory.

### Option B: Terminal Command
Run:
```bash
npm run bridge
```
Or:
```bash
node bridge/index.js
```

---

## Configuring TallyPrime

1. Open **TallyPrime** on your computer.
2. Press <kbd>F1</kbd> (Help) &rarr; **Settings** &rarr; **Connectivity**.
3. Set **Client/Server configuration** to: `Both`.
4. Set **Port** to: `9000`.
5. Open your desired company in TallyPrime.

---

## Verifying Connectivity

1. In the TallyAI Web App, navigate to **Export & Tally Gateway Sync** &rarr; **One-Click Gateway Push (Port 9000)**.
2. Click **Test Gateway Ping**.
3. You will see live diagnostics:
   - Bridge Status: **ONLINE** (Port 9001)
   - TallyPrime Status: **ONLINE** (Port 9000)
   - Active Company: Detects your open Tally company.
4. Click **One-Click Push to Tally** to post approved vouchers directly into your Tally company books.
