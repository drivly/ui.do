# Organizations & Self-Hosting Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace flat `tenant` email with Organization entities, bootstrap GraphDL's metamodel as readings, formalize master/detail/popover layout, and add chat/streaming to make ui.do a universal app host.

**Architecture:** Four sequential workstreams across three repos (graphdl-orm, apis, ui.do). Org model is additive first (new collections alongside existing tenant), then migration, then switchover.

**Tech Stack:** Payload CMS 3.x (graphdl-orm), Cloudflare Workers/itty-router (apis), Vite+React 19+Tailwind 4 (ui.do), Vitest (all repos)

---

## Phase 1: Organization Model

### Task 1: Organizations Collection (graphdl-orm)

**Repo:** `C:\Users\lippe\Repos\graphdl-orm`

**Files:**
- Create: `src/collections/Organizations.ts`
- Modify: `src/payload.config.ts`

**Step 1: Create the collection**

```typescript
// src/collections/Organizations.ts
import type { CollectionConfig } from 'payload'

export const Organizations: CollectionConfig = {
  slug: 'organizations',
  admin: { useAsTitle: 'name' },
  access: {
    read: () => true,
    create: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
    delete: ({ req }) => !!req.user,
  },
  fields: [
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      label: 'Organization identified by OrgSlug',
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Organization has Name. Each Organization has at most one Name.',
    },
  ],
}
```

**Step 2: Register in payload.config.ts**

Add import at line ~34 (with other collection imports):
```typescript
import { Organizations } from './collections/Organizations'
```

Add to the `collections` array (line ~78, before `...generatedCollections`):
```typescript
Organizations,
```

**Step 3: Verify**

Run: `cd /c/Users/lippe/Repos/graphdl-orm && yarn build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/collections/Organizations.ts src/payload.config.ts
git commit -m "feat: add Organizations collection"
```

---

### Task 2: OrgMemberships Collection (graphdl-orm)

**Repo:** `C:\Users\lippe\Repos\graphdl-orm`

**Files:**
- Create: `src/collections/OrgMemberships.ts`
- Modify: `src/payload.config.ts`

**Step 1: Create the collection**

```typescript
// src/collections/OrgMemberships.ts
import type { CollectionConfig } from 'payload'

export const OrgMemberships: CollectionConfig = {
  slug: 'org-memberships',
  admin: { useAsTitle: 'user' },
  access: {
    read: () => true,
    create: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
    delete: ({ req }) => !!req.user,
  },
  indexes: [
    {
      fields: { user: 1, organization: 1 },
      options: { unique: true },
    },
  ],
  fields: [
    {
      name: 'user',
      type: 'text',
      required: true,
      index: true,
      label: 'User has OrgRole in Organization — UC(User, Organization) — user email',
    },
    {
      name: 'organization',
      type: 'relationship',
      relationTo: 'organizations',
      required: true,
      index: true,
      label: 'User has OrgRole in Organization — UC(User, Organization) — organization',
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'member',
      options: [
        { label: 'Owner', value: 'owner' },
        { label: 'Member', value: 'member' },
      ],
      label: 'User has OrgRole in Organization — UC(User, Organization) — role',
    },
  ],
}
```

**Step 2: Register in payload.config.ts**

Add import:
```typescript
import { OrgMemberships } from './collections/OrgMemberships'
```

Add to `collections` array:
```typescript
OrgMemberships,
```

**Step 3: Verify build**

Run: `cd /c/Users/lippe/Repos/graphdl-orm && yarn build`

**Step 4: Commit**

```bash
git add src/collections/OrgMemberships.ts src/payload.config.ts
git commit -m "feat: add OrgMemberships collection (ternary: User has OrgRole in Organization)"
```

---

### Task 3: Add Organization Field to Domains and Apps (graphdl-orm)

**Repo:** `C:\Users\lippe\Repos\graphdl-orm`

**Files:**
- Modify: `src/collections/Domains.ts` (add organization field alongside existing tenant)
- Modify: `src/collections/Apps.ts` (same)

**Step 1: Add organization field to Domains.ts**

After the `tenant` field (line ~47), add:
```typescript
{
  name: 'organization',
  type: 'relationship',
  relationTo: 'organizations',
  index: true,
  label: 'Domain belongs to Organization. Each Domain belongs to at most one Organization.',
},
```

Keep `tenant` field for now — migration will populate `organization`, then tenant gets removed later.

**Step 2: Add organization field to Apps.ts**

After the `tenant` field (line ~40), add the same field.

**Step 3: Verify build**

Run: `cd /c/Users/lippe/Repos/graphdl-orm && yarn build`

**Step 4: Commit**

```bash
git add src/collections/Domains.ts src/collections/Apps.ts
git commit -m "feat: add organization relationship to Domains and Apps (alongside tenant)"
```

