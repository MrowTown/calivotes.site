# CaliVotes.site Admin Instability — Postmortem & Hardening Notes

This repository documents an intermittent instability affecting the **CaliVotes admin interface**, where authenticated admin requests (e.g. `/api/admin/votes`) would sporadically return `500 Internal Server Error`, appear to bypass authentication order, or cause server restarts.

This repo exists for:
- Root-cause documentation
- Defensive hardening reference
- Audit / “cover your ass” traceability

---

## Symptoms Observed

- Admin UI intermittently fails with `500` on `/api/admin/votes`
- Appears as though requests fire before auth token is available
- Server logs show:
  - `Unhandled 'error' event`
  - `ProcessInterrupts`
  - Repeated `signal: terminated`
- Neon Postgres connections occasionally drop
- Server process restarts amplify the issue

---

## Key Insight (TL;DR)

**This was not a frontend auth race condition.**

The primary failure mode was:

> **Transient database errors triggering Express error handling that crashed the Node process**, causing downstream requests (including auth verification) to fail in confusing ways.

Because admin auth itself queries the database, DB instability masqueraded as an auth-ordering bug.

---

## Root Causes Identified

### 1. Express Error Middleware Crashing the Server

An error handler re-threw caught errors:

```ts
throw err;
