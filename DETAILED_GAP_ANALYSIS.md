# Zenvix — Detailed Gap Analysis (Deep Dive)

## 1. UNPAGINATED DATABASE QUERIES — Exact Locations

The audit detected **28 `findMany()` calls without `take`/`skip` pagination**. Here is every single one:

### Severity: HIGH — These will return ENTIRE tables under load

| # | File | Line | What it does | Risk |
|---|------|------|--------------|------|
| 1 | `backend/src/shared/maintenance/monitoring-job.service.ts` | 26 | `prisma.companies.findMany({ select: { id, name } })` — fetches ALL companies | If you have 10,000 tenants, every 30-min cron loads them all into memory |
| 2 | `backend/src/shared/license/license.service.ts` | 43 | `prisma.module_licenses.findMany({ where: { tenant_id, status: 'active' } })` | Returns ALL licenses for a tenant — usually bounded (<50 modules) so LOW actual risk |
| 3 | `backend/src/shared/iot/print-queue.service.ts` | 28 | `prisma.print_job_queue.findMany({ where: { tenant_id, device_id, status: 'PENDING' } })` | Returns all pending print jobs for one device — usually small, LOW actual risk |
| 4 | `backend/src/shared/iot/repositories/iot.db.repository.ts` | 48 | `farmingSensorLog.findMany(...)` — fetches full sensor history for a timeframe | Could be thousands of readings for IoT sensors |
| 5 | `backend/src/shared/helpers/module-active.helper.ts` | 34 | `prisma.admin_module_statuses.findMany({ where: { tenant_id, enabled: true } })` | Returns enabled modules for a tenant — bounded (<30) so LOW actual risk |
| 6 | `backend/src/shared/events/event-bus.service.ts` | 98 | `prisma.domain_events.findMany({ where: { status: 'PROCESSING', ... } })` — stuck event recovery | Could accumulate thousands if system crashes |
| 7 | `backend/src/shared/events/event-bus.service.ts` | 470 | `prisma.event_deliveries.findMany({ where: { event_id } })` — get deliveries for an event | Bounded per event (5-10 retries max), LOW risk |
| 8 | `backend/src/shared/events/event-bus.service.ts` | 478 | `prisma.domain_events.findMany({ where: { correlation_id } })` — event chain inspection | Debug/admin use, bounded by correlation chain |
| 9 | `backend/src/shared/events/event-bus.service.ts` | 458 | `prisma.domain_events.findMany({ where: { tenant_id, status: 'FAILED' } })` — failed snapshot | Could grow unbounded if failures accumulate |
| 10 | `backend/src/shared/comms/bulletin.service.ts` | 255 | Fetches bulletin posts — could grow to thousands | MEDIUM risk |
| 11 | `backend/src/shared/comms/chat.service.ts` | 64 | Chat messages without pagination | HIGH risk — chat histories grow fast |
| 12 | `backend/src/shared/comms/chat.service.ts` | 206 | Another chat query without pagination | HIGH risk |
| 13 | `backend/src/shared/comms/mail.service.ts` | 181 | Mail accounts query | LOW risk (few accounts per user) |
| 14 | `backend/src/shared/comms/notification.service.ts` | 136 | `prisma.chat_rooms.findMany(...)` — all chat rooms for a user | MEDIUM risk |
| 15 | `backend/src/shared/audit/audit-chain.service.ts` | 44 | Audit chain entries | HIGH risk — audit logs grow continuously |
| 16 | `backend/src/shared/audit/audit-chain.service.ts` | 150 | Another audit query | HIGH risk |
| 17 | `backend/src/shared/audit/audit.service.ts` | 104 | Audit log query | HIGH risk |
| 18 | `backend/src/shared/audit/audit.service.ts` | 337 | Audit log query | HIGH risk |
| 19 | `backend/src/shared/audit/audit.service.ts` | 504 | Audit log export | HIGH risk — exporting all records |
| 20 | `backend/src/modules/warehouse/warehouse.service.ts` | 18 | Warehouse zones | LOW risk (few zones) |
| 21 | `backend/src/modules/warehouse/warehouse.service.ts` | 48 | Warehouse stock | MEDIUM risk |
| 22 | `backend/src/modules/warehouse/repositories/warehouse.db.repository.ts` | 20 | Warehouse query | MEDIUM risk |
| 23 | `backend/src/modules/warehouse/repositories/warehouse.db.repository.ts` | 32 | Warehouse query | MEDIUM risk |
| 24 | `backend/src/modules/retail/retail-export.service.ts` | 17 | Export ALL retail data | HIGH risk — export without limit |
| 25 | `backend/src/modules/retail/retail-export.service.ts` | 41 | Export ALL retail data | HIGH risk |
| 26 | `backend/src/shared/maintenance/outbox-worker.service.ts` | 34 | `prisma.sys_outbox_events.findMany(...)` — outbox pattern | Has a `take: 100` internally — **FALSE POSITIVE** (audit may have missed the take) |