---

### Task 4: Update rawProxy Instance Collection List (apis)

**Repo:** `C:\Users\lippe\Repos\apis`

**Files:**
- Modify: `graphdl/raw-proxy.ts` (add organizations and org-memberships to collection handling)

**Step 1: Add new collections to the instance collections set**

In `raw-proxy.ts`, the instance collections are listed at lines 4-11. Add `org-memberships` to this list (org-memberships are scoped to the user, not domain-scoped).

Actually, `organizations` and `org-memberships` need different scoping:
- `organizations` — readable by members, writable by owners
- `org-memberships` — readable/writable by org owners, readable by self

For now, add them as unscoped (like schema collections) since the rawProxy will enforce membership checks in a later task. The proxy-level org scoping is the critical change.

In `raw-proxy.ts`, ensure `organizations` and `org-memberships` are NOT in the instance collections set (they're not domain-scoped). They should pass through like schema collections.

**Step 2: Verify existing tests still pass**

Run: `cd /c/Users/lippe/Repos/apis && yarn test`

**Step 3: Commit**

```bash
git add graphdl/raw-proxy.ts
git commit -m "feat: add organizations and org-memberships to rawProxy passthrough"
```

---

### Task 5: Implicit Personal Org Provisioning (apis)

**Repo:** `C:\Users\lippe\Repos\apis`

**Files:**
- Modify: `graphdl/with-graphdl-user.ts`
- Create: `graphdl/ensure-org.ts`

**Step 1: Create the ensureOrg helper**

```typescript
// graphdl/ensure-org.ts
import { graphdlFind, graphdlPost } from './helpers'
import type { Env } from '../types/api.types'

/**
 * Ensure user has a personal Organization. Creates one on first access.
 * Returns the user's org IDs for scoping.
 */
export async function ensurePersonalOrg(
  email: string,
  env: Env,
  apiKey: string,
): Promise<string[]> {
  // Find all orgs the user is a member of
  const memberships = await graphdlFind(env, 'org-memberships', {
    user: { equals: email },
  }, apiKey)

  if (memberships.length > 0) {
    return memberships.map((m: any) =>
      typeof m.organization === 'string' ? m.organization : m.organization?.id
    ).filter(Boolean)
  }

  // No memberships — create personal org
  const slug = email.replace(/[@.]/g, '-').toLowerCase()
  const name = email.split('@')[0]

  // Check if org with this slug already exists
  const existing = await graphdlFind(env, 'organizations', {
    slug: { equals: slug },
  }, apiKey)

  let orgId: string
  if (existing.length > 0) {
    orgId = existing[0].id
  } else {
    const org = await graphdlPost(env, 'organizations', {
      slug,
      name: `${name}'s workspace`,
    }, apiKey)
    orgId = org.id
  }

  // Create owner membership
  await graphdlPost(env, 'org-memberships', {
    user: email,
    organization: orgId,
    role: 'owner',
  }, apiKey)

  return [orgId]
}
```

**Step 2: Update withGraphDLUser to provision org**

```typescript
// graphdl/with-graphdl-user.ts
import { ensurePersonalOrg } from './ensure-org'

export async function withGraphDLUser(request: ApiRequest, env: Env) {
  if (!request.user?.email) return
  request.graphdlApiKey = env.GRAPHDL_API_KEY
  // Ensure user has at least a personal org; cache org IDs on request
  request.userOrgIds = await ensurePersonalOrg(
    request.user.email,
    env,
    env.GRAPHDL_API_KEY,
  )
}
```

**Step 3: Add userOrgIds to ApiRequest type**

In `types/api.types.ts`, add to ApiRequest:
```typescript
userOrgIds?: string[]
```

**Step 4: Verify**

Run: `cd /c/Users/lippe/Repos/apis && yarn test`

**Step 5: Commit**

```bash
git add graphdl/ensure-org.ts graphdl/with-graphdl-user.ts types/api.types.ts
git commit -m "feat: implicit personal org provisioning on first access"
```

---

### Task 6: Update rawProxy Scoping to Use Org Membership (apis)

**Repo:** `C:\Users\lippe\Repos\apis`

**Files:**
- Modify: `graphdl/raw-proxy.ts`
- Modify: `__tests__/raw-proxy-scoping.test.ts`

**Step 1: Update read scoping**

Replace domain tenant scoping with org-based scoping. Currently (line ~30):
```typescript
params.set('where[domain.tenant][equals]', email)
```

Change to use org IDs from `request.userOrgIds`:
```typescript
// For instance collections: scope by domain.organization membership
if (request.userOrgIds && request.userOrgIds.length > 0) {
  if (request.userOrgIds.length === 1) {
    params.set('where[domain.organization][equals]', request.userOrgIds[0])
  } else {
    request.userOrgIds.forEach((orgId, i) => {
      params.set(`where[domain.organization][in][${i}]`, orgId)
    })
  }
}
```

For domains/apps collection scoping, replace tenant check with org check:
```typescript
// Replace: where[or][0][tenant][equals] = email
// With: where[or][0][organization][in] = userOrgIds
```

**Step 2: Update write scoping**

Replace the domain ownership check (line ~103):
```typescript
// Old: if (domain.tenant !== email && domain.visibility !== 'public')
// New: check if domain.organization is in user's org list
const domainOrgId = typeof domain.organization === 'string'
  ? domain.organization
  : domain.organization?.id
