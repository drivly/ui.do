# GraphDL on ClickHouse + Cloudflare — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite graphdl-orm as a Cloudflare Worker backed by `@dotdo/db` (Durable Object + ClickHouse), replacing Payload CMS + MongoDB + Fly.io.

**Architecture:** GraphDL DO extends `@dotdo/db`'s `DB` class with 3NF metamodel tables in SQLite. A REST API layer matches Payload's `/api/:collection` pattern so the apis worker proxy needs minimal changes. Claims ingestion is ported from Payload to direct DO calls.

**Tech Stack:** Cloudflare Workers, Durable Objects, `@dotdo/db` (git submodule), TypeScript, itty-router, vitest.

---

## Task 1: Project Scaffold

**Goal:** Create the new Cloudflare Worker project with `@dotdo/db` as a git submodule.

**Files:**
- Create: `C:\Users\lippe\Repos\graphdl-orm\package.json`
- Create: `C:\Users\lippe\Repos\graphdl-orm\wrangler.jsonc`
- Create: `C:\Users\lippe\Repos\graphdl-orm\tsconfig.json`
- Create: `C:\Users\lippe\Repos\graphdl-orm\vitest.config.ts`
- Create: `C:\Users\lippe\Repos\graphdl-orm\src\index.ts` (stub)

**Step 1: Prepare the repo**

The existing graphdl-orm has Payload/Next.js code. Create a fresh branch and clear it:

```bash
cd /c/Users/lippe/Repos/graphdl-orm
git checkout -b feat/clickhouse-rewrite
# Preserve readings/ directory — it's the source of truth
mkdir -p /tmp/graphdl-readings-backup
cp -r readings/ /tmp/graphdl-readings-backup/
# Remove everything except .git and readings
git rm -rf src/ scripts/ domains/ public/ .eslintrc* next* Dockerfile fly.toml 2>/dev/null || true
rm -rf node_modules/ .next/ package.json tsconfig.json package-lock.json yarn.lock
# Restore readings
cp -r /tmp/graphdl-readings-backup/readings/ ./readings/
```

**Step 2: Add @dotdo/db as git submodule**

```bash
cd /c/Users/lippe/Repos/graphdl-orm
git submodule add https://github.com/dot-do/db.git .do/db
```

**Step 3: Create package.json**

```json
{
  "name": "graphdl-orm",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@dotdo/db": "file:.do/db",
    "itty-router": "^5.0.22"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20250124.0",
    "typescript": "^5.7.2",
    "vitest": "^4.0.18",
    "wrangler": "^4.0.0"
  }
}
```

**Step 4: Create wrangler.jsonc**

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "graphdl-orm",
  "main": "src/index.ts",
  "compatibility_date": "2025-01-01",
  "durable_objects": {
    "bindings": [
      {
        "name": "GRAPHDL_DB",
        "class_name": "GraphDLDB"
      }
    ]
  },
  "migrations": [
    {
      "tag": "v1",
      "new_sqlite_classes": ["GraphDLDB"]
    }
  ],
  "vars": {
    "ENVIRONMENT": "production"
  }
}
```

**Step 5: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "declaration": true,
    "paths": {
      "@/*": ["./src/*"],
      "@dotdo/db": ["./.do/db/src/index.ts"],
      "@dotdo/db/*": ["./.do/db/src/*"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", ".do"]
}
```

**Step 6: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': './src',
    },
  },
})
```

**Step 7: Create stub entry point**

Create `src/index.ts`:

```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return new Response(JSON.stringify({ status: 'ok', version: '0.1.0' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  },
}

export interface Env {
  GRAPHDL_DB: DurableObjectNamespace
  ENVIRONMENT: string
}
```

**Step 8: Install deps and verify**

```bash
cd /c/Users/lippe/Repos/graphdl-orm
yarn install
yarn typecheck
```

Expected: No errors.

**Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold graphdl-orm as Cloudflare Worker with @dotdo/db submodule"
```

---

## Task 2: GraphDL DO — Metamodel Schema

**Goal:** Extend `@dotdo/db`'s `DB` class with 3NF tables for the core metamodel: domains, organizations, org-memberships, nouns, graph-schemas, readings, roles, constraints, constraint-spans.

**Files:**
- Create: `src/do.ts`
- Create: `src/schema/metamodel.ts`
- Test: `src/schema/metamodel.test.ts`

**Step 1: Write the failing test**

Create `src/schema/metamodel.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { METAMODEL_DDL } from './metamodel'

describe('metamodel DDL', () => {
  it('exports DDL statements as an array of strings', () => {
    expect(Array.isArray(METAMODEL_DDL)).toBe(true)
    expect(METAMODEL_DDL.length).toBeGreaterThan(0)
  })

  it('includes CREATE TABLE for all core metamodel tables', () => {
    const joined = METAMODEL_DDL.join('\n')
    const expectedTables = [
      'organizations', 'org_memberships', 'domains', 'nouns',
      'graph_schemas', 'readings', 'roles', 'constraints', 'constraint_spans',
    ]
    for (const table of expectedTables) {
      expect(joined).toContain(`CREATE TABLE IF NOT EXISTS ${table}`)
    }
  })

  it('includes CREATE INDEX statements', () => {
    const joined = METAMODEL_DDL.join('\n')
    expect(joined).toContain('CREATE INDEX')
  })
})
```

**Step 2: Run test to verify it fails**

```bash
cd /c/Users/lippe/Repos/graphdl-orm
yarn test src/schema/metamodel.test.ts
```

Expected: FAIL — module not found.

**Step 3: Write the metamodel DDL**

Create `src/schema/metamodel.ts`:

```typescript
/**
 * 3NF DDL for the GraphDL core metamodel.
 *
 * Derived from FORML2 readings in readings/core.md + readings/organizations.md.
 * These tables live in the GraphDL DO's SQLite database.
 *
 * Conventions:
 * - Snake_case table and column names
 * - id TEXT PRIMARY KEY (generated by @dotdo/db's generateEntityId)
 * - Foreign keys as _id suffixes
 * - created_at / updated_at timestamps on every table
 * - version INTEGER for optimistic concurrency
 */
export const METAMODEL_DDL: string[] = [
  // ── Organizations & Access Control ──────────────────────────────────
  `CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    version INTEGER NOT NULL DEFAULT 1
  )`,

  `CREATE TABLE IF NOT EXISTS org_memberships (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    version INTEGER NOT NULL DEFAULT 1,
    UNIQUE(user_email, organization_id)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_org_memberships_email ON org_memberships(user_email)`,
  `CREATE INDEX IF NOT EXISTS idx_org_memberships_org ON org_memberships(organization_id)`,

  `CREATE TABLE IF NOT EXISTS domains (
    id TEXT PRIMARY KEY,
    domain_slug TEXT NOT NULL UNIQUE,
    name TEXT,
    organization_id TEXT REFERENCES organizations(id),
    visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    version INTEGER NOT NULL DEFAULT 1
  )`,

  `CREATE INDEX IF NOT EXISTS idx_domains_org ON domains(organization_id)`,
  `CREATE INDEX IF NOT EXISTS idx_domains_slug ON domains(domain_slug)`,

  // ── Core Metamodel ──────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS nouns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    object_type TEXT NOT NULL DEFAULT 'entity' CHECK (object_type IN ('entity', 'value')),
    domain_id TEXT REFERENCES domains(id),
    super_type_id TEXT REFERENCES nouns(id),
    plural TEXT,
    value_type TEXT,
    format TEXT,
    enum_values TEXT,
    minimum REAL,
    maximum REAL,
    pattern TEXT,
    prompt_text TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    version INTEGER NOT NULL DEFAULT 1
  )`,

  `CREATE INDEX IF NOT EXISTS idx_nouns_domain ON nouns(domain_id)`,
  `CREATE INDEX IF NOT EXISTS idx_nouns_name_domain ON nouns(name, domain_id)`,

  `CREATE TABLE IF NOT EXISTS graph_schemas (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    title TEXT,
    domain_id TEXT REFERENCES domains(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    version INTEGER NOT NULL DEFAULT 1
  )`,

  `CREATE INDEX IF NOT EXISTS idx_graph_schemas_domain ON graph_schemas(domain_id)`,

  `CREATE TABLE IF NOT EXISTS readings (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    graph_schema_id TEXT REFERENCES graph_schemas(id),
    domain_id TEXT REFERENCES domains(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    version INTEGER NOT NULL DEFAULT 1
  )`,

  `CREATE INDEX IF NOT EXISTS idx_readings_domain ON readings(domain_id)`,
  `CREATE INDEX IF NOT EXISTS idx_readings_schema ON readings(graph_schema_id)`,
  `CREATE INDEX IF NOT EXISTS idx_readings_text_domain ON readings(text, domain_id)`,

  `CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    reading_id TEXT REFERENCES readings(id),
    noun_id TEXT REFERENCES nouns(id),
    graph_schema_id TEXT REFERENCES graph_schemas(id),
    role_index INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    version INTEGER NOT NULL DEFAULT 1
  )`,

  `CREATE INDEX IF NOT EXISTS idx_roles_reading ON roles(reading_id)`,
  `CREATE INDEX IF NOT EXISTS idx_roles_schema ON roles(graph_schema_id)`,

  `CREATE TABLE IF NOT EXISTS constraints (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('UC', 'MC', 'SS', 'XC', 'EQ', 'OR', 'XO')),
    modality TEXT NOT NULL DEFAULT 'Alethic' CHECK (modality IN ('Alethic', 'Deontic')),
    domain_id TEXT REFERENCES domains(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    version INTEGER NOT NULL DEFAULT 1
  )`,

  `CREATE INDEX IF NOT EXISTS idx_constraints_domain ON constraints(domain_id)`,

  `CREATE TABLE IF NOT EXISTS constraint_spans (
    id TEXT PRIMARY KEY,
    constraint_id TEXT NOT NULL REFERENCES constraints(id),
    role_id TEXT NOT NULL REFERENCES roles(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    version INTEGER NOT NULL DEFAULT 1
  )`,

  `CREATE INDEX IF NOT EXISTS idx_constraint_spans_constraint ON constraint_spans(constraint_id)`,
  `CREATE INDEX IF NOT EXISTS idx_constraint_spans_role ON constraint_spans(role_id)`,
]
```

**Step 4: Run test to verify it passes**

```bash
yarn test src/schema/metamodel.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/schema/metamodel.ts src/schema/metamodel.test.ts
git commit -m "feat: 3NF DDL for core metamodel tables"
```

---

## Task 3: GraphDL DO — State Machine & Instance Schema

**Goal:** Add 3NF tables for state machine definitions (statuses, transitions, guards, event types, verbs, functions) and runtime instances (state machines, events, graphs, resources, resource-roles, guard-runs).

**Files:**
- Create: `src/schema/state.ts`
- Create: `src/schema/instances.ts`
- Create: `src/schema/index.ts`
- Test: `src/schema/state.test.ts`
- Test: `src/schema/instances.test.ts`

**Step 1: Write the failing tests**

Create `src/schema/state.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { STATE_DDL } from './state'