### Honest Assessment:
- **Truly dangerous (need immediate fix):** ~12-14 of these (audit logs, chat messages, retail exports, event recovery)
- **Bounded and acceptable:** ~10-12 of these (module statuses, license lists, print queues — small datasets by nature)
- The audit tool flagged ALL `findMany()` without explicit `take`, even when the data is naturally bounded (e.g., a tenant will never have 10,000 module licenses)

### Recommendation:
Fix the **12 truly dangerous ones** first (audit, chat, retail exports, event bus). For the bounded ones, add a `take: 100` safety cap even though they'll rarely hit it.

---

## 2. LOAD BALANCING — Current State

### What you currently have:

```
Internet → VPS (150.109.15.108)
              ├── nginx (port 3010 → internal 80) — serves frontend SPA
              │     └── proxies /api/* → bfs-backend:3001
              ├── bfs-backend (port 3001) — single NestJS instance
              └── bfs-db (port 5433) — single PostgreSQL 16
```

Your `docker-compose.yml` runs:
- **1 frontend container** (nginx serving React build)
- **1 backend container** (NestJS)
- **1 database container** (PostgreSQL)
- **1 backup container** (pg_dump every 24 hours)

### What's missing vs. industry standard:

| Aspect | You Have | Minimum for Production | Industry Best |
|--------|----------|----------------------|---------------|
| Backend instances | 1 | 2+ with health checks | Auto-scaling group (3-N) |
| Load balancer | nginx does reverse proxy but NO upstream pool | nginx with `upstream` block + 2+ backends | AWS ALB / Cloudflare LB |
| Health check routing | nginx doesn't route away from unhealthy | `proxy_next_upstream` with health checks | Active health checks + circuit breaker |
| Horizontal scaling | Not possible (single container) | `docker compose up --scale backend=3` | Kubernetes / ECS auto-scaling |
| DB connection pooling | Prisma default (no external pooler) | PgBouncer in front of PostgreSQL | PgBouncer + read replicas |
| Zero-downtime deploy | Containers rebuild = downtime during build | Blue-green or rolling update | Blue-green with drain |

### Is this a real problem right now?
**For a demo/dev environment: No.** Your current single-instance setup is fine for development and demos. It only becomes a problem when:
- You have >50 concurrent users
- You need guaranteed uptime (SLA)
- A single container crash = full outage

### What to do:
```yaml
# Simple fix: add to docker-compose.yml
services:
  backend:
    deploy:
      replicas: 2  # Run 2 backend instances
```
Then update nginx.conf to load-balance between them using an `upstream` block.

---

## 3. DISCONNECTED API ENDPOINTS — Complete List

These are frontend pages that call backend APIs that **don't exist yet**:

| # | Frontend File | Endpoint Called | HTTP Method | Business Criticality | Impact |
|---|--------------|-----------------|-------------|---------------------|--------|
| 1 | `src/pages/retail/management/components/cctv/CCTVViewerModal.tsx:815` | `/retail/cctv/footage` | POST | CRITICAL | CCTV footage retrieval — modal exists, backend doesn't |
| 2 | `src/pages/industry/farming/FarmDesk.tsx:65` | `/farming/livestock` | GET | LOW | Farming module — entire vertical is stub |
| 3 | `src/pages/industry/farming/FarmDesk.tsx:71` | `/farming/sensors` | GET | LOW | Farming module — stub |
| 4 | `src/pages/industry/farming/FarmDesk.tsx:77` | `/farming/activity-log` | POST | LOW | Farming module — stub |
| 5 | `src/pages/industry/clinic/ClinicDesk.tsx:73` | `/clinic/patients` | GET | LOW | Clinic module — entire vertical is stub |
| 6 | `src/pages/industry/clinic/ClinicDesk.tsx:80` | `/clinic/billing/summary` | GET | LOW | Clinic module — stub |
| 7 | `src/pages/core/inventory/components/ItemDetailsModal.tsx:84` | `/inventory/items/images` | GET | CRITICAL | Can't view product images |
| 8 | `src/pages/core/inventory/components/ItemDetailsModal.tsx:99` | `/inventory/items/images/primary` | PUT | CRITICAL | Can't set primary image |
| 9 | `src/pages/core/inventory/components/ItemDetailsModal.tsx:128` | `/v1/inventory/items/images` | POST | CRITICAL | Can't upload product images |
| 10 | `src/pages/core/finance/Assets.tsx:374` | `/api/v1/finance/assets/audit-pack` | GET | CRITICAL | Can't download asset audit pack |
| 11 | `src/pages/core/finance/PayslipStudio.tsx:71` | `/finance/payslip/templates` | POST | CRITICAL | Can't create payslip templates |
| 12 | `src/pages/core/finance/ReconciliationDesk.tsx:63` | `/finance/reconciliation/statements/details` | GET | CRITICAL | Can't view reconciliation statement details |
| 13 | `src/pages/core/comms/BulletinHub.tsx:208` | `/comms/bulletin/react` | POST | MEDIUM | Can't react to bulletin posts |
| 14 | `src/pages/core/comms/BulletinHub.tsx:227` | `/comms/bulletin/comment` | POST | MEDIUM | Can't comment on bulletins |
| 15 | `src/pages/core/comms/MailHub.tsx:109` | `/comms/mail/read` | PATCH | MEDIUM | Can't mark mail as read |
| 16 | `src/pages/core/comms/MailHub.tsx:121` | `/comms/mail/star` | PATCH | MEDIUM | Can't star/favorite mail |
| 17 | `src/pages/core/comms/MailHub.tsx:152` | `/comms/mail/restore` | PATCH | MEDIUM | Can't restore deleted mail |