if (!request.userOrgIds?.includes(domainOrgId) && domain.visibility !== 'public') {
  return { body: '', error: 'Forbidden: you are not a member of this domain\'s organization' }
}
```

For domains/apps creation, auto-set organization to user's first org:
```typescript
// Old: body.tenant = email
// New: body.organization = request.userOrgIds?.[0]
```

**Step 3: Update tests**

Update `__tests__/raw-proxy-scoping.test.ts` to test org-based scoping instead of tenant-based.

**Step 4: Run tests**

Run: `cd /c/Users/lippe/Repos/apis && yarn test`

**Step 5: Commit**

```bash
git add graphdl/raw-proxy.ts __tests__/raw-proxy-scoping.test.ts
git commit -m "feat: rawProxy scoping uses org membership instead of tenant email"
```

---

### Task 7: Migration Script (graphdl-orm)

**Repo:** `C:\Users\lippe\Repos\graphdl-orm`

**Files:**
- Create: `scripts/migrate-tenant-to-org.ts`

**Step 1: Write migration script**

```typescript
// scripts/migrate-tenant-to-org.ts
import { getPayload } from 'payload'
import config from '../src/payload.config'

async function migrate() {
  const payload = await getPayload({ config })

  // Find all unique tenant emails across domains
  const domains = await payload.find({
    collection: 'domains',
    pagination: false,
    where: { tenant: { exists: true } },
  })

  const tenantEmails = [...new Set(domains.docs.map(d => d.tenant).filter(Boolean))]
  console.log(`Found ${tenantEmails.length} unique tenants`)

  for (const email of tenantEmails) {
    const slug = email.replace(/[@.]/g, '-').toLowerCase()
    const name = email.split('@')[0]

    // Find-or-create organization (idempotent)
    let org = await payload.find({
      collection: 'organizations',
      where: { slug: { equals: slug } },
      limit: 1,
    })

    let orgId: string
    if (org.docs.length > 0) {
      orgId = org.docs[0].id
      console.log(`  Org exists: ${slug} (${orgId})`)
    } else {
      const created = await payload.create({
        collection: 'organizations',
        data: { slug, name: `${name}'s workspace` },
      })
      orgId = created.id
      console.log(`  Created org: ${slug} (${orgId})`)
    }

    // Find-or-create owner membership (idempotent)
    const membership = await payload.find({
      collection: 'org-memberships',
      where: {
        and: [
          { user: { equals: email } },
          { organization: { equals: orgId } },
        ],
      },
      limit: 1,
    })

    if (membership.docs.length === 0) {
      await payload.create({
        collection: 'org-memberships',
        data: { user: email, organization: orgId, role: 'owner' },
      })
      console.log(`  Created membership: ${email} -> ${slug}`)
    }

    // Update all domains for this tenant
    const tenantDomains = domains.docs.filter(d => d.tenant === email)
    for (const domain of tenantDomains) {
      if (!domain.organization) {
        await payload.update({
          collection: 'domains',
          id: domain.id,
          data: { organization: orgId },
        })
        console.log(`  Linked domain: ${domain.name || domain.domainSlug} -> ${slug}`)
      }
    }
  }

  // Same for apps
  const apps = await payload.find({
    collection: 'apps',
    pagination: false,
    where: { tenant: { exists: true } },
  })

  for (const app of apps.docs) {
    if (app.tenant && !app.organization) {
      const slug = app.tenant.replace(/[@.]/g, '-').toLowerCase()
      const org = await payload.find({
        collection: 'organizations',
        where: { slug: { equals: slug } },
        limit: 1,
      })
      if (org.docs.length > 0) {
        await payload.update({
          collection: 'apps',
          id: app.id,
          data: { organization: org.docs[0].id },
        })
        console.log(`  Linked app: ${app.name} -> ${slug}`)
      }
    }
  }

  console.log('Migration complete')
  process.exit(0)
}

