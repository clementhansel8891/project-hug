# Deployment Guide

## Production Environment

| Resource | Value |
|----------|-------|
| VPS Host | `150.109.15.108` |
| Frontend URL | `http://150.109.15.108:3010` |
| Backend API | `http://150.109.15.108:3001` |
| Cockpit Panel | `http://150.109.15.108:9090` |
| Deploy Path | `/home/ubuntu/zenvix` |

For SSH credentials and environment secrets, see `vps_reference.md`.

## Auto-Deploy (CI/CD)

A cron job on the VPS polls the `main` branch every 5 minutes:

```
*/5 * * * * /home/ubuntu/zenvix/vps-auto-deploy.sh >> /home/ubuntu/zenvix/logs/cron.log 2>&1
```

The deploy script:
1. `git pull origin main`
2. `./vps-up.sh` → `docker compose up -d --build --remove-orphans`

**To deploy:** Simply push to `main`. Changes will be live within 5 minutes.

## Manual Deploy

```bash
# Connect to VPS
ssh -i "~/.ssh/vps_zenvix" ubuntu@150.109.15.108

# Navigate and deploy
cd /home/ubuntu/zenvix
git pull origin main
./vps-up.sh
```

## Docker Services

The `docker-compose.yml` defines three services:

### Frontend
- Builds from `Dockerfile` (multi-stage: Vite build → Nginx serve)
- Exposed on port `3010`
- Nginx config in `nginx.conf`

### Backend
- Builds from `backend/Dockerfile`
- Exposed on port `3001`
- Runs `npm run start:prod` (NestJS compiled output)
- Max memory: 8GB (`--max-old-space-size=8192`)

### Database
- PostgreSQL 16 (official image)
- Exposed on port `5433` externally (maps to `5432` internal)
- Data persisted via Docker volume

## Build Process

### Frontend Build
```bash
npm run build
# Output: dist/ directory served by Nginx
```

### Backend Build
```bash
cd backend
npm run build
# Output: dist/ directory (compiled NestJS)
```

## Environment Configuration

### Frontend (.env)
```env
VITE_API_URL=http://150.109.15.108:3001
```

### Backend (backend/.env)
```env
DATABASE_URL="postgresql://zenvix:zenvix_secure_2026!@db:5432/zenvix_prod?schema=public"
NODE_ENV=production
PORT=3001
PERSISTENCE_MODE=db
RUNTIME=docker
```

## Health Checks

| Check | Method |
|-------|--------|
| Frontend loading | Visit `http://150.109.15.108:3010` |
| API health | `curl http://150.109.15.108:3001/api/health` |
| Database | Connect via pgAdmin on port `5433` |
| Container status | `docker compose ps` on VPS |
| Logs | `docker compose logs -f backend` |

## Troubleshooting

### Containers not starting
```bash
docker compose down
docker compose up -d --build --remove-orphans
docker compose logs -f
```

### Database connection issues
```bash
docker compose exec db psql -U zenvix -d zenvix_prod
```

### Frontend not updating
```bash
docker compose build --no-cache frontend
docker compose up -d frontend
```

### Check deploy logs
```bash
cat /home/ubuntu/zenvix/logs/cron.log
```

## Rollback

```bash
# SSH into VPS
cd /home/ubuntu/zenvix
git log --oneline -5          # Find previous good commit
git reset --hard <commit>     # Reset to it
./vps-up.sh                   # Rebuild and deploy
```