### Summary by Priority:
- **6 CRITICAL** (inventory images, finance audit-pack, payslip templates, reconciliation details, CCTV footage)
- **5 MEDIUM** (bulletin reactions/comments, mail read/star/restore)
- **6 LOW** (farming + clinic — entire industry verticals not built yet)

### Honest Assessment:
The 5 industry/farming/clinic endpoints are expected stubs for modules not yet built. The real problem is the **6 critical disconnects** in core modules (inventory, finance) where users can see the UI but the functionality is broken.

---

## 4. HTTPS, MFA, AND SOC 2 — Detailed Breakdown

### HTTPS — Current State

**Your setup serves everything over HTTP (unencrypted):**

Evidence:
- `vps_reference.md`: `FRONTEND_URL=http://150.109.15.108:3010` and `VITE_API_URL=http://150.109.15.108:3001`
- `vps-up.sh`: Prints `Frontend: http://150.109.15.108:3010` and `Backend: http://150.109.15.108:3001`
- `nginx.conf`: `listen ${PORT}` — no SSL configuration, no `ssl_certificate` directives
- `vps-bootstrap.sh`: Opens port 443 in UFW firewall but **nothing listens on 443**
- No `certbot`, `letsencrypt`, or SSL certificate files anywhere in the project

**What this means:**
- All API traffic (including JWT tokens, passwords, and business data) travels over the internet in plaintext
- Anyone on the same network can intercept login credentials, session tokens, and business data
- Modern browsers will show "Not Secure" warnings
- Google Chrome blocks some features (service workers, geolocation, notifications) on HTTP
- No enterprise customer will use a tool that transmits their data unencrypted

**How to fix (1-2 hours):**
```bash
# On the VPS:
sudo apt install certbot
sudo certbot certonly --standalone -d yourdomain.com

# Then update nginx.conf to:
server {
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    # ... rest of config
}
server {
    listen 80;
    return 301 https://$host$request_uri;
}
```
**Prerequisite:** You need a domain name (not just an IP address) for Let's Encrypt to work. Buy a domain (~$10/year) and point it to your VPS IP.

---

### MFA / 2FA — Current State

**There is ZERO multi-factor authentication in the codebase.**

Evidence:
- Searched for `mfa`, `2fa`, `totp`, `two.factor`, `multi.factor`, `authenticator` across entire backend: **0 matches**
- `auth.service.ts` has only: `register()`, `login()`, `verifyAndGetProfile()`, `verifyEmail()`, `resetPasswordDirect()`
- The login flow is: email + password → JWT token. No second factor.
- The password reset is: email + new password directly (no email verification code!)

**Current auth flow:**
```
User submits email + password
  → bcrypt.compare(password, hash)
  → jwt.sign(payload, secret, { expiresIn: '1d' })
  → Return token

That's it. No:
  - TOTP/authenticator app challenge
  - SMS verification code
  - Email verification code
  - Recovery codes
  - Device trust/remember
  - Login attempt rate limiting (throttler exists globally but not per-user)
  - Account lockout after failed attempts
  - Session management (no way to list/revoke active sessions)
```