migrate().catch(console.error)
```

**Step 2: Add script to package.json**

```json
"migrate:orgs": "tsx scripts/migrate-tenant-to-org.ts"
```

**Step 3: Commit**

```bash
git add scripts/migrate-tenant-to-org.ts package.json
git commit -m "feat: migration script to convert tenant emails to organizations"
```

---

### Task 8: Update Access Control Functions (graphdl-orm)

**Repo:** `C:\Users\lippe\Repos\graphdl-orm`

**Files:**
- Modify: `src/collections/shared/instanceAccess.ts`

**Step 1: Update access functions to check org membership**

The key change is replacing `tenant: { equals: email }` with an org membership check. Since Payload doesn't have join queries, the access functions need to:
1. Look up user's org memberships
2. Find org IDs
3. Filter by `organization: { in: orgIds }`

```typescript
// Helper: get user's org IDs
async function getUserOrgIds(req: any): Promise<string[]> {
  const email = req.user?.email
  if (!email) return []
  const memberships = await req.payload.find({
    collection: 'org-memberships',
    where: { user: { equals: email } },
    pagination: false,
    depth: 0,
  })
  return memberships.docs.map((m: any) =>
    typeof m.organization === 'string' ? m.organization : m.organization?.id
  ).filter(Boolean)
}
```

Update `domainReadAccess`:
```typescript
// Old: tenant: { equals: email } OR visibility: public
// New: organization: { in: orgIds } OR visibility: public
```

Update `domainWriteAccess`:
```typescript
// Old: tenant: { equals: email }
// New: organization: { in: orgIds }
```

Update `instanceReadAccess` and `instanceWriteAccess` similarly — replace `domain.tenant` with `domain.organization`.

**Step 2: Verify**

Run: `cd /c/Users/lippe/Repos/graphdl-orm && yarn build`

**Step 3: Commit**

```bash
git add src/collections/shared/instanceAccess.ts
git commit -m "feat: access control uses org membership instead of tenant email"
```

---

### Task 9: Deploy and Run Migration

**Step 1: Deploy graphdl-orm**

```bash
cd /c/Users/lippe/Repos/graphdl-orm && yarn deploy
```

**Step 2: Run migration**

```bash
yarn migrate:orgs
```

**Step 3: Deploy apis**

```bash
cd /c/Users/lippe/Repos/apis && npx wrangler deploy
```

**Step 4: Test in browser**

Navigate to `https://ui.auto.dev` — verify apps/domains still load for `cicd@repo.do`. The implicit org provisioning should create a personal org on first request.

**Step 5: Commit any fixes**

---

## Phase 2: Readings Folder

### Task 10: Extract Core Metamodel Readings (graphdl-orm)

**Repo:** `C:\Users\lippe\Repos\graphdl-orm`

**Files:**
- Create: `readings/core.md`

**Step 1: Extract readings from Payload collection field descriptions**

Read through each collection in `src/collections/` and extract the fact types expressed in field labels/descriptions. Cross-reference with the Core diagram at `design/Core.png`.

Write `readings/core.md`:

```markdown
# GraphDL Core — Schema-Level Entities

## Entity Types

| Entity | Reference Scheme |
|--------|-----------------|
| Domain | DomainSlug |
| Noun | Name (within Domain) |
| Reading | ReadingText (within Domain) |
| GraphSchema | Name (within Domain) |
| Constraint | (within Domain) |
| ConstraintSpan | (within Constraint) |
| Role | Name (within Domain) |
| Verb | Name |
| Function | Name |
| EventType | Name |
| Generator | (within Domain) |

## Value Types

| Value | Type | Constraints |
|-------|------|-------------|
| DomainSlug | string | unique |
| Name | string | |
| Description | string | |
| ReadingText | string | |
| ObjectType | string | enum: entity, value |
| Visibility | string | enum: private, public |
| Multiplicity | string | enum: one, many |
| OutputFormat | string | enum: openapi, payload, xstate, mermaid, ilayer, readings |
| ConstraintKind | string | |
| Modality | string | enum: alethic, deontic |

## Readings

Noun belongs to Domain.
  Each Noun belongs to at most one Domain.
Noun has Name.
  Each Noun has at most one Name.
Noun has ObjectType.
  Each Noun has at most one ObjectType.
Noun has Description.
  Each Noun has at most one Description.
Domain has DomainSlug.
  Each Domain has at most one DomainSlug.
  Each DomainSlug identifies at most one Domain.
Domain has Name.
  Each Domain has at most one Name.
Domain has Description.
  Each Domain has at most one Description.
Domain has Visibility.
  Each Domain has at most one Visibility.
Reading belongs to Domain.
  Each Reading belongs to at most one Domain.
Reading has ReadingText.
  Each Reading has at most one ReadingText.
Reading involves Noun as subject.
  Each Reading involves at most one Noun as subject.
Reading involves Noun as object.
  Each Reading involves at most one Noun as object.
Reading has Multiplicity as subjectMultiplicity.
  Each Reading has at most one Multiplicity as subjectMultiplicity.
Reading has Multiplicity as objectMultiplicity.
  Each Reading has at most one Multiplicity as objectMultiplicity.
GraphSchema belongs to Domain.
  Each GraphSchema belongs to at most one Domain.
GraphSchema has Name.
  Each GraphSchema has at most one Name.
Constraint belongs to Domain.
  Each Constraint belongs to at most one Domain.
Constraint has ConstraintKind.
  Each Constraint has at most one ConstraintKind.
Constraint has Modality.
  Each Constraint has at most one Modality.
ConstraintSpan belongs to Constraint.
  Each ConstraintSpan belongs to at most one Constraint.
Role belongs to Domain.
  Each Role belongs to at most one Domain.
Role has Name.
  Each Role has at most one Name.
Generator belongs to Domain.
  Each Generator belongs to at most one Domain.
Generator has OutputFormat.
  Each Generator has at most one OutputFormat.
```

