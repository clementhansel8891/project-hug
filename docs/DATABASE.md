# Database Reference

## Connection Details

| Property | Value |
|----------|-------|
| Engine | PostgreSQL 16 |
| Host (internal) | `db` (Docker service name) |
| Host (external) | `150.109.15.108` |
| Port (internal) | `5432` |
| Port (external) | `5433` |
| Database | `zenvix_prod` |
| User | `zenvix` |
| Schema | `public` |

## ORM

Prisma 6.2.1 is used for schema management and database access.

- Schema file: `backend/prisma/schema.prisma`
- Migrations: `backend/database/` (SQL files)
- Seed: `backend/prisma/seed-production-ready.ts`

### Common Commands

```bash
# Generate Prisma client
cd backend && npx prisma generate

# Push schema to database (dev only)
npx prisma db push

# Open Prisma Studio (GUI browser)
npx prisma studio

# Run seed
npx prisma db seed
```

## Multi-Tenant Data Model

All business data is scoped by `tenant_id`. Core tables:

| Table | Purpose |
|-------|---------|
| `users` | User accounts (email, password hash) |
| `user_companies` | User-to-tenant association with role |
| `companies` | Tenant/company records |
| `locations` | Physical locations (stores, warehouses) |
| `departments` | Organizational departments |
| `staff` | Staff profiles linked to users |
| `shifts` | Shift records (open/close, cash reconciliation) |
| `transactions` | POS sale transactions |
| `products` | Product catalog |
| `inventory_items` | Stock levels per location |
| `purchase_requests` | Procurement requests |
| `purchase_orders` | Approved purchase orders |

## Bambu Silver Tenant Data

| Entity | Details |
|--------|---------|
| Tenant ID | `tnt-3rlhko` |
| Company | Bambu Silver |
| Stores | Double Six, Sahadewa, Seminyak, SS, Anchor |
| Users | ~10 (4 management + 6 SPG) |
| Industry | Retail (jewelry/silver) |

## Backup

Database backups can be taken via:

```bash
# SSH into VPS first
docker compose exec db pg_dump -U zenvix zenvix_prod > backup_$(date +%Y%m%d).sql
```

Restore:
```bash
docker compose exec -T db psql -U zenvix zenvix_prod < backup_file.sql
```

## Direct Query Access

```bash
# From VPS
docker compose exec db psql -U zenvix -d zenvix_prod

# From local machine (requires port 5433 accessible)
psql -h 150.109.15.108 -p 5433 -U zenvix -d zenvix_prod
```
