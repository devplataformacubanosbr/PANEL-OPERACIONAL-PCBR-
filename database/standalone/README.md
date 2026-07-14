# database/standalone

Standalone (single-tenant) schema + data migration for
DASHBOARDOperacional-PCBR, derived from the live Avante production
schema (project `rcqkmaxkuxllcyjzqbvn`) for organization
`b4a9f43d-2065-48f2-a5c7-f8c0feacc309` ("PLATAFORMA CUBANOS BR").
Nothing here has been applied to any database yet — review everything
first.

## Files

- **`001_schema.sql`** — full DDL: the 30 business tables you listed
  (all of Avante's business tables minus `organization_id`, minus
  SaaS-only tables) plus a new singleton table `configuracion_empresa`
  for branding. Includes
  PK/FK/CHECK constraints, a simple `USING (true)` RLS policy per
  table, extensions (`uuid-ossp`, `pgcrypto`), and an initial
  `configuracion_empresa` row with PCBR's real branding values.
- **`migrate_data.mjs`** — Node script (uses `@supabase/supabase-js`,
  already in `node_modules`) that reads business data for org
  `b4a9f43d-...` from Avante and writes it into the new project,
  paginating past Supabase's 1000-row limit and merging `clientes`'
  old `campos_personalizados` jsonb into the new dedicated columns.
  **Not executed** — read the credentials section at the top of the
  file before running it.

## Apply order

1. `npx supabase db query --linked -f database/standalone/001_schema.sql`
   from `DASHBOARDOperacional-PCBR` (already linked to `kxtshulqjkkgcrxhegiv`).
2. Fill in env vars and run `node database/standalone/migrate_data.mjs`
   (add `DRY_RUN=1` first to sanity-check counts without writing).
3. After data is loaded, bump every bigint identity sequence past the
   migrated max id (the script prints the exact `setval(...)`
   statements to run — it does not run them itself).
4. Manually re-upload the company logo (`logo_url` in
   `configuracion_empresa` currently still points at Avante's own
   storage bucket) to the new project's storage and update the row.
5. If you want `perfiles` populated, create the 5 matching users in
   the new project's `auth.users` first (script skips `perfiles`
   automatically because of that FK), then migrate it.

## Credentials / manual steps needed

- **Avante read side**: no service_role key available. Either get one,
  or set `AVANTE_SUPABASE_ANON_KEY` + `AVANTE_EMAIL`/`AVANTE_PASSWORD`
  for a real Avante user in org `b4a9f43d-...` (RLS requires an
  authenticated session to return any rows).
- **New project write side**: `NEW_SUPABASE_URL` +
  `NEW_SUPABASE_SERVICE_ROLE_KEY` for `kxtshulqjkkgcrxhegiv` (needed to
  bypass RLS and insert explicit ids so foreign keys survive).
- `historial_clientes.usuario_id` is a FK to `perfiles(id)`, and 100%
  of that table's rows for this org have it set. Since `perfiles` is
  skipped by default, the script auto-detects that and nulls out
  `usuario_id` on insert to avoid FK failures — re-run that one step
  after populating `perfiles` if you want the attribution preserved.
- See findings reported alongside this deliverable for schema
  discrepancies worth reviewing before applying anything (e.g.
  `configuraciones_app` unexpectedly had `organization_id` live even
  though the reference migration file didn't; some `clientes` date
  fields are free-text in Avante and needed format normalization;
  ~11 rarely-used `campos_personalizados` keys have no dedicated
  column and are logged to a report file instead of migrated).