**Step 2: Commit**

```bash
git add readings/core.md
git commit -m "docs: extract core metamodel readings from Payload collections"
```

---

### Task 11: State Machine and Instance Readings (graphdl-orm)

**Repo:** `C:\Users\lippe\Repos\graphdl-orm`

**Files:**
- Create: `readings/state.md`
- Create: `readings/instances.md`

**Step 1: Write state machine readings**

```markdown
# GraphDL State — Behavioral Entities

## Entity Types

| Entity | Reference Scheme |
|--------|-----------------|
| StateMachineDefinition | Title (within Domain) |
| Status | Name (within StateMachineDefinition) |
| Transition | (within StateMachineDefinition) |
| Guard | (within Transition) |

## Readings

StateMachineDefinition belongs to Domain.
  Each StateMachineDefinition belongs to at most one Domain.
StateMachineDefinition has Title.
  Each StateMachineDefinition has at most one Title.
StateMachineDefinition has Noun as subject.
  Each StateMachineDefinition has at most one Noun as subject.
Status belongs to StateMachineDefinition.
  Each Status belongs to at most one StateMachineDefinition.
Status has Name.
  Each Status has at most one Name.
Transition belongs to StateMachineDefinition.
  Each Transition belongs to at most one StateMachineDefinition.
Transition has Status as source.
  Each Transition has at most one Status as source.
Transition has Status as target.
  Each Transition has at most one Status as target.
Transition has EventType.
  Each Transition has at most one EventType.
Guard belongs to Transition.
  Each Guard belongs to at most one Transition.
Guard has Expression.
  Each Guard has at most one Expression.
```

**Step 2: Write instance readings**

```markdown
# GraphDL Instances — Runtime Entities

## Entity Types

| Entity | Reference Scheme |
|--------|-----------------|
| Graph | (within Domain) |
| Resource | (within Domain) |
| ResourceRole | (within Resource) |
| StateMachine | InstanceId (within Domain) |
| Event | (within StateMachine) |
| GuardRun | (within Event) |

## Readings

Graph belongs to Domain.
  Each Graph belongs to at most one Domain.
Resource belongs to Domain.
  Each Resource belongs to at most one Domain.
Resource has Noun as type.
  Each Resource has at most one Noun as type.
Resource has Value.
  Each Resource has at most one Value.
ResourceRole belongs to Resource.
  Each ResourceRole belongs to at most one Resource.
StateMachine belongs to Domain.
  Each StateMachine belongs to at most one Domain.
StateMachine has StateMachineDefinition as type.
  Each StateMachine has at most one StateMachineDefinition as type.
StateMachine has Status as currentStatus.
  Each StateMachine has at most one Status as currentStatus.
Event belongs to StateMachine.
  Each Event belongs to at most one StateMachine.
Event has EventType.
  Each Event has at most one EventType.
GuardRun belongs to Event.
  Each GuardRun belongs to at most one Event.
```

**Step 3: Commit**

```bash
git add readings/state.md readings/instances.md
git commit -m "docs: extract state machine and instance readings"
```

---

### Task 12: Organization and UI Readings (graphdl-orm)

**Repo:** `C:\Users\lippe\Repos\graphdl-orm`

**Files:**
- Create: `readings/organizations.md`
- Create: `readings/ui.md`

**Step 1: Write organization readings**

```markdown
# GraphDL Organizations — Access Control

## Entity Types

| Entity | Reference Scheme |
|--------|-----------------|
| Organization | OrgSlug |

## Value Types

| Value | Type | Constraints |
|-------|------|-------------|
| OrgSlug | string | unique |
| OrgRole | string | enum: owner, member |

## Readings

Organization has Name.
  Each Organization has at most one Name.
User has OrgRole in Organization — UC(User, Organization).
Domain belongs to Organization.
  Each Domain belongs to at most one Organization.
```

**Step 2: Write UI readings**