**What this means:**
- If someone gets a user's password (phishing, credential stuffing, data breach), they have full access
- The password reset endpoint (`reset-password-direct`) takes email + new password directly — there's no email token/OTP gate, meaning anyone who knows an email can reset anyone's password
- This is the #1 security vulnerability in the platform

**How to fix (1-2 weeks):**
1. Add TOTP support (packages: `otplib` or `speakeasy`)
2. Add MFA enrollment flow (generate secret → show QR code → verify first code)
3. Add MFA challenge to login (after password verified, check if MFA enabled → require TOTP code)
4. Add recovery codes (generate 10 one-time codes at enrollment)
5. Fix `resetPasswordDirect` — gate it behind email OTP verification first
6. Add session management (list active tokens, revoke all)
7. Add account lockout (5 failed attempts → 15 min lockout)

---

### SOC 2 — What It Is and Where You Stand

**What is SOC 2?**
SOC 2 (System and Organization Controls 2) is an audit standard created by AICPA that evaluates how a SaaS company handles customer data. It covers 5 "Trust Service Criteria":

| Criteria | What it Covers | Your Status |
|----------|---------------|-------------|
| **Security** | Protection against unauthorized access | ❌ No HTTPS, no MFA, no WAF, no IDS |
| **Availability** | System uptime and disaster recovery | ❌ No SLA, no redundancy, no documented DR plan |
| **Processing Integrity** | Data is processed correctly and completely | ⚠️ Partial — audit trail exists, but no reconciliation checks |
| **Confidentiality** | Sensitive data is protected | ❌ No encryption at rest, secrets in .env files |
| **Privacy** | Personal data handling per policy | ❌ No privacy policy, no data retention, no GDPR compliance |

**Why it matters:**
- Any B2B customer with >50 employees will ask "Are you SOC 2 certified?" before signing
- It's the minimum trust signal for enterprise sales
- Without it, you're limited to small businesses who don't ask security questions
- Competitors: NetSuite (SOC 1 + SOC 2 Type II), Zoho (SOC 2 Type II + ISO 27001), Odoo.sh (SOC 2)

**SOC 2 Type I vs Type II:**
- Type I: "Your controls are designed correctly" (point-in-time snapshot)
- Type II: "Your controls worked correctly over 6-12 months" (continuous proof)
- You need Type I first, then work toward Type II

**What you need to do for SOC 2 readiness (3-6 months):**

1. **Immediate technical fixes:**
   - ✅ Enable HTTPS (TLS 1.3)
   - ✅ Implement MFA
   - ✅ Move secrets to a vault (not .env files) — use Docker secrets or AWS SSM
   - ✅ Enable encryption at rest (PostgreSQL TDE or full-disk encryption)
   - ✅ Set up centralized logging (not just files)
   - ✅ Implement access reviews and role management

2. **Operational controls:**
   - ✅ Write an Information Security Policy
   - ✅ Define change management process (code review, approval)
   - ✅ Document incident response plan
   - ✅ Background checks on team members with data access
   - ✅ Annual security awareness training
   - ✅ Vendor risk assessment for third-party services

3. **Technical monitoring:**
   - ✅ Intrusion detection / anomaly monitoring
   - ✅ Vulnerability scanning (SAST/DAST in CI/CD)
   - ✅ Dependency vulnerability scanning (npm audit)
   - ✅ Backup verification and disaster recovery testing

4. **Engage an auditor:**
   - Cost: $15,000-$50,000 for Type I
   - Timeline: 3-6 months of preparation + 4-6 week audit
   - Popular auditors for startups: Vanta, Drata, Secureframe (automate evidence collection)

**Honest take:** SOC 2 is NOT needed for your first 10 customers if they're small businesses. But it IS a hard blocker for any deal with a company >100 employees. Plan for it in Phase 3 (3-6 months out), not Phase 1.

---

## Summary: What Actually Matters RIGHT NOW

| Priority | Item | Real-world Impact |
|----------|------|-------------------|
| 🔴 P0 | Fix `resetPasswordDirect` (anyone can reset any password) | **Security vulnerability — exploitable today** |
| 🔴 P0 | Add HTTPS | Without this, no one should use the system with real data |
| 🟠 P1 | Fix 6 critical disconnected endpoints (inventory images, finance) | Users see broken features in core modules |
| 🟠 P1 | Add pagination to audit/chat/event-bus queries | System will crash under real usage |
| 🟡 P2 | Add MFA | Required for any business customer |
| 🟡 P2 | Add caching to high-frequency GET endpoints | Performance under load |
| 🟢 P3 | SOC 2 preparation | Needed for enterprise sales, not for first customers |
| 🟢 P3 | Load balancing | Needed when you have >50 concurrent users |