describe('state machine DDL', () => {
  it('exports DDL statements', () => {
    expect(Array.isArray(STATE_DDL)).toBe(true)
    expect(STATE_DDL.length).toBeGreaterThan(0)
  })

  it('includes all state machine tables', () => {
    const joined = STATE_DDL.join('\n')
    const expectedTables = [
      'state_machine_definitions', 'statuses', 'transitions',
      'guards', 'event_types', 'verbs', 'functions', 'streams',
    ]
    for (const table of expectedTables) {
      expect(joined).toContain(`CREATE TABLE IF NOT EXISTS ${table}`)
    }
  })
})
```

Create `src/schema/instances.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { INSTANCE_DDL } from './instances'

describe('instance DDL', () => {
  it('exports DDL statements', () => {
    expect(Array.isArray(INSTANCE_DDL)).toBe(true)
    expect(INSTANCE_DDL.length).toBeGreaterThan(0)
  })

  it('includes all runtime instance tables', () => {
    const joined = INSTANCE_DDL.join('\n')
    const expectedTables = [
      'graphs', 'resources', 'resource_roles',
      'state_machines', 'events', 'guard_runs',
    ]
    for (const table of expectedTables) {
      expect(joined).toContain(`CREATE TABLE IF NOT EXISTS ${table}`)
    }
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
yarn test src/schema/
```

Expected: FAIL — modules not found.

**Step 3: Write the state DDL**

Create `src/schema/state.ts`:

```typescript
/**
 * 3NF DDL for state machine behavioral entities.
 * Derived from readings/state.md + readings/core.md.
 */
export const STATE_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS state_machine_definitions (
    id TEXT PRIMARY KEY,
    title TEXT,
    noun_id TEXT REFERENCES nouns(id),
    domain_id TEXT REFERENCES domains(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    version INTEGER NOT NULL DEFAULT 1
  )`,

  `CREATE INDEX IF NOT EXISTS idx_smd_domain ON state_machine_definitions(domain_id)`,
  `CREATE INDEX IF NOT EXISTS idx_smd_noun ON state_machine_definitions(noun_id)`,

  `CREATE TABLE IF NOT EXISTS statuses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    state_machine_definition_id TEXT NOT NULL REFERENCES state_machine_definitions(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    version INTEGER NOT NULL DEFAULT 1
  )`,

  `CREATE INDEX IF NOT EXISTS idx_statuses_smd ON statuses(state_machine_definition_id)`,

  `CREATE TABLE IF NOT EXISTS event_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    domain_id TEXT REFERENCES domains(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    version INTEGER NOT NULL DEFAULT 1
  )`,

  `CREATE INDEX IF NOT EXISTS idx_event_types_domain ON event_types(domain_id)`,

  `CREATE TABLE IF NOT EXISTS transitions (
    id TEXT PRIMARY KEY,
    from_status_id TEXT NOT NULL REFERENCES statuses(id),
    to_status_id TEXT NOT NULL REFERENCES statuses(id),
    event_type_id TEXT REFERENCES event_types(id),
    verb_id TEXT REFERENCES verbs(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    version INTEGER NOT NULL DEFAULT 1
  )`,

  `CREATE INDEX IF NOT EXISTS idx_transitions_from ON transitions(from_status_id)`,
  `CREATE INDEX IF NOT EXISTS idx_transitions_to ON transitions(to_status_id)`,

  `CREATE TABLE IF NOT EXISTS guards (
    id TEXT PRIMARY KEY,
    name TEXT,
    transition_id TEXT REFERENCES transitions(id),
    graph_schema_id TEXT REFERENCES graph_schemas(id),
    domain_id TEXT REFERENCES domains(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    version INTEGER NOT NULL DEFAULT 1
  )`,

  `CREATE INDEX IF NOT EXISTS idx_guards_transition ON guards(transition_id)`,

  `CREATE TABLE IF NOT EXISTS verbs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status_id TEXT REFERENCES statuses(id),
    transition_id TEXT REFERENCES transitions(id),
    graph_id TEXT REFERENCES graphs(id),
    domain_id TEXT REFERENCES domains(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    version INTEGER NOT NULL DEFAULT 1
  )`,

  `CREATE INDEX IF NOT EXISTS idx_verbs_domain ON verbs(domain_id)`,

  `CREATE TABLE IF NOT EXISTS functions (
    id TEXT PRIMARY KEY,
    name TEXT,
    callback_url TEXT,
    http_method TEXT DEFAULT 'POST',
    verb_id TEXT REFERENCES verbs(id),
    domain_id TEXT REFERENCES domains(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    version INTEGER NOT NULL DEFAULT 1
  )`,

  `CREATE INDEX IF NOT EXISTS idx_functions_verb ON functions(verb_id)`,

  `CREATE TABLE IF NOT EXISTS streams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    domain_id TEXT REFERENCES domains(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    version INTEGER NOT NULL DEFAULT 1
  )`,
]
```

Create `src/schema/instances.ts`:

```typescript
/**
 * 3NF DDL for runtime instance entities.
 * Derived from readings/instances.md.
 */
export const INSTANCE_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS graphs (
    id TEXT PRIMARY KEY,
    graph_schema_id TEXT REFERENCES graph_schemas(id),
    domain_id TEXT REFERENCES domains(id),
    is_done INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    version INTEGER NOT NULL DEFAULT 1
  )`,

  `CREATE INDEX IF NOT EXISTS idx_graphs_domain ON graphs(domain_id)`,
  `CREATE INDEX IF NOT EXISTS idx_graphs_schema ON graphs(graph_schema_id)`,

  `CREATE TABLE IF NOT EXISTS resources (
    id TEXT PRIMARY KEY,
    noun_id TEXT REFERENCES nouns(id),
    reference TEXT,
    value TEXT,
    domain_id TEXT REFERENCES domains(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    version INTEGER NOT NULL DEFAULT 1
  )`,

  `CREATE INDEX IF NOT EXISTS idx_resources_domain ON resources(domain_id)`,
  `CREATE INDEX IF NOT EXISTS idx_resources_noun ON resources(noun_id)`,

  `CREATE TABLE IF NOT EXISTS resource_roles (
    id TEXT PRIMARY KEY,
    graph_id TEXT NOT NULL REFERENCES graphs(id),
    resource_id TEXT NOT NULL REFERENCES resources(id),
    role_id TEXT NOT NULL REFERENCES roles(id),
    domain_id TEXT REFERENCES domains(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    version INTEGER NOT NULL DEFAULT 1,
    UNIQUE(graph_id, role_id)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_resource_roles_graph ON resource_roles(graph_id)`,

  `CREATE TABLE IF NOT EXISTS state_machines (
    id TEXT PRIMARY KEY,
    name TEXT,
    state_machine_definition_id TEXT REFERENCES state_machine_definitions(id),
    current_status_id TEXT REFERENCES statuses(id),
    resource_id TEXT REFERENCES resources(id),
    domain_id TEXT REFERENCES domains(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    version INTEGER NOT NULL DEFAULT 1
  )`,

  `CREATE INDEX IF NOT EXISTS idx_state_machines_domain ON state_machines(domain_id)`,
  `CREATE INDEX IF NOT EXISTS idx_state_machines_definition ON state_machines(state_machine_definition_id)`,

  `CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    event_type_id TEXT REFERENCES event_types(id),
    state_machine_id TEXT REFERENCES state_machines(id),
    graph_id TEXT REFERENCES graphs(id),
    data TEXT,
    occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    version INTEGER NOT NULL DEFAULT 1
  )`,

  `CREATE INDEX IF NOT EXISTS idx_events_state_machine ON events(state_machine_id)`,
  `CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type_id)`,

  `CREATE TABLE IF NOT EXISTS guard_runs (
    id TEXT PRIMARY KEY,
    name TEXT,
    guard_id TEXT REFERENCES guards(id),
    graph_id TEXT REFERENCES graphs(id),
    result INTEGER,
    domain_id TEXT REFERENCES domains(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    version INTEGER NOT NULL DEFAULT 1
  )`,

  `CREATE INDEX IF NOT EXISTS idx_guard_runs_guard ON guard_runs(guard_id)`,
]
```

Create `src/schema/index.ts`:

```typescript
export { METAMODEL_DDL } from './metamodel'
export { STATE_DDL } from './state'
export { INSTANCE_DDL } from './instances'

import { METAMODEL_DDL } from './metamodel'
import { STATE_DDL } from './state'
import { INSTANCE_DDL } from './instances'

/** All DDL statements in dependency order. */
export const ALL_DDL: string[] = [
  ...METAMODEL_DDL,
  ...STATE_DDL,
  ...INSTANCE_DDL,
]
```

**Step 4: Run tests**

```bash
yarn test src/schema/
```

Expected: PASS (all 3 test files)

**Step 5: Commit**

```bash
git add src/schema/
git commit -m "feat: 3NF DDL for state machine and instance tables"
```

---

## Task 4: GraphDL Durable Object

**Goal:** Create the `GraphDLDB` DO class that extends `@dotdo/db`'s `DB`, overrides `initTables()` with the 3NF metamodel DDL, and provides typed collection access.

**Files:**
- Create: `src/do.ts`
- Create: `src/collections.ts`
- Modify: `src/index.ts` — export the DO class

**Step 1: Write the failing test**

Create `src/do.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { COLLECTION_TABLE_MAP, COLLECTION_SLUGS } from './collections'

describe('collections', () => {
  it('maps all Payload collection slugs to table names', () => {
    expect(COLLECTION_TABLE_MAP['nouns']).toBe('nouns')
    expect(COLLECTION_TABLE_MAP['graph-schemas']).toBe('graph_schemas')
    expect(COLLECTION_TABLE_MAP['readings']).toBe('readings')
    expect(COLLECTION_TABLE_MAP['constraint-spans']).toBe('constraint_spans')
    expect(COLLECTION_TABLE_MAP['state-machine-definitions']).toBe('state_machine_definitions')
    expect(COLLECTION_TABLE_MAP['state-machines']).toBe('state_machines')
    expect(COLLECTION_TABLE_MAP['resource-roles']).toBe('resource_roles')
    expect(COLLECTION_TABLE_MAP['event-types']).toBe('event_types')
    expect(COLLECTION_TABLE_MAP['guard-runs']).toBe('guard_runs')
    expect(COLLECTION_TABLE_MAP['org-memberships']).toBe('org_memberships')
  })

  it('lists all collection slugs', () => {
    expect(COLLECTION_SLUGS.length).toBeGreaterThanOrEqual(24)
    expect(COLLECTION_SLUGS).toContain('nouns')
    expect(COLLECTION_SLUGS).toContain('graph-schemas')
    expect(COLLECTION_SLUGS).toContain('domains')
  })
})
```

**Step 2: Run test to verify it fails**

```bash
yarn test src/do.test.ts
```

**Step 3: Write the collection mapping**

Create `src/collections.ts`:

```typescript
/**
 * Maps Payload CMS collection slugs (kebab-case) to SQLite table names (snake_case).
 *
 * The apis worker rawProxy uses Payload slugs in /graphdl/raw/<slug> URLs.
 * This map translates them to our 3NF table names.
 */
export const COLLECTION_TABLE_MAP: Record<string, string> = {
  // Organizations & access
  'organizations': 'organizations',
  'org-memberships': 'org_memberships',
  'domains': 'domains',

  // Core metamodel
  'nouns': 'nouns',
  'graph-schemas': 'graph_schemas',
  'readings': 'readings',
  'roles': 'roles',
  'constraints': 'constraints',
  'constraint-spans': 'constraint_spans',

  // State machine definitions
  'state-machine-definitions': 'state_machine_definitions',
  'statuses': 'statuses',
  'transitions': 'transitions',
  'guards': 'guards',
  'event-types': 'event_types',
  'verbs': 'verbs',
  'functions': 'functions',
  'streams': 'streams',

  // Runtime instances
  'graphs': 'graphs',
  'resources': 'resources',
  'resource-roles': 'resource_roles',
  'state-machines': 'state_machines',
  'events': 'events',
  'guard-runs': 'guard_runs',
}

/** All supported Payload collection slugs. */
export const COLLECTION_SLUGS = Object.keys(COLLECTION_TABLE_MAP)

/** Instance collections — scoped per-domain. */
export const INSTANCE_COLLECTIONS = new Set([
  'graphs', 'resources', 'resource-roles',
  'state-machines', 'events', 'guard-runs',
])

/**
 * Column mapping per table. Maps Payload field names to SQLite column names.
 * Only fields that differ from identity mapping need entries.
 */
export const FIELD_MAP: Record<string, Record<string, string>> = {
  nouns: { domain: 'domain_id', superType: 'super_type_id', objectType: 'object_type', promptText: 'prompt_text', enumValues: 'enum_values', valueType: 'value_type' },
  graph_schemas: { domain: 'domain_id' },
  readings: { domain: 'domain_id', graphSchema: 'graph_schema_id' },
  roles: { reading: 'reading_id', noun: 'noun_id', graphSchema: 'graph_schema_id', roleIndex: 'role_index' },
  constraints: { domain: 'domain_id' },
  constraint_spans: { constraint: 'constraint_id', role: 'role_id' },
  domains: { domainSlug: 'domain_slug', organization: 'organization_id' },
  organizations: {},
  org_memberships: { organization: 'organization_id', userEmail: 'user_email' },
  state_machine_definitions: { domain: 'domain_id', noun: 'noun_id' },
  statuses: { stateMachineDefinition: 'state_machine_definition_id' },
  transitions: { from: 'from_status_id', to: 'to_status_id', eventType: 'event_type_id', verb: 'verb_id' },
  guards: { transition: 'transition_id', graphSchema: 'graph_schema_id', domain: 'domain_id' },
  event_types: { domain: 'domain_id' },
  verbs: { status: 'status_id', transition: 'transition_id', graph: 'graph_id', domain: 'domain_id' },
  functions: { callbackUrl: 'callback_url', httpMethod: 'http_method', verb: 'verb_id', domain: 'domain_id' },
  streams: { domain: 'domain_id' },
  graphs: { graphSchema: 'graph_schema_id', domain: 'domain_id', isDone: 'is_done' },
  resources: { noun: 'noun_id', domain: 'domain_id' },
  resource_roles: { graph: 'graph_id', resource: 'resource_id', role: 'role_id', domain: 'domain_id' },
  state_machines: { stateMachineDefinition: 'state_machine_definition_id', currentStatus: 'current_status_id', resource: 'resource_id', domain: 'domain_id' },
  events: { eventType: 'event_type_id', stateMachine: 'state_machine_id', graph: 'graph_id', occurredAt: 'occurred_at' },
  guard_runs: { guard: 'guard_id', graph: 'graph_id', domain: 'domain_id' },
}
```

**Step 4: Write the GraphDL DO**

Create `src/do.ts`:

```typescript
/**
 * GraphDL Durable Object — extends @dotdo/db's DB class.
 *
 * Overrides initTables() with 3NF metamodel DDL instead of the generic entities table.
 * Provides Payload-compatible collection access via typed SQL queries.
 */
import { DB } from '@dotdo/db'
import type { DBEnv } from '@dotdo/db'
import { ALL_DDL } from './schema/index'
import { COLLECTION_TABLE_MAP, FIELD_MAP } from './collections'
import { generateEntityId } from '@dotdo/db'

export interface GraphDLEnv extends DBEnv {
  ENVIRONMENT?: string
}

export class GraphDLDB extends DB {
  /**
   * Override initTables to create 3NF metamodel tables
   * instead of the generic entities table.
   */
  protected override initTables(): void {
    // Create the metadata table (needed by base DB class)
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `)

    // Create the CDC events table (needed by base DB class)
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS events_log (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        operation TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        data TEXT,
        checksum TEXT
      )
    `)
    this.sql.exec('CREATE INDEX IF NOT EXISTS idx_events_log_entity ON events_log(entity_type, entity_id)')
    this.sql.exec('CREATE INDEX IF NOT EXISTS idx_events_log_timestamp ON events_log(timestamp)')

    // Create all 3NF metamodel tables
    for (const ddl of ALL_DDL) {
      this.sql.exec(ddl)
    }
  }

  // ── Typed Collection Access ────────────────────────────────────────

  /**
   * Find records in a collection.
   * Translates Payload-style where clauses to SQL.
   */
  async findInCollection(
    collectionSlug: string,
    where?: Record<string, any>,
    options?: { limit?: number; offset?: number; sort?: string; depth?: number },
  ): Promise<{ docs: Record<string, any>[]; totalDocs: number; hasNextPage: boolean }> {
    const table = COLLECTION_TABLE_MAP[collectionSlug]
    if (!table) throw new Error(`Unknown collection: ${collectionSlug}`)

    const fieldMap = FIELD_MAP[table] || {}

    // Build WHERE clause from Payload-style filters
    const { clause, params } = buildWhereClause(where || {}, fieldMap)
    const whereStr = clause ? `WHERE ${clause}` : ''

    // Count total
    const countRows = this.sql.exec(`SELECT COUNT(*) as cnt FROM ${table} ${whereStr}`, ...params).toArray()
    const totalDocs = (countRows[0]?.cnt as number) ?? 0

    // Sort
    const limit = options?.limit ?? 100
    const offset = options?.offset ?? 0
    const sortCol = options?.sort ? mapFieldName(options.sort.replace('-', ''), fieldMap) : 'created_at'
    const sortDir = options?.sort?.startsWith('-') ? 'DESC' : 'ASC'

    // Query
    const rows = this.sql.exec(
      `SELECT * FROM ${table} ${whereStr} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
      ...params, limit, offset,
    ).toArray()

    // Map back to Payload field names
    const reverseMap = buildReverseMap(fieldMap)
    const docs = rows.map(row => mapRowToDoc(row, reverseMap))

    return { docs, totalDocs, hasNextPage: offset + limit < totalDocs }
  }

  /**
   * Get a single record by ID.
   */
  async getFromCollection(collectionSlug: string, id: string): Promise<Record<string, any> | null> {
    const table = COLLECTION_TABLE_MAP[collectionSlug]
    if (!table) throw new Error(`Unknown collection: ${collectionSlug}`)

    const rows = this.sql.exec(`SELECT * FROM ${table} WHERE id = ?`, id).toArray()
    if (rows.length === 0) return null

    const reverseMap = buildReverseMap(FIELD_MAP[table] || {})
    return mapRowToDoc(rows[0], reverseMap)
  }

  /**
   * Create a record in a collection.
   */
  async createInCollection(collectionSlug: string, data: Record<string, any>): Promise<Record<string, any>> {
    const table = COLLECTION_TABLE_MAP[collectionSlug]
    if (!table) throw new Error(`Unknown collection: ${collectionSlug}`)

    const fieldMap = FIELD_MAP[table] || {}
    const id = data.id || generateEntityId(collectionSlug)
    const now = new Date().toISOString()

    // Map Payload field names to SQL column names
    const mapped: Record<string, any> = { id, created_at: now, updated_at: now, version: 1 }
    for (const [key, value] of Object.entries(data)) {
      if (key === 'id' || key === 'createdAt' || key === 'updatedAt') continue
      const col = fieldMap[key] || key
      // Handle Payload polymorphic relation { relationTo, value }
      if (typeof value === 'object' && value !== null && 'value' in value && 'relationTo' in value) {
        mapped[col] = value.value
      } else {
        mapped[col] = value
      }
    }

    const cols = Object.keys(mapped)
    const placeholders = cols.map(() => '?').join(', ')
    const values = cols.map(c => mapped[c])

    this.sql.exec(
      `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`,
      ...values,
    )

    return this.getFromCollection(collectionSlug, id) as Promise<Record<string, any>>
  }

  /**
   * Update a record in a collection.
   */
  async updateInCollection(collectionSlug: string, id: string, data: Record<string, any>): Promise<Record<string, any> | null> {
    const table = COLLECTION_TABLE_MAP[collectionSlug]
    if (!table) throw new Error(`Unknown collection: ${collectionSlug}`)

    const fieldMap = FIELD_MAP[table] || {}
    const now = new Date().toISOString()

    const sets: string[] = ['updated_at = ?']
    const values: any[] = [now]

    for (const [key, value] of Object.entries(data)) {
      if (key === 'id' || key === 'createdAt' || key === 'updatedAt') continue
      const col = fieldMap[key] || key
      if (typeof value === 'object' && value !== null && 'value' in value && 'relationTo' in value) {
        sets.push(`${col} = ?`)
        values.push(value.value)
      } else {
        sets.push(`${col} = ?`)
        values.push(value)
      }
    }

    // Increment version
    sets.push('version = version + 1')

    this.sql.exec(
      `UPDATE ${table} SET ${sets.join(', ')} WHERE id = ?`,
      ...values, id,
    )

    return this.getFromCollection(collectionSlug, id)
  }

  /**
   * Delete a record from a collection.
   */
  async deleteFromCollection(collectionSlug: string, id: string): Promise<boolean> {
    const table = COLLECTION_TABLE_MAP[collectionSlug]
    if (!table) throw new Error(`Unknown collection: ${collectionSlug}`)

    this.sql.exec(`DELETE FROM ${table} WHERE id = ?`, id)
    const changes = this.sql.exec('SELECT changes() as cnt').toArray()
    return ((changes[0]?.cnt as number) ?? 0) > 0
  }
}

// ── SQL Helpers ────────────────────────────────────────────────────────

/** Build a SQL WHERE clause from Payload-style where object. */
function buildWhereClause(
  where: Record<string, any>,
  fieldMap: Record<string, string>,
): { clause: string; params: any[] } {
  const conditions: string[] = []
  const params: any[] = []

  if (where.and) {
    const subs = (where.and as any[]).map(sub => buildWhereClause(sub, fieldMap))
    const clauses = subs.filter(s => s.clause).map(s => `(${s.clause})`)
    if (clauses.length) conditions.push(clauses.join(' AND '))
    for (const sub of subs) params.push(...sub.params)
    // Also process remaining keys
  }

  if (where.or) {
    const subs = (where.or as any[]).map(sub => buildWhereClause(sub, fieldMap))
    const clauses = subs.filter(s => s.clause).map(s => `(${s.clause})`)
    if (clauses.length) conditions.push(`(${clauses.join(' OR ')})`)
    for (const sub of subs) params.push(...sub.params)
  }

  for (const [key, condition] of Object.entries(where)) {
    if (key === 'and' || key === 'or') continue

    // Handle dot notation for relationship fields (e.g., domain.organization)
    // These need a subquery or join — for now, skip deep relationship queries
    if (key.includes('.')) continue

    const col = mapFieldName(key, fieldMap)

    if (typeof condition === 'object' && condition !== null) {
      if ('equals' in condition) {
        conditions.push(`${col} = ?`)
        params.push(condition.equals)
      } else if ('not_equals' in condition) {
        conditions.push(`${col} != ?`)
        params.push(condition.not_equals)
      } else if ('in' in condition && Array.isArray(condition.in)) {
        const placeholders = condition.in.map(() => '?').join(', ')
        conditions.push(`${col} IN (${placeholders})`)
        params.push(...condition.in)
      } else if ('like' in condition) {
        conditions.push(`${col} LIKE ?`)
        params.push(condition.like)
      } else if ('exists' in condition) {
        conditions.push(condition.exists ? `${col} IS NOT NULL` : `${col} IS NULL`)
      }
      // Handle Payload's nested relation value
      if ('value' in condition && Object.keys(condition).length === 1) {
        conditions.push(`${col} = ?`)
        params.push(condition.value)
      }
    } else {
      // Direct equality
      conditions.push(`${col} = ?`)
      params.push(condition)
    }
  }

  return { clause: conditions.join(' AND '), params }
}

function mapFieldName(field: string, fieldMap: Record<string, string>): string {
  return fieldMap[field] || field
}

function buildReverseMap(fieldMap: Record<string, string>): Record<string, string> {
  const reverse: Record<string, string> = {}
  for (const [payloadName, sqlName] of Object.entries(fieldMap)) {
    reverse[sqlName] = payloadName
  }
  return reverse
}

function mapRowToDoc(row: Record<string, unknown>, reverseMap: Record<string, string>): Record<string, any> {
  const doc: Record<string, any> = {}
  for (const [col, value] of Object.entries(row)) {
    if (col === 'created_at') { doc.createdAt = value; continue }
    if (col === 'updated_at') { doc.updatedAt = value; continue }
    const payloadName = reverseMap[col] || col
    doc[payloadName] = value
  }
  return doc
}
```

**Step 5: Update src/index.ts to export the DO**

```typescript
import { GraphDLDB } from './do'
import type { Env } from './types'

export { GraphDLDB }

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return new Response(JSON.stringify({ status: 'ok', version: '0.1.0' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  },
}
```

Create `src/types.ts`:

```typescript
export interface Env {
  GRAPHDL_DB: DurableObjectNamespace
  ENVIRONMENT: string
}
```

**Step 6: Run tests**

```bash
yarn test
```

Expected: PASS

**Step 7: Commit**

```bash
git add src/do.ts src/collections.ts src/types.ts src/index.ts src/do.test.ts
git commit -m "feat: GraphDLDB Durable Object with 3NF metamodel tables"
```

---

## Task 5: REST API Router

**Goal:** Add a Payload-compatible REST API so the apis worker rawProxy works with minimal changes. Routes: `GET /api/:collection`, `GET /api/:collection/:id`, `POST /api/:collection`, `PATCH /api/:collection/:id`, `DELETE /api/:collection/:id`.

**Files:**
- Create: `src/api/router.ts`
- Create: `src/api/collections.ts`
- Modify: `src/index.ts` — wire up router

**Step 1: Write the failing test**

Create `src/api/router.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parsePayloadWhereParams } from './collections'

describe('parsePayloadWhereParams', () => {
  it('parses simple equals', () => {
    const params = new URLSearchParams('where[name][equals]=Test')
    const result = parsePayloadWhereParams(params)
    expect(result).toEqual({ name: { equals: 'Test' } })
  })

  it('parses nested with domain filter', () => {
    const params = new URLSearchParams('where[domain][equals]=abc123')
    const result = parsePayloadWhereParams(params)
    expect(result).toEqual({ domain: { equals: 'abc123' } })
  })

  it('parses or conditions', () => {
    const params = new URLSearchParams()
    params.set('where[or][0][visibility][equals]', 'public')
    params.set('where[or][1][organization][equals]', 'org-1')
    const result = parsePayloadWhereParams(params)
    expect(result.or).toHaveLength(2)
    expect(result.or[0]).toEqual({ visibility: { equals: 'public' } })
  })

  it('parses and conditions', () => {
    const params = new URLSearchParams()
    params.set('where[and][0][name][equals]', 'Test')
    params.set('where[and][1][domain][equals]', 'abc')
    const result = parsePayloadWhereParams(params)
    expect(result.and).toHaveLength(2)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
yarn test src/api/router.test.ts
```

**Step 3: Implement the query parameter parser**

Create `src/api/collections.ts`:

```typescript
/**
 * Payload-compatible REST API handlers for collections.
 *
 * Translates URL query params (where[], sort, limit, page, depth)
 * into GraphDLDB collection queries.
 */

/**
 * Parse Payload-style where[] query params into a nested where object.
 *
 * Examples:
 *   where[name][equals]=Test        → { name: { equals: 'Test' } }
 *   where[or][0][name][equals]=A    → { or: [{ name: { equals: 'A' } }] }
 *   where[and][0][x][equals]=1      → { and: [{ x: { equals: '1' } }] }
 */
export function parsePayloadWhereParams(params: URLSearchParams): Record<string, any> {
  const where: Record<string, any> = {}

  for (const [key, value] of params.entries()) {
    if (!key.startsWith('where[')) continue

    // Parse bracket path: where[a][b][c] → ['a', 'b', 'c']
    const path = key.slice(6).replace(/\]$/, '').split('][')
    if (path.length === 0) continue

    setNestedValue(where, path, value)
  }

  return where
}

/** Set a value at a nested path, creating arrays for numeric keys. */
function setNestedValue(obj: any, path: string[], value: any): void {
  let current = obj

  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i]
    const nextKey = path[i + 1]
    const isNextNumeric = /^\d+$/.test(nextKey)

    if (!(key in current)) {
      current[key] = isNextNumeric ? [] : {}
    }
    current = current[key]
  }

  const lastKey = path[path.length - 1]
  current[lastKey] = value
}

/**
 * Parse standard Payload query options from URL params.
 */
export function parseQueryOptions(params: URLSearchParams): {
  where: Record<string, any>
  limit: number
  page: number
  sort: string | undefined
  depth: number
} {
  const where = parsePayloadWhereParams(params)
  const limit = Math.min(parseInt(params.get('limit') || '100', 10), 1000)
  const page = Math.max(parseInt(params.get('page') || '1', 10), 1)
  const sort = params.get('sort') || undefined
  const depth = parseInt(params.get('depth') || '0', 10)

  return { where, limit, page, sort, depth }
}
```

**Step 4: Create the router**

Create `src/api/router.ts`:

```typescript
import { AutoRouter, json, error } from 'itty-router'
import type { Env } from '../types'
import { parseQueryOptions } from './collections'
import { COLLECTION_TABLE_MAP } from '../collections'

/**
 * Get the GraphDL DO stub. One DO per system (for now, single instance).
 * Later: one DO per domain per tenant.
 */
function getDB(env: Env): DurableObjectStub {
  const id = env.GRAPHDL_DB.idFromName('graphdl-primary')
  return env.GRAPHDL_DB.get(id)
}

export const router = AutoRouter()

// ── Health ───────────────────────────────────────────────────────────
router.get('/health', () => json({ status: 'ok', version: '0.1.0' }))

// ── Collection CRUD ──────────────────────────────────────────────────

/** GET /api/:collection — list/find */
router.get('/api/:collection', async (request, env: Env) => {
  const { collection } = request.params
  if (!COLLECTION_TABLE_MAP[collection]) {
    return error(404, { errors: [{ message: `Collection "${collection}" not found` }] })
  }

  const url = new URL(request.url)
  const { where, limit, page, sort, depth } = parseQueryOptions(url.searchParams)
  const offset = (page - 1) * limit

  const db = getDB(env)
  const result = await db.findInCollection(collection, where, { limit, offset, sort, depth })

  return json({
    docs: result.docs,
    totalDocs: result.totalDocs,
    limit,
    page,
    totalPages: Math.ceil(result.totalDocs / limit),
    hasNextPage: result.hasNextPage,
    hasPrevPage: page > 1,
    pagingCounter: offset + 1,
  })
})

/** GET /api/:collection/:id — get by ID */
router.get('/api/:collection/:id', async (request, env: Env) => {
  const { collection, id } = request.params
  if (!COLLECTION_TABLE_MAP[collection]) {
    return error(404, { errors: [{ message: `Collection "${collection}" not found` }] })
  }

  const db = getDB(env)
  const doc = await db.getFromCollection(collection, id)

  if (!doc) return error(404, { errors: [{ message: 'Not Found' }] })
  return json(doc)
})

/** POST /api/:collection — create */
router.post('/api/:collection', async (request, env: Env) => {
  const { collection } = request.params
  if (!COLLECTION_TABLE_MAP[collection]) {
    return error(404, { errors: [{ message: `Collection "${collection}" not found` }] })
  }

  const body = await request.json() as Record<string, any>
  const db = getDB(env)
  const doc = await db.createInCollection(collection, body)

  return json({ doc, message: 'Created successfully' }, { status: 201 })
})

/** PATCH /api/:collection/:id — update */
router.patch('/api/:collection/:id', async (request, env: Env) => {
  const { collection, id } = request.params
  if (!COLLECTION_TABLE_MAP[collection]) {
    return error(404, { errors: [{ message: `Collection "${collection}" not found` }] })
  }

  const body = await request.json() as Record<string, any>
  const db = getDB(env)
  const doc = await db.updateInCollection(collection, id, body)

  if (!doc) return error(404, { errors: [{ message: 'Not Found' }] })
  return json({ doc, message: 'Updated successfully' })
})

/** DELETE /api/:collection/:id — delete */
router.delete('/api/:collection/:id', async (request, env: Env) => {
  const { collection, id } = request.params
  if (!COLLECTION_TABLE_MAP[collection]) {
    return error(404, { errors: [{ message: `Collection "${collection}" not found` }] })
  }

  const db = getDB(env)
  const deleted = await db.deleteFromCollection(collection, id)

  if (!deleted) return error(404, { errors: [{ message: 'Not Found' }] })
  return json({ id, message: 'Deleted successfully' })
})

// ── 404 fallback ─────────────────────────────────────────────────────
router.all('*', () => error(404, { errors: [{ message: 'Not Found' }] }))
```

**Step 5: Wire up the router in src/index.ts**

Update `src/index.ts`:

```typescript
import { GraphDLDB } from './do'
import { router } from './api/router'

export { GraphDLDB }

export default {
  fetch: router.fetch,
}
```

**Step 6: Run tests**

```bash
yarn test
```

Expected: PASS

**Step 7: Commit**

```bash
git add src/api/ src/index.ts
git commit -m "feat: Payload-compatible REST API router for all collections"
```

---

## Task 6: Claims Ingestion

**Goal:** Port `tokenizeReading`, `parseMultiplicity`, `applyConstraints`, and `ingestClaims` to work with the DO instead of Payload CMS.

**Files:**
- Create: `src/claims/tokenize.ts` (copy from old project — pure function)
- Create: `src/claims/constraints.ts` (port — replace Payload calls with DO calls)
- Create: `src/claims/ingest.ts` (port — replace Payload calls with DO calls)
- Create: `src/api/seed.ts` (seed endpoint)
- Test: `src/claims/tokenize.test.ts`
- Test: `src/claims/constraints.test.ts`

**Step 1: Copy pure functions**

`tokenizeReading` and `parseMultiplicity` are pure functions with no Payload dependency. Copy them:

Copy `src/claims/tokenize.ts` from `C:\Users\lippe\Repos\graphdl-orm\src\claims\tokenize.ts` — unchanged.

Copy `parseMultiplicity` from `C:\Users\lippe\Repos\graphdl-orm\src\claims\constraints.ts` — the pure parser part (lines 1-98) is unchanged. `applyConstraints` needs porting.

**Step 2: Write the failing test for tokenize**

Create `src/claims/tokenize.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { tokenizeReading } from './tokenize'

describe('tokenizeReading', () => {
  it('finds nouns in a reading', () => {
    const nouns = [
      { name: 'Customer', id: 'n1' },
      { name: 'SupportRequest', id: 'n2' },
    ]
    const result = tokenizeReading('Customer submits SupportRequest', nouns)
    expect(result.nounRefs).toHaveLength(2)
    expect(result.nounRefs[0].name).toBe('Customer')
    expect(result.nounRefs[1].name).toBe('SupportRequest')
    expect(result.predicate).toBe('submits')
  })

  it('handles longest-first matching', () => {
    const nouns = [
      { name: 'Request', id: 'n1' },
      { name: 'SupportRequest', id: 'n2' },
    ]
    const result = tokenizeReading('SupportRequest has Priority', nouns)
    expect(result.nounRefs[0].name).toBe('SupportRequest')
  })

  it('returns empty for no nouns', () => {
    const result = tokenizeReading('hello world', [])
    expect(result.nounRefs).toHaveLength(0)
  })
})
```

**Step 3: Write the failing test for constraints**

Create `src/claims/constraints.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseMultiplicity } from './constraints'

describe('parseMultiplicity', () => {
  it('parses *:1', () => {
    const result = parseMultiplicity('*:1')
    expect(result).toEqual([{ kind: 'UC', modality: 'Alethic', roles: [0] }])
  })

  it('parses 1:1 into two UCs', () => {
    const result = parseMultiplicity('1:1')
    expect(result).toHaveLength(2)
    expect(result[0].roles).toEqual([0])
    expect(result[1].roles).toEqual([1])
  })

  it('parses *:* as spanning UC', () => {
    const result = parseMultiplicity('*:*')
    expect(result).toEqual([{ kind: 'UC', modality: 'Alethic', roles: [0, 1] }])
  })

  it('parses compound *:1 MC', () => {
    const result = parseMultiplicity('*:1 MC')
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ kind: 'UC', modality: 'Alethic', roles: [0] })
    expect(result[1]).toEqual({ kind: 'MC', modality: 'Alethic', roles: [-1] })
  })

  it('parses Deontic D*:1', () => {
    const result = parseMultiplicity('D*:1')
    expect(result).toEqual([{ kind: 'UC', modality: 'Deontic', roles: [0] }])
  })

  it('returns empty for subtype', () => {
    expect(parseMultiplicity('subtype')).toEqual([])
  })
})
```

**Step 4: Run tests to verify they fail**

```bash
yarn test src/claims/
```

**Step 5: Copy tokenize.ts (pure function, unchanged)**

Create `src/claims/tokenize.ts` — copy verbatim from `C:\Users\lippe\Repos\graphdl-orm\src\claims\tokenize.ts`.

**Step 6: Port constraints.ts**

Create `src/claims/constraints.ts`:

```typescript
/**
 * Constraint parsing and application.
 *
 * parseMultiplicity() — pure function, unchanged from original.
 * applyConstraints() — ported from Payload to GraphDLDB DO calls.
 */
import type { GraphDLDB } from '../do'

export interface ConstraintDef {
  kind: 'UC' | 'MC'
  modality: 'Alethic' | 'Deontic'
  roles: number[]
}

/**
 * Parse multiplicity notation into constraint definitions.
 * Pure function — no DB dependency.
 */
export function parseMultiplicity(spec: string): ConstraintDef[] {
  if (!spec) return []
  if (spec === 'subtype') return []
  if (/^D?SS$/i.test(spec.split(/\s+/)[0])) return []

  const parts = spec.split(/\s+/)
  const constraints: ConstraintDef[] = []

  for (const part of parts) {
    const ducMatch = part.match(/^D([*1]:[*1])$/i)
    if (ducMatch) { expandUC(ducMatch[1], 'Deontic', constraints); continue }
    if (/^[*1]:[*1]$/.test(part)) { expandUC(part, 'Alethic', constraints); continue }
    if (/^DMC$/i.test(part)) { constraints.push({ kind: 'MC', modality: 'Deontic', roles: [-1] }); continue }
    if (/^A?MC$/i.test(part)) { constraints.push({ kind: 'MC', modality: 'Alethic', roles: [-1] }); continue }
    if (/^unary$/i.test(part)) { constraints.push({ kind: 'UC', modality: 'Alethic', roles: [0] }); continue }
  }

  return constraints
}

function expandUC(pattern: string, modality: 'Alethic' | 'Deontic', out: ConstraintDef[]): void {
  switch (pattern) {
    case '*:1': out.push({ kind: 'UC', modality, roles: [0] }); break
    case '1:*': out.push({ kind: 'UC', modality, roles: [1] }); break
    case '1:1':
      out.push({ kind: 'UC', modality, roles: [0] })
      out.push({ kind: 'UC', modality, roles: [1] })
      break
    case '*:*': out.push({ kind: 'UC', modality, roles: [0, 1] }); break
  }
}

/**
 * Apply constraint definitions by creating constraint + constraint_span records.
 * Ported from Payload's applyConstraints to use GraphDLDB directly.
 */
export async function applyConstraints(
  db: GraphDLDB,
  opts: {
    constraints: ConstraintDef[]
    roleIds: string[]
    domainId?: string
  },
): Promise<void> {
  const { constraints, roleIds, domainId } = opts

  for (const def of constraints) {
    const resolvedIds = def.roles
      .map(idx => idx === -1 ? roleIds[roleIds.length - 1] : roleIds[idx])
      .filter((id): id is string => !!id)

    if (!resolvedIds.length) continue

    const constraint = await db.createInCollection('constraints', {
      kind: def.kind,
      modality: def.modality,
      ...(domainId ? { domain: domainId } : {}),
    })

    for (const roleId of resolvedIds) {
      await db.createInCollection('constraint-spans', {
        constraint: constraint.id,
        role: roleId,
        ...(domainId ? { domain: domainId } : {}),
      })
    }
  }
}
```

**Step 7: Port ingest.ts**

Create `src/claims/ingest.ts`:

```typescript
/**
 * Claims ingestion — ported from Payload to GraphDLDB.
 *
 * Two entry points:
 * - ingestReading()  — single reading
 * - ingestClaims()   — bulk structured claims
 */
import type { GraphDLDB } from '../do'
import { tokenizeReading } from './tokenize'
import { parseMultiplicity, applyConstraints } from './constraints'

export interface ExtractedClaims {
  nouns: Array<{
    name: string
    objectType: 'entity' | 'value'
    plural?: string
    valueType?: string
    format?: string
    enum?: string[]
    minimum?: number
    maximum?: number
    pattern?: string
  }>
  readings: Array<{
    text: string
    nouns: string[]
    predicate: string
    multiplicity?: string
  }>
  constraints: Array<{
    kind: 'UC' | 'MC'
    modality: 'Alethic' | 'Deontic'
    reading: string
    roles: number[]
  }>
  subtypes?: Array<{ child: string; parent: string }>
  transitions?: Array<{ entity: string; from: string; to: string; event: string }>
  facts?: Array<{
    reading: string
    values: Array<{ noun: string; value: string }>
  }>
}

export interface IngestClaimsResult {
  nouns: number
  readings: number
  stateMachines: number
  skipped: number
  errors: string[]
}

/** Ensure a noun exists for this domain; return the doc. */
async function ensureNoun(
  db: GraphDLDB,
  name: string,
  data: Record<string, any>,
  domainId: string,
): Promise<Record<string, any>> {
  const existing = await db.findInCollection('nouns', {
    name: { equals: name },
    domain: { equals: domainId },
  }, { limit: 1 })

  if (existing.docs.length) {
    const doc = existing.docs[0]
    if (data.objectType && doc.objectType !== data.objectType) {
      return (await db.updateInCollection('nouns', doc.id, { objectType: data.objectType }))!
    }
    return doc
  }

  return db.createInCollection('nouns', { name, domain: domainId, ...data })
}

/**
 * Ingest bulk structured claims.
 */
export async function ingestClaims(
  db: GraphDLDB,
  opts: { claims: ExtractedClaims; domainId: string },
): Promise<IngestClaimsResult> {
  const { claims, domainId } = opts
  const result: IngestClaimsResult = { nouns: 0, readings: 0, stateMachines: 0, skipped: 0, errors: [] }
  const nounMap = new Map<string, Record<string, any>>()

  // Step 1: Create all nouns
  for (const noun of claims.nouns) {
    try {
      const data: Record<string, any> = { objectType: noun.objectType }
      if (noun.plural) data.plural = noun.plural
      if (noun.valueType) data.valueType = noun.valueType
      if (noun.format) data.format = noun.format
      if (noun.enum) data.enumValues = Array.isArray(noun.enum) ? noun.enum.join(', ') : noun.enum
      if (noun.minimum !== undefined) data.minimum = noun.minimum
      if (noun.maximum !== undefined) data.maximum = noun.maximum
      if (noun.pattern) data.pattern = noun.pattern

      const doc = await ensureNoun(db, noun.name, data, domainId)
      nounMap.set(noun.name, doc)
      result.nouns++
    } catch (err: any) {
      result.errors.push(`noun "${noun.name}": ${err.message}`)
    }
  }

  // Step 2: Apply subtypes
  for (const sub of claims.subtypes || []) {
    try {
      const child = nounMap.get(sub.child)
      const parent = nounMap.get(sub.parent)
      if (child && parent) {
        await db.updateInCollection('nouns', child.id, { superType: parent.id })
      }
    } catch (err: any) {
      result.errors.push(`subtype "${sub.child} -> ${sub.parent}": ${err.message}`)
    }
  }

  // Step 3: Create graph schemas + readings
  const schemaMap = new Map<string, Record<string, any>>()

  for (const reading of claims.readings) {
    try {
      // Ensure referenced nouns exist
      for (const nounName of reading.nouns) {
        if (!nounMap.has(nounName)) {
          const doc = await ensureNoun(db, nounName, { objectType: 'entity' }, domainId)
          nounMap.set(nounName, doc)
          result.nouns++
        }
      }

      // Check for existing reading
      const existingReading = await db.findInCollection('readings', {
        text: { equals: reading.text },
        domain: { equals: domainId },
      }, { limit: 1 })

      if (existingReading.docs.length) {
        schemaMap.set(reading.text, { id: existingReading.docs[0].graphSchema })
        result.skipped++
        continue
      }

      // Create graph schema
      const schemaName = reading.nouns.join('')
      const schema = await db.createInCollection('graph-schemas', {
        name: schemaName,
        title: schemaName,
        domain: domainId,
      })
      schemaMap.set(reading.text, schema)

      // Create reading
      const readingDoc = await db.createInCollection('readings', {
        text: reading.text,
        graphSchema: schema.id,
        domain: domainId,
      })

      // Auto-create roles (was done by Payload afterChange hook)
      const allNouns = await db.findInCollection('nouns', {
        domain: { equals: domainId },
      }, { limit: 1000 })
      const nounList = allNouns.docs.map((n: any) => ({ name: n.name, id: n.id }))
      const tokenized = tokenizeReading(reading.text, nounList)

      for (const nounRef of tokenized.nounRefs) {
        await db.createInCollection('roles', {
          reading: readingDoc.id,
          noun: nounRef.id,
          graphSchema: schema.id,
          roleIndex: nounRef.index,
        })
      }

      result.readings++

      // Apply multiplicity constraints
      if (reading.multiplicity) {
        const constraintDefs = parseMultiplicity(reading.multiplicity)
        if (constraintDefs.length > 0) {
          const roles = await db.findInCollection('roles', {
            graphSchema: { equals: schema.id },
          }, { sort: 'createdAt' })
          const roleIds = roles.docs.map((r: any) => r.id)
          await applyConstraints(db, { constraints: constraintDefs, roleIds, domainId })
        }
      }
    } catch (err: any) {
      result.errors.push(`reading "${reading.text}": ${err.message}`)
    }
  }

  // Step 4: Apply explicit constraints
  for (const constraint of claims.constraints || []) {
    try {
      const schema = schemaMap.get(constraint.reading)
      if (!schema) { result.errors.push(`constraint: reading "${constraint.reading}" not found`); continue }

      const roles = await db.findInCollection('roles', {
        graphSchema: { equals: schema.id },
      }, { sort: 'createdAt' })

      const c = await db.createInCollection('constraints', {
        kind: constraint.kind,
        modality: constraint.modality,
        domain: domainId,
      })

      const roleIds = constraint.roles
        .map(idx => roles.docs[idx]?.id)
        .filter(Boolean)

      for (const roleId of roleIds) {
        await db.createInCollection('constraint-spans', {
          constraint: c.id,
          role: roleId,
          domain: domainId,
        })
      }
    } catch (err: any) {
      result.errors.push(`constraint on "${constraint.reading}": ${err.message}`)
    }
  }

  // Step 5: Seed state machine transitions
  if (claims.transitions?.length) {
    const byEntity = new Map<string, typeof claims.transitions>()
    for (const t of claims.transitions) {
      const group = byEntity.get(t.entity) || []
      group.push(t)
      byEntity.set(t.entity, group)
    }

    for (const [entityName, transitions] of byEntity) {
      try {
        const noun = nounMap.get(entityName)
        if (!noun) { result.errors.push(`transition entity "${entityName}" not found`); continue }

        // Ensure state machine definition
        const existingDef = await db.findInCollection('state-machine-definitions', {
          noun: { equals: noun.id },
        }, { limit: 1 })

        const definition = existingDef.docs.length
          ? existingDef.docs[0]
          : await db.createInCollection('state-machine-definitions', {
              noun: { relationTo: 'nouns', value: noun.id },
              domain: domainId,
            })

        // Collect unique states and events
        const stateNames = new Set<string>()
        const eventNames = new Set<string>()
        for (const t of transitions) {
          stateNames.add(t.from)
          stateNames.add(t.to)
          eventNames.add(t.event)
        }

        // Ensure statuses
        const statusMap = new Map<string, string>()
        for (const name of stateNames) {
          const existing = await db.findInCollection('statuses', {
            name: { equals: name },
            stateMachineDefinition: { equals: definition.id },
          }, { limit: 1 })
          const status = existing.docs.length
            ? existing.docs[0]
            : await db.createInCollection('statuses', {
                name,
                stateMachineDefinition: definition.id,
              })
          statusMap.set(name, status.id)
        }

        // Ensure event types
        const eventMap = new Map<string, string>()
        for (const name of eventNames) {
          const existing = await db.findInCollection('event-types', {
            name: { equals: name },
          }, { limit: 1 })
          const et = existing.docs.length
            ? existing.docs[0]
            : await db.createInCollection('event-types', { name })
          eventMap.set(name, et.id)
        }

        // Create transitions
        for (const t of transitions) {
          const fromId = statusMap.get(t.from)!
          const toId = statusMap.get(t.to)!
          const eventId = eventMap.get(t.event)!

          const existingT = await db.findInCollection('transitions', {
            from: { equals: fromId },
            to: { equals: toId },
            eventType: { equals: eventId },
          }, { limit: 1 })

          if (!existingT.docs.length) {
            await db.createInCollection('transitions', {
              from: fromId,
              to: toId,
              eventType: eventId,
            })
          }
        }

        result.stateMachines++
      } catch (err: any) {
        result.errors.push(`transitions for "${entityName}": ${err.message}`)
      }
    }
  }

  return result
}
```

**Step 8: Create the seed endpoint**

Create `src/api/seed.ts`:

```typescript
import { json, error } from 'itty-router'
import type { Env } from '../types'
import { ingestClaims } from '../claims/ingest'
import type { ExtractedClaims } from '../claims/ingest'

export async function handleSeed(request: Request, env: Env): Promise<Response> {
  if (request.method === 'GET') {
    // Return DB stats
    const db = getDB(env)
    const stats = {
      nouns: (await db.findInCollection('nouns', {}, { limit: 0 })).totalDocs,
      readings: (await db.findInCollection('readings', {}, { limit: 0 })).totalDocs,
      domains: (await db.findInCollection('domains', {}, { limit: 0 })).totalDocs,
      graphs: (await db.findInCollection('graphs', {}, { limit: 0 })).totalDocs,
      resources: (await db.findInCollection('resources', {}, { limit: 0 })).totalDocs,
      stateMachines: (await db.findInCollection('state-machines', {}, { limit: 0 })).totalDocs,
    }
    return json(stats)
  }

  if (request.method === 'DELETE') {
    // Wipe all data (except users)
    // This requires a DO method that truncates all tables
    const db = getDB(env)
    await db.wipeAllData()
    return json({ message: 'All data wiped' })
  }

  if (request.method === 'POST') {
    const body = await request.json() as { type: string; claims?: ExtractedClaims; domain?: string; domainId?: string }

    if (body.type === 'claims' && body.claims) {
      const domainId = body.domainId || body.domain
      if (!domainId) return error(400, { errors: [{ message: 'domainId required for claims ingestion' }] })

      const db = getDB(env)
      const result = await ingestClaims(db, { claims: body.claims, domainId })
      return json(result)
    }

    return error(400, { errors: [{ message: 'Unsupported seed type. Use type: "claims"' }] })
  }

  return error(405, { errors: [{ message: 'Method not allowed' }] })
}

function getDB(env: Env): any {
  const id = env.GRAPHDL_DB.idFromName('graphdl-primary')
  return env.GRAPHDL_DB.get(id)
}
```

**Step 9: Add seed route to router**

Add to `src/api/router.ts` before the 404 fallback:

```typescript
import { handleSeed } from './seed'

// Add before router.all('*', ...)
router.all('/seed', handleSeed)
router.all('/claims', handleSeed)  // Alias used by apis worker
```

**Step 10: Run tests**

```bash
yarn test
```

Expected: PASS

**Step 11: Commit**

```bash
git add src/claims/ src/api/seed.ts src/api/router.ts
git commit -m "feat: claims ingestion ported from Payload to GraphDL DO"
```

---

## Task 7: apis Worker Proxy Update

**Goal:** Update the apis worker to point the rawProxy at the new graphdl-orm Cloudflare Worker instead of graphdl.fly.dev.

**Files:**
- Modify: `C:\Users\lippe\Repos\apis\wrangler.jsonc` — add service binding
- Modify: `C:\Users\lippe\Repos\apis\graphdl\raw-proxy.ts` — use service binding
- Modify: `C:\Users\lippe\Repos\apis\graphdl\helpers.ts` — update base URL

**Step 1: Add service binding to apis wrangler.jsonc**

Add to the top-level config:

```jsonc
{
  "services": [
    {
      "binding": "GRAPHDL",
      "service": "graphdl-orm"
    }
  ]
}
```

**Step 2: Update the rawProxy to use service binding**

In `C:\Users\lippe\Repos\apis\graphdl\raw-proxy.ts`, change the fetch target from `${env.GRAPHDL_URL}/api${payloadPath}` to `env.GRAPHDL.fetch(...)`:

Replace:
```typescript
const target = `${env.GRAPHDL_URL}/api${payloadPath}${search}`
const res = await fetch(target, proxyInit)
```

With:
```typescript
// Use service binding if available, otherwise fall back to URL
const target = `/api${payloadPath}${search}`
const res = env.GRAPHDL
  ? await env.GRAPHDL.fetch(new Request(`https://graphdl-orm${target}`, proxyInit))
  : await fetch(`${env.GRAPHDL_URL}/api${payloadPath}${search}`, proxyInit)
```

**Step 3: Update helpers.ts**

In `C:\Users\lippe\Repos\apis\graphdl\helpers.ts`, update any `fetch(GRAPHDL_URL + ...)` calls to use the service binding when available.

**Step 4: Test locally with wrangler dev**

```bash
# Terminal 1: start graphdl-orm
cd /c/Users/lippe/Repos/graphdl-orm
yarn dev

# Terminal 2: start apis with service binding
cd /c/Users/lippe/Repos/apis
wrangler dev
```

Verify: `curl http://localhost:8787/graphdl/raw/nouns?limit=1` returns Payload-shaped JSON.

**Step 5: Commit (in apis repo)**

```bash
cd /c/Users/lippe/Repos/apis
git add wrangler.jsonc graphdl/raw-proxy.ts graphdl/helpers.ts
git commit -m "feat: use service binding to graphdl-orm Worker instead of Fly.io"
```

---

## Task 8: Deploy and Re-seed

**Goal:** Deploy the new graphdl-orm Worker, re-seed the metamodel from FORML2 readings files, and verify the apis proxy works end-to-end.

**Files:**
- Create: `scripts/seed-metamodel.ts` (seeding script)

**Step 1: Deploy graphdl-orm**

```bash
cd /c/Users/lippe/Repos/graphdl-orm
wrangler deploy
```

**Step 2: Create the seeding script**

Create `scripts/seed-metamodel.ts`:

```typescript
/**
 * Seed the GraphDL metamodel from FORML2 readings files.
 *
 * Reads each .md file in readings/, extracts claims via the apis extract endpoint,
 * then seeds them into the new graphdl-orm Worker.
 *
 * Usage: npx tsx scripts/seed-metamodel.ts
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const API_BASE = process.env.API_URL || 'https://api.auto.dev'
const API_KEY = process.env.AUTO_DEV_API_KEY

if (!API_KEY) {
  console.error('Set AUTO_DEV_API_KEY environment variable')
  process.exit(1)
}

const headers = {
  'X-API-Key': API_KEY,
  'Content-Type': 'application/json',
}

async function seedDomain(slug: string, readingsText: string): Promise<void> {
  console.log(`\n--- Seeding domain: ${slug} ---`)

  // Step 1: Extract claims via LLM
  console.log('  Extracting claims...')
  const extractRes = await fetch(`${API_BASE}/graphdl/extract/claims`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text: readingsText, seed: false }),
  })

  if (!extractRes.ok) {
    console.error(`  Extract failed: ${extractRes.status} ${await extractRes.text()}`)
    return
  }

  const { claims } = await extractRes.json() as any
  console.log(`  Extracted: ${claims.nouns.length} nouns, ${claims.readings.length} readings`)

  // Step 2: Ensure domain exists
  const domainRes = await fetch(`${API_BASE}/graphdl/raw/domains`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ domainSlug: slug, name: slug, visibility: 'private' }),
  })
  const domain = await domainRes.json() as any
  const domainId = domain.doc?.id || domain.id

  // Step 3: Seed claims
  console.log('  Seeding claims...')
  const seedRes = await fetch(`${API_BASE}/graphdl/claims`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ type: 'claims', claims, domainId }),
  })

  if (!seedRes.ok) {
    console.error(`  Seed failed: ${seedRes.status} ${await seedRes.text()}`)
    return
  }

  const result = await seedRes.json() as any
  console.log(`  Result: ${result.nouns} nouns, ${result.readings} readings, ${result.errors?.length || 0} errors`)
  if (result.errors?.length) {
    for (const err of result.errors.slice(0, 5)) {
      console.log(`    Error: ${err}`)
    }
  }
}

async function main() {
  const readingsDir = join(import.meta.dirname, '..', 'readings')
  const files = readdirSync(readingsDir).filter(f => f.endsWith('.md'))

  console.log(`Found ${files.length} readings files: ${files.join(', ')}`)

  for (const file of files) {
    const slug = file.replace('.md', '')
    const text = readFileSync(join(readingsDir, file), 'utf-8')
    await seedDomain(`graphdl-${slug}`, text)
  }

  // Verify
  console.log('\n--- Verification ---')
  const statsRes = await fetch(`${API_BASE}/graphdl/raw/nouns?limit=0`, { headers })
  const stats = await statsRes.json() as any
  console.log(`Total nouns: ${stats.totalDocs}`)
}

main().catch(console.error)
```

**Step 3: Run the seeding script**

```bash
cd /c/Users/lippe/Repos/graphdl-orm
export AUTO_DEV_API_KEY=$(cat ~/.claude/.env | grep AUTO_DEV_API_KEY | cut -d= -f2)
npx tsx scripts/seed-metamodel.ts
```

**Step 4: Verify via apis proxy**

```bash
# List nouns
curl -H "X-API-Key: $AUTO_DEV_API_KEY" "https://api.auto.dev/graphdl/raw/nouns?limit=5"

# List domains
curl -H "X-API-Key: $AUTO_DEV_API_KEY" "https://api.auto.dev/graphdl/raw/domains?limit=5"

# List readings for a domain
curl -H "X-API-Key: $AUTO_DEV_API_KEY" "https://api.auto.dev/graphdl/raw/readings?where[domain][equals]=DOMAIN_ID&limit=5"
```

**Step 5: Commit**

```bash
cd /c/Users/lippe/Repos/graphdl-orm
git add scripts/seed-metamodel.ts
git commit -m "feat: metamodel seeding script for FORML2 readings"
```

---

## Summary

| Task | What it does | Key files |
|------|-------------|-----------|
| 1 | Project scaffold + @dotdo/db submodule | package.json, wrangler.jsonc, tsconfig.json |
| 2 | Metamodel DDL (orgs, domains, nouns, readings, etc.) | src/schema/metamodel.ts |
| 3 | State machine + instance DDL | src/schema/state.ts, src/schema/instances.ts |
| 4 | GraphDL DO class + collection CRUD | src/do.ts, src/collections.ts |
| 5 | Payload-compatible REST API router | src/api/router.ts, src/api/collections.ts |
| 6 | Claims ingestion (port from Payload) | src/claims/ingest.ts, src/api/seed.ts |
| 7 | apis worker service binding | apis/wrangler.jsonc, apis/graphdl/raw-proxy.ts |
| 8 | Deploy + re-seed from FORML2 readings | scripts/seed-metamodel.ts |