```markdown
# GraphDL UI — Presentation Layer

## Entity Types

| Entity | Reference Scheme |
|--------|-----------------|
| Dashboard | DashboardName |
| Section | SectionTitle |
| Widget | WidgetId |

## Value Types

| Value | Type | Constraints |
|-------|------|-------------|
| WidgetType | string | enum: link, field, status-summary, submission, streaming, remote-control |
| Position | number | |
| ColumnCount | number | |

## Readings

Dashboard has Section.
  Each Section belongs to at most one Dashboard.
Section has Title.
  Each Section has at most one Title.
Section has ColumnCount.
  Each Section has at most one ColumnCount.
Section has Position.
  Each Section has at most one Position.
Section has Widget.
  Each Widget belongs to at most one Section.
Widget has Position.
  Each Widget has at most one Position.
Widget has WidgetType.
  Each Widget has at most one WidgetType.
Widget references Entity.
  Each Widget references at most one Entity.
Widget references Field.
  Each Widget references at most one Field.
Widget references Layer.
  Each Widget references at most one Layer.
Widget targets Widget.
  Each Widget targets each Widget at most once.
```

**Step 3: Commit**

```bash
git add readings/organizations.md readings/ui.md
git commit -m "docs: add organization and UI readings"
```

---

### Task 13: Test Self-Ingestion via Claim Extractor

**Step 1: Concatenate readings into a single text block**

```bash
cat /c/Users/lippe/Repos/graphdl-orm/readings/*.md
```

**Step 2: Feed to claim extractor**

```bash
curl -s -X POST -H "X-API-Key: $AUTO_DEV_API_KEY" -H "Content-Type: application/json" \
  -d "{\"text\": \"$(cat /c/Users/lippe/Repos/graphdl-orm/readings/core.md | sed 's/"/\\"/g' | tr '\n' ' ')\"}" \
  "https://api.auto.dev/graphdl/extract/claims" | python3 -m json.tool | head -50
```

Verify the extractor produces structured claims matching the readings.

**Step 3: Bootstrap a graphdl domain (optional test)**

Use the bootstrap endpoint to create a "graphdl" app with the extracted claims. Verify nouns and readings are created correctly.

**Step 4: Commit any fixes**

---

## Phase 3: Master/Detail/Popover

### Task 14: Pane Layout System (ui.do)

**Repo:** `C:\Users\lippe\Repos\ui.do`

**Files:**
- Create: `src/layout/PaneLayout.tsx`
- Create: `src/layout/types.ts`
- Create: `src/layout/usePaneNavigation.ts`

**Step 1: Define pane types**

```typescript
// src/layout/types.ts
export type PaneType = 'master' | 'detail' | 'popover'

export interface PaneState {
  stack: string[]       // navigation history (addresses/view keys)
  current: string | null
}

export interface LayoutState {
  master: PaneState
  detail: PaneState
  popover: PaneState | null  // null = closed
}

export type PaneTarget = PaneType | 'auto'
// 'auto' = master links open in detail, detail links open in detail, etc.
```

**Step 2: Create the pane navigation hook**

```typescript
// src/layout/usePaneNavigation.ts
import { useState, useCallback } from 'react'
import type { LayoutState, PaneType } from './types'

const INITIAL_STATE: LayoutState = {
  master: { stack: [], current: null },
  detail: { stack: [], current: null },
  popover: null,
}

export function usePaneNavigation() {
  const [layout, setLayout] = useState<LayoutState>(INITIAL_STATE)

  const navigate = useCallback((address: string, target: PaneType = 'detail') => {
    setLayout(prev => {
      if (target === 'popover') {
        return {
          ...prev,
          popover: {
            stack: prev.popover ? [...prev.popover.stack, prev.popover.current!] : [],
            current: address,
          },
        }
      }
      const pane = prev[target]
      return {
        ...prev,
        [target]: {
          stack: pane.current ? [...pane.stack, pane.current] : pane.stack,
          current: address,
        },
      }
    })
  }, [])

  const goBack = useCallback((pane: PaneType) => {
    setLayout(prev => {
      if (pane === 'popover') {
        if (!prev.popover || prev.popover.stack.length === 0) {
          return { ...prev, popover: null }
        }
        const stack = [...prev.popover.stack]
        const current = stack.pop()!
        return { ...prev, popover: { stack, current } }
      }
      const p = prev[pane]
      if (p.stack.length === 0) return prev
      const stack = [...p.stack]
      const current = stack.pop()!
      return { ...prev, [pane]: { stack, current } }
    })
  }, [])

  const closePopover = useCallback(() => {
    setLayout(prev => ({ ...prev, popover: null }))
  }, [])

  return { layout, navigate, goBack, closePopover }
}
```

**Step 3: Create the pane layout component**

