# GraphDL on ClickHouse + Cloudflare — Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create the implementation plan from this design.

**Goal:** Rewrite graphdl-orm — drop Payload CMS + MongoDB + Fly.io, rebuild on `@dotdo/db` → ClickHouse Cloud + Cloudflare Workers.

**Architecture:** GraphDL extends `@dotdo/db`'s DB Durable Object. Each domain per tenant gets its own DO instance with a 3NF SQLite schema generated from the domain's readings via CSDP/RMap. ClickHouse provides the analytics layer via CDC event forwarding. The apis worker proxies to the new graphdl-orm Cloudflare Worker via service binding.

**Tech Stack:** `@dotdo/db` (git submodule), Cloudflare Workers + Durable Objects, ClickHouse Cloud, TypeScript.

---

## What Dies

- Payload CMS (framework)
- MongoDB (database)
- Fly.io (hosting)
- Next.js 15 (runtime)
- The `graphdl.fly.dev` deployment

## What Survives (rewritten)

- The 24 collection schemas (as ClickHouse tables + DO SQLite)
- The seed/unified.ts logic (adapted to `@graphdl/db`)
- The generation pipeline (generators, output formats)
- The claim extraction flow (already lives in apis worker)
- Domain-scoped access control (tenant filtering)
- The FORML2 readings files (untouched — they're the source of truth)

## Data Layer

### `@graphdl/db` wrapping `@dotdo/db`

`@dotdo/db` is consumed as a git submodule at `.do/db/`, same pattern as headless.ly. `@graphdl/db` provides:

- Typed Collection access to all GraphDL entity types
- Generated 3NF schemas from readings
- Domain-scoped query helpers

```typescript
import { db } from '@graphdl/db'

await db.Noun.find({ filter: { domain: 'vehicle-data' } })
await db.Reading.create({ subject: 'noun-1', predicate: 'has', object: 'noun-2', domain: 'vehicle-data' })
```

### Two-Layer Storage

**Durable Object (SQLite)** — row-level speed:
- Each entity type gets a properly-typed SQLite schema generated from readings via CSDP/RMap
- Real columns, real constraints, real foreign keys (within a domain)
- Write mutex serializes mutations
- CDC event logging on every mutation
- Versioning ($version auto-increment)

**ClickHouse Cloud** — analytics speed:
- CDC events from DOs forward to ClickHouse automatically
- Bulk queries, aggregations, cross-domain joins
- Time-series analysis on event history

### DO Topology

One DO per domain per tenant:

```
lippertz:vehicle-data   → DO with Make, MakeModel, YearMakeModel, ... tables
lippertz:support        → DO with SupportRequest, Message, ... tables
lippertz:graphdl-meta   → DO with Noun, Reading, Constraint, ... tables (self-describing)
```

Mapping to `@dotdo/db` concepts:
- **Tenant → Org** — top-level isolation boundary
- **Domain → System** — each domain gets its own DO instance

### Cross-Domain References

Soft references — store IDs, validate at the application layer, use ClickHouse for cross-domain joins. In ui.do, cross-domain references render as links between apps. No hidden coupling.

### Schema Generation Pipeline

```
FORML2 readings
    → LLM claim extraction (/graphdl/extract/claims)
    → Structured claims (nouns, readings, constraints, subtypes)
    → CSDP (Conceptual Schema Design Procedure)
    → RMap (Relational Mapping)
    → 3NF DDL
    → DO initTables() override
```

Each domain's DO extends `@dotdo/db`'s `DB` class and overrides `initTables()` with the generated DDL. The base class provides write mutex, CDC, versioning, and event forwarding for free.

### Metamodel Bootstrap

The graphdl-meta domain is self-describing — its schema is generated from its own readings. Bootstrap sequence:

1. Hardcoded initial DDL for the metamodel tables (nouns, readings, constraints, domains, etc.)
2. Seed the metamodel readings into that bootstrap schema
3. Run CSDP/RMap on the metamodel readings to generate the "real" schema
4. The generated schema should match the bootstrap DDL (validation check)

After bootstrap, the metamodel is just another domain — queryable, seedable, generable.

## Deployment

### graphdl-orm = Cloudflare Worker

- Owns all data operations
- Exposes REST API matching current Payload-style endpoints
- Contains the `@graphdl/db` package and DO bindings
- Deployed via `wrangler deploy`

### apis worker = simplified proxy

- Service binding to graphdl-orm worker (CF Worker → CF Worker, no cross-cloud hop)
- Same auth + tenant scoping logic as today
- `/graphdl/raw/*` routes become service binding calls instead of fetch-to-Fly.io

### ui.do = admin UI

- Meta-circular — GraphDL's own iLayer, rendered by ui.do
- Manages nouns, readings, constraints, domains through the same universal app host
- Cross-domain references render as links between apps

## Seed / Bootstrap Flow

FORML2 readings files remain the source of truth. The seed flow:

1. FORML2 readings → LLM claim extraction (`/graphdl/extract/claims`)
2. Extracted claims → seed endpoint → `@graphdl/db` inserts into DO
3. CDC events forward to ClickHouse
4. Readings → RMap → 3NF schema → generation outputs (OpenAPI, XState, iLayer, etc.)

No data migration needed — MongoDB cluster is already paused. Fresh ClickHouse + DO tables, re-seed from readings files.

## Migration Strategy

There is no data migration. The MongoDB cluster is paused and not coming back. The FORML2 readings files are the durable source of truth. Strategy:

1. Build the new stack (graphdl-orm Worker + @graphdl/db + @dotdo/db)
2. Bootstrap the metamodel from hardcoded DDL
3. Re-seed all domains from their FORML2 readings files
4. Verify generation outputs match previous behavior
5. Point apis worker's proxy to the new Worker via service binding
6. Delete the old graphdl-orm repo contents, replace with new stack

## Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Data layer foundation | `@dotdo/db` (git submodule) | Alignment with headless.ly, Nathan's code, no changes needed |
| Schema vs instance data | All in one layer | GraphDL needs to reason about instance data |
| graphdl-orm deployment | Separate Cloudflare Worker | Clean separation, apis proxies via service binding |
| Admin UI | ui.do (meta-circular) | Eat your own dog food |
| DO topology | One DO per domain per tenant | Matches @dotdo/db's org:system pattern |
| Cross-domain references | Soft references (IDs) | Links between apps in ui.do, ClickHouse for joins |
| Entity schemas in DO | 3NF from CSDP/RMap | Generated from readings, not generic JSON blobs |
| Consume @headlessly/db? | No — build @graphdl/db on @dotdo/db | Avoids coupling to Nathan's product layer |
| Promote Collection into @dotdo/db? | No | Would cause waves |
