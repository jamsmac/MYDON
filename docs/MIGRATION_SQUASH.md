# Migration Squash Guide

This document describes how to squash multiple Drizzle migrations into a single consolidated migration.

## When to Squash

Consider squashing migrations when:
- There are 20+ migration files accumulating
- Many migrations are small incremental changes to the same tables
- Development migrations contain experimental changes that were later reverted
- Setting up fresh development environments takes too long

## Prerequisites

- Ensure all migrations have been applied to production
- Have a complete database backup before proceeding
- Coordinate with the team to avoid conflicts

## Squash Process

### Step 1: Backup Current State

```bash
# Export current database schema
mysqldump -u $DB_USER -p$DB_PASSWORD --no-data $DB_NAME > backup_schema.sql

# Backup migration files
cp -r drizzle/*.sql drizzle_backup/
```

### Step 2: Generate Fresh Schema SQL

Use Drizzle Kit to generate a fresh SQL from the current schema:

```bash
# Generate new SQL from schema.ts
npx drizzle-kit generate:mysql --config=drizzle.config.ts --out=drizzle_fresh
```

### Step 3: Create Single Migration File

```bash
# Remove old migration files (keep meta folder)
rm drizzle/0*.sql

# Copy fresh schema as 0000 migration
mv drizzle_fresh/0000_*.sql drizzle/0000_initial_schema.sql
```

### Step 4: Update Meta Journal

Edit `drizzle/meta/_journal.json` to reference only the new migration:

```json
{
  "version": "7",
  "dialect": "mysql",
  "entries": [
    {
      "idx": 0,
      "version": "7",
      "when": 1707264000000,
      "tag": "0000_initial_schema",
      "breakpoints": true
    }
  ]
}
```

### Step 5: Reset Migration Tracking in Database

For development databases, reset the migration tracking table:

```sql
-- WARNING: Only run on development databases!
TRUNCATE TABLE `__drizzle_migrations`;

-- Insert single record for squashed migration
INSERT INTO `__drizzle_migrations`
  (`id`, `hash`, `created_at`)
VALUES
  (1, '<hash_from_meta_snapshot>', NOW());
```

### Step 6: Verify

```bash
# Run drizzle-kit push to verify schema matches
npx drizzle-kit push:mysql

# Run tests
pnpm test
```

## For Production Environments

**Do NOT squash migrations in production.** Instead:

1. Keep historical migrations in a separate archive folder
2. Only squash in development branches
3. When deploying to a fresh production database, use the squashed migration
4. Existing production databases continue using the original migration history

## Migration File Naming

After squash, new migrations should continue from index 0001:

```
drizzle/
├── 0000_initial_schema.sql  # Squashed migration
├── 0001_add_new_feature.sql # New migration after squash
├── meta/
│   ├── _journal.json
│   └── 0000_snapshot.json
```

## Rollback Plan

If issues occur after squashing:

1. Restore migration files from backup:
   ```bash
   cp drizzle_backup/*.sql drizzle/
   ```

2. Restore meta journal from backup
3. Re-run migrations if database was affected

## Recommended Schedule

- Squash migrations quarterly in development
- Before major releases
- When migration count exceeds 30 files

## Notes

- Always test the squash process on a development database first
- Run full test suite after squashing to verify schema integrity
- Document the squash date in your project changelog