```typescript
// src/layout/PaneLayout.tsx
import { type ReactNode } from 'react'
import type { LayoutState } from './types'

interface PaneLayoutProps {
  layout: LayoutState
  renderMaster: () => ReactNode
  renderDetail: () => ReactNode
  renderPopover?: () => ReactNode
  onClosePopover: () => void
}

export function PaneLayout({
  layout,
  renderMaster,
  renderDetail,
  renderPopover,
  onClosePopover,
}: PaneLayoutProps) {
  const hasDetail = layout.detail.current !== null
  const hasPopover = layout.popover !== null

  return (
    <div className="flex h-full overflow-hidden">
      {/* Master pane */}
      <div className={`
        ${hasDetail ? 'hidden md:flex' : 'flex'}
        flex-col w-full md:w-80 lg:w-96 border-r border-border shrink-0
      `}>
        {renderMaster()}
      </div>

      {/* Detail pane */}
      {hasDetail && (
        <div className="flex flex-col flex-1 min-w-0">
          {renderDetail()}
        </div>
      )}

      {/* Popover pane */}
      {hasPopover && renderPopover && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={onClosePopover}
          />
          <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-auto m-4">
            {renderPopover()}
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 4: Create barrel export**

```typescript
// src/layout/index.ts
export { PaneLayout } from './PaneLayout'
export { usePaneNavigation } from './usePaneNavigation'
export type { PaneType, PaneState, LayoutState, PaneTarget } from './types'
```

**Step 5: Verify build**

Run: `cd /c/Users/lippe/Repos/ui.do && npx vite build`

**Step 6: Commit**

```bash
git add src/layout/
git commit -m "feat: add master/detail/popover pane layout system"
```

---

### Task 15: Integrate Pane Layout into App.tsx (ui.do)

**Repo:** `C:\Users\lippe\Repos\ui.do`

**Files:**
- Modify: `src/App.tsx`

**Step 1: Replace current sidebar+main layout with PaneLayout**

The current App.tsx has an informal master/detail:
- Sidebar (sidebar div) = master
- Main content area = detail

Refactor to use `PaneLayout` + `usePaneNavigation`:
- Master pane: sidebar (entity list for current domain)
- Detail pane: current view (DashboardView, EntityListView, SchemaView, etc.)
- Popover pane: used by WidgetPicker, relationship pickers, confirmations

Wire the `navigate` function from `usePaneNavigation` into the `NavigationContext` so all layer navigation targets the correct pane.

**Step 2: Verify build and manual test**

Run: `cd /c/Users/lippe/Repos/ui.do && npx vite build`

**Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: integrate pane layout system into App"
```

---

## Phase 4: Chat & Streaming

### Task 16: SSE Streaming Support in API Client (ui.do)

**Repo:** `C:\Users\lippe\Repos\ui.do`

**Files:**
- Modify: `src/api.ts`

**Step 1: Add streaming chat function**

```typescript
/**
 * Send a chat message and stream the response via fetch ReadableStream.
 * Calls the support agent or /ai/chat endpoint.
 */
export async function streamChat(
  endpoint: string,
  body: Record<string, unknown>,
  onChunk: (text: string) => void,
  onDone: (fullResponse: any) => void,
  onError: (error: Error) => void,
): Promise<void> {
  try {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      throw new Error(`Chat request failed: ${res.status}`)
    }

    const reader = res.body?.getReader()
    if (!reader) {
      // Non-streaming fallback: parse full JSON response
      const data = await res.json()
      onDone(data)
      return
    }

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') {
            onDone({})
            return
          }
          try {
            const parsed = JSON.parse(data)
            if (parsed.content) onChunk(parsed.content)
            if (parsed.done) onDone(parsed)
          } catch {
            onChunk(data)
          }
        }
      }
    }

    onDone({})
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)))
  }
}
```

**Step 2: Verify build**

Run: `cd /c/Users/lippe/Repos/ui.do && npx vite build`

**Step 3: Commit**

```bash
git add src/api.ts
git commit -m "feat: add SSE streaming support to API client"
```

---

### Task 17: Chat Component (ui.do)

**Repo:** `C:\Users\lippe\Repos\ui.do`

**Files:**
- Create: `src/components/controls/ChatStreamControl.tsx`
- Modify: `src/components/converter.ts`

**Step 1: Create streaming chat control**

Reference implementation: `C:\Users\lippe\Repos\chat.auto.dev\src\components\MessageBubble.tsx` and `ChatInput.tsx`.

