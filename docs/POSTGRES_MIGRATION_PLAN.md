# Postgres Migration Plan

**Date:** 2026-03-28  
**Status:** In Progress  

## 1. Goal

Move Apollo from local filesystem persistence to Postgres for long-term durability, stronger data integrity, easier hosting, and a cleaner path to multi-user behavior.

The current API persists JSON files under `APOLLO_DATA_DIR`, primarily through:
- `packages/api/src/storage.ts`
- `packages/api/src/session.ts`
- `packages/api/src/savedPackages.ts`
- `packages/api/src/handlers/agents.ts`

The migration should preserve existing story/version/session semantics while replacing the storage layer incrementally instead of rewriting the backend in one pass.

## 2. Current Persistence Model

Apollo currently stores:
- Versioned story graph state in `stories/<story-id>/state.json`
- Per-story working session state in `stories/<story-id>/session.json`
- Active generation session in `stories/<story-id>/generation-session.json`
- Idea refinement sessions in `stories/<story-id>/idea-refine/*.json`
- Saved packages in `stories/<story-id>/saved-packages.json`
- Agent job persistence in `agents/jobs.json`

Important behavioral characteristics to preserve:
- Story state is versioned
- Branches point to version heads
- One current version is selected per story
- Generation sessions are story-scoped and package-oriented
- AI payloads are flexible and change shape over time
- Existing application-generated IDs should remain stable through migration

## 3. Target Postgres Model

Use relational tables for identity, references, indexing, and history. Use `jsonb` for graph payloads and AI-shaped artifacts that should stay flexible.

### 3.1 Core Tables

`stories`
- `id text primary key`
- `name text null`
- `metadata jsonb null`
- `current_branch text null`
- `current_version_id text null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

`story_versions`
- `id text primary key`
- `story_id text not null references stories(id)`
- `parent_version_id text null references story_versions(id)`
- `label text not null`
- `graph jsonb not null`
- `enrichment_summary text null`
- `package_title text null`
- `created_at timestamptz not null`

`story_branches`
- `story_id text not null references stories(id)`
- `name text not null`
- `head_version_id text not null references story_versions(id)`
- `description text null`
- `created_at timestamptz not null`
- `primary key (story_id, name)`

`story_sessions`
- `story_id text primary key references stories(id)`
- `last_seeds jsonb null`
- `extraction_proposals jsonb null`
- `updated_at timestamptz not null`

`generation_sessions`
- `id text primary key`
- `story_id text not null references stories(id)`
- `entry_point jsonb not null`
- `initial_params jsonb not null`
- `source_version_id text null references story_versions(id)`
- `source_version_label text null`
- `current_package_id text null`
- `status text not null`
- `accepted_package_id text null`
- `archived_at timestamptz null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

`generation_session_packages`
- `id text primary key`
- `session_id text not null references generation_sessions(id)`
- `story_id text not null references stories(id)`
- `package_data jsonb not null`
- `package_context jsonb null`
- `parent_package_id text null`
- `sort_order integer not null`
- `created_at timestamptz not null`

`idea_refinement_sessions`
- `id text primary key`
- `story_id text not null references stories(id)`
- `idea_id text not null`
- `guidance text not null`
- `status text not null`
- `variants jsonb not null`
- `committed_variant_index integer null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- `unique (story_id, idea_id)`

`saved_packages`
- `id text primary key`
- `story_id text not null references stories(id)`
- `source_version_id text not null references story_versions(id)`
- `source_version_label text not null`
- `package_data jsonb not null`
- `user_note text null`
- `saved_at timestamptz not null`

`agent_jobs`
- `id text primary key`
- `story_id text not null references stories(id)`
- `agent text not null`
- `params jsonb null`
- `status text not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

`agent_job_events`
- `id bigserial primary key`
- `job_id text not null references agent_jobs(id)`
- `event_type text not null`
- `event_data jsonb not null`
- `created_at timestamptz not null`

## 4. Design Choices

### 4.1 Why Postgres

Postgres is the preferred long-term backend because Apollo is likely to need:
- stronger integrity guarantees than file storage
- safer concurrent access
- richer querying across stories, versions, branches, packages, and jobs
- easier backups and operational tooling
- a foundation for users, permissions, and analytics

### 4.2 Why Not Fully Normalize Graph Data Immediately

The current code stores whole story graphs per version as JSON. That maps naturally to `jsonb` and avoids a large schema and rewrite cost during the initial migration.

Phase 1 should store version graphs as `jsonb`.

Phase 2 can add derived relational tables for nodes and edges if future product needs justify them:
- `story_nodes`
- `story_edges`
- `version_node_snapshots`
- `version_edge_snapshots`

## 5. Incremental Implementation Strategy

### Phase 1: Introduce Persistence Boundaries

Create repository interfaces so the application no longer couples domain logic directly to filesystem I/O.

Initial scope:
- story state
- versions
- branches

Follow-up scope:
- sessions
- generation sessions
- saved packages
- agent jobs/events

Filesystem remains the active implementation during this phase.

### Phase 2: Add Postgres Infrastructure

Add:
- connection management
- migration tooling
- schema definitions
- a Postgres-backed repository implementation

Recommended tooling:
- `pg` or `postgres` for DB access
- `drizzle` for schema and migrations

### Phase 3: Import Existing Data

Write a one-time importer from the current `APOLLO_DATA_DIR`.

Import sources:
- `state.json`
- `session.json`
- `generation-session.json`
- `saved-packages.json`
- `idea-refine/*.json`
- `agents/jobs.json`

Importer requirements:
- preserve IDs
- preserve timestamps
- preserve parent-child version relationships
- preserve branch heads and current version selection

### Phase 4: Dual Verification

Before cutover, validate that filesystem-backed and Postgres-backed reads agree on:
- story list ordering
- current graph contents
- version history
- branch state
- active generation session
- saved packages

### Phase 5: Cutover

Cut over in stages:
1. Postgres reads in development
2. Postgres writes in development
3. Staging import and verification
4. Production import
5. Production cutover

Keep filesystem fallback only briefly during verification. Remove it once confidence is high.

## 6. Initial Code Refactor Sequence

The first implementation slice should be intentionally small:

1. Extract story/version/branch types into a persistence module
2. Add a story state repository interface
3. Move filesystem story I/O behind that interface
4. Keep `storage.ts` responsible for domain logic only
5. Add tests around the repository boundary
6. Repeat the pattern for sessions, saved packages, and agent jobs

This keeps current behavior stable while opening a path for a Postgres implementation.

## 7. Immediate Next Steps

1. Document this plan in-repo
2. Introduce the first repository boundary for story state
3. Keep filesystem as the default implementation
4. Add Postgres scaffolding after the interface boundary is in place
5. Implement an importer from `.apollo` once core Postgres repositories exist
