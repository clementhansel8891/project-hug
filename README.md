# Zenvix Business Flow Suite

Multi-tenant enterprise operations platform built for **Bambu Silver** — a retail jewelry business operating across multiple stores in Bali, Indonesia.

## Overview

Zenvix is a full-stack SaaS platform combining core business management (Finance, HR, Procurement, Inventory, Warehouse, Sales, Marketing, IT) with an industry-specific Retail Operations module. The platform runs as a Dockerized deployment on a VPS with PostgreSQL.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TypeScript, TailwindCSS, Shadcn UI, Radix |
| Backend | NestJS 11, Prisma ORM, PostgreSQL 16 |
| Infra | Docker Compose, Nginx reverse proxy, auto-deploy via cron |
| Auth | JWT-based, multi-tenant session with role-based access |

## Project Structure

```
├── src/                    # Frontend (React + Vite)
│   ├── core/               # Platform runtime, routing, security, services
│   ├── modules/            # Industry modules (retail)
│   ├── pages/              # All page components (core departments + retail)
│   ├── layouts/            # CoreLayout, ModuleLayout
│   ├── contexts/           # AuthContext, AppContext, NotificationContext
│   └── components/         # Shared UI components
├── backend/                # NestJS API server
│   ├── src/                # Source code (modules, services, controllers)
│   ├── database/           # SQL schema and migrations
│   └── prisma/             # Prisma schema and seeds
├── docker-compose.yml      # Full-stack Docker orchestration
├── nginx.conf              # Frontend serving + API proxy
└── vps_reference.md        # VPS connection and deployment secrets
```

## Client: Bambu Silver

- **Tenant ID:** `tnt-3rlhko`
- **Industry:** Retail (jewelry/silver)
- **Stores:** Double Six, Sahadewa, Seminyak, SS, Anchor
- **Users:** Management (owner, superadmin, admins) + SPG sales staff

## Module Configuration

This deployment is configured specifically for Bambu Silver:

- **Retail module** is always active (no activation toggle required)
- **Warehouse** is accessible under the Retail navigation tree
- **F&B/Cafe module** is disabled (not registered)
- All core departments (Finance, HR, Procurement, Inventory, IT, Sales, Marketing) remain accessible

## Quick Start (Local Development)

```bash
# Install dependencies
npm install
cd backend && npm install && cd ..

# Run both frontend and backend
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## Production Deployment

See `vps_reference.md` for VPS connection details and Docker configuration.

The production stack auto-deploys on push to `main` via cron-based polling:
1. VPS cron runs `vps-auto-deploy.sh` every 5 minutes
2. Script pulls latest from `main` branch
3. Triggers `docker compose up -d --build --remove-orphans`

### Manual Deploy

```bash
ssh -i "~/.ssh/vps_zenvix" ubuntu@150.109.15.108
cd /home/ubuntu/zenvix
git pull origin main
./vps-up.sh
```

## Environment Variables

Frontend requires:
```env
VITE_API_URL=http://<host>:3001
```

Backend requires (see `backend/.env.example`):
```env
DATABASE_URL=postgresql://<user>:<pass>@<host>:5432/<db>?schema=public
NODE_ENV=production
PORT=3001
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start frontend + backend concurrently |
| `npm run build` | Production frontend build |
| `npm run lint` | ESLint check |
| `npm run test` | Run Vitest tests |

## Ports (Production)

| Service | Port |
|---------|------|
| Frontend (Nginx) | 3010 |
| Backend API | 3001 |
| PostgreSQL | 5433 (external) → 5432 (internal) |
| Cockpit (VPS panel) | 9090 |