```typescript
// src/components/controls/ChatStreamControl.tsx
import { useState, useRef, useEffect, useCallback } from 'react'
import { streamChat } from '../../api'
import { Markdown } from '../Markdown'
import type { ILayerField } from '../../types'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export function ChatStreamControl({ field }: { field: ILayerField }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const endpoint = field.link?.address || '/ai/chat'

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const send = useCallback(() => {
    if (!input.trim() || streaming) return

    const userMsg: ChatMessage = { role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setStreaming(true)
    setStreamingContent('')

    const allMessages = [...messages, userMsg].map(m => ({
      role: m.role,
      content: m.content,
    }))

    streamChat(
      endpoint,
      { messages: allMessages, ...field.submitKey ? { [field.submitKey]: input.trim() } : {} },
      (chunk) => setStreamingContent(prev => prev + chunk),
      () => {
        setStreamingContent(prev => {
          if (prev) {
            setMessages(msgs => [...msgs, { role: 'assistant', content: prev }])
          }
          return ''
        })
        setStreaming(false)
      },
      (error) => {
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error.message}` }])
        setStreaming(false)
        setStreamingContent('')
      },
    )
  }, [input, streaming, messages, endpoint, field.submitKey])

  return (
    <div className="flex flex-col h-full min-h-[400px]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
              msg.role === 'user'
                ? 'bg-primary-600 text-white rounded-br-md'
                : 'bg-card border border-border rounded-bl-md'
            }`}>
              {msg.role === 'user' ? msg.content : <Markdown content={msg.content} />}
            </div>
          </div>
        ))}
        {streaming && streamingContent && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl px-4 py-2 bg-card border border-border rounded-bl-md">
              <Markdown content={streamingContent} />
            </div>
          </div>
        )}
        {streaming && !streamingContent && (
          <div className="flex justify-start">
            <div className="px-4 py-2 text-muted-foreground animate-pulse">Thinking...</div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder={field.placeholder || 'Type a message...'}
          disabled={streaming}
          className="flex-1 bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button
          onClick={send}
          disabled={streaming || !input.trim()}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-primary-700 transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  )
}
```

**Step 2: Register in converter**

In `src/components/converter.ts`, add import and registration:

```typescript
import { ChatStreamControl } from './controls/ChatStreamControl'

// In defaultRegistry:
'chat-stream': ChatStreamControl,
```

**Step 3: Verify build**

Run: `cd /c/Users/lippe/Repos/ui.do && npx vite build`

**Step 4: Commit**

```bash
git add src/components/controls/ChatStreamControl.tsx src/components/converter.ts
git commit -m "feat: add streaming chat control component"
```

---

### Task 18: Wire Streaming Widget Type (ui.do)

**Repo:** `C:\Users\lippe\Repos\ui.do`

**Files:**
- Modify: `src/dashboard/WidgetRenderer.tsx`

**Step 1: Handle streaming widget type**

In `WidgetRenderer.tsx`, the `streaming` widget type currently falls through to the generic field resolution. Update it to render a `ChatStreamControl` when the widget type is `streaming`:

```typescript
if (widget.widgetType === 'streaming') {
  const syntheticField: ILayerField = {
    id: widget.id,
    label: widget.entity,
    type: 'chat-stream' as FieldType,
    placeholder: `Chat with ${widget.entity}...`,
    link: widget.field ? { address: widget.field } : undefined,
  }
  const Control = registry['chat-stream'] || registry['chat']
  if (Control) {
    return (
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Control field={syntheticField} />
      </div>
    )
  }
}
```

**Step 2: Verify build**

Run: `cd /c/Users/lippe/Repos/ui.do && npx vite build`

**Step 3: Commit**

```bash
git add src/dashboard/WidgetRenderer.tsx
git commit -m "feat: wire streaming widget type to ChatStreamControl"
```

---

### Task 19: Deploy and E2E Test

**Step 1: Deploy ui.do**

```bash
cd /c/Users/lippe/Repos/ui.do && npx vite build && npx wrangler pages deploy dist --project-name ui-do
```

**Step 2: Test in browser**

- Verify org provisioning: sign in, check that personal org is created
- Verify domain access: apps/domains load correctly with org-based scoping
- Test pane layout: master (sidebar), detail (content), responsive behavior
- Test chat: add a streaming widget to a dashboard section, verify chat renders

**Step 3: Commit any fixes**

---

### Task 20: Remove Tenant Field (graphdl-orm) — Final Cleanup

**Repo:** `C:\Users\lippe\Repos\graphdl-orm`

**Only do this after verifying org-based access works end-to-end.**

**Files:**
- Modify: `src/collections/Domains.ts` — remove `tenant` field
- Modify: `src/collections/Apps.ts` — remove `tenant` field
- Modify: `src/collections/shared/instanceAccess.ts` — remove any remaining tenant references

**Step 1: Remove tenant fields**

**Step 2: Verify build**

Run: `cd /c/Users/lippe/Repos/graphdl-orm && yarn build`

**Step 3: Deploy and verify**

```bash
yarn deploy
```

**Step 4: Commit**

```bash
git add src/collections/Domains.ts src/collections/Apps.ts src/collections/shared/instanceAccess.ts
git commit -m "cleanup: remove deprecated tenant field (replaced by organization)"
```
