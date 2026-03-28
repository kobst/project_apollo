import type { PoolClient } from 'pg';
import { getPostgresPool } from '../db/client.js';
import type { StorageContext } from '../config.js';
import type {
  Branch,
  StoredState,
  StoredVersion,
  VersionedState,
} from './storyStateTypes.js';
import type { StoryStateRepository } from './storyStateRepository.js';

interface StoryRow {
  id: string;
  metadata: unknown;
  created_at: Date | string;
  updated_at: Date | string;
  current_branch: string | null;
  current_version_id: string | null;
}

interface StoryVersionRow {
  id: string;
  parent_version_id: string | null;
  label: string;
  graph: unknown;
  enrichment_summary: string | null;
  package_title: string | null;
  created_at: Date | string;
}

interface StoryBranchRow {
  name: string;
  head_version_id: string;
  description: string | null;
  created_at: Date | string;
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toStoredVersion(row: StoryVersionRow): StoredVersion {
  return {
    id: row.id,
    parent_id: row.parent_version_id,
    label: row.label,
    created_at: toIsoString(row.created_at),
    graph: row.graph as StoredVersion['graph'],
    ...(row.enrichment_summary ? { enrichmentSummary: row.enrichment_summary } : {}),
    ...(row.package_title ? { packageTitle: row.package_title } : {}),
  };
}

function toBranch(row: StoryBranchRow): Branch {
  return {
    name: row.name,
    headVersionId: row.head_version_id,
    createdAt: toIsoString(row.created_at),
    ...(row.description ? { description: row.description } : {}),
  };
}

export class PostgresStoryStateRepository implements StoryStateRepository {
  async storyExists(storyId: string, _ctx: StorageContext): Promise<boolean> {
    const pool = getPostgresPool();
    const result = await pool.query('select 1 from stories where id = $1 limit 1', [storyId]);
    return (result.rowCount ?? 0) > 0;
  }

  async listStoryIds(_ctx: StorageContext): Promise<string[]> {
    const pool = getPostgresPool();
    const result = await pool.query<{ id: string }>(
      'select id from stories order by updated_at desc'
    );
    return result.rows.map((row) => row.id);
  }

  async loadState(storyId: string, _ctx: StorageContext): Promise<StoredState | null> {
    const pool = getPostgresPool();
    const storyResult = await pool.query<StoryRow>(
      `
        select id, metadata, created_at, updated_at, current_branch, current_version_id
        from stories
        where id = $1
      `,
      [storyId]
    );

    const story = storyResult.rows[0];
    if (!story || !story.current_version_id) {
      return null;
    }

    const versionsResult = await pool.query<StoryVersionRow>(
      `
        select id, parent_version_id, label, graph, enrichment_summary, package_title, created_at
        from story_versions
        where story_id = $1
      `,
      [storyId]
    );

    const branchesResult = await pool.query<StoryBranchRow>(
      `
        select name, head_version_id, description, created_at
        from story_branches
        where story_id = $1
      `,
      [storyId]
    );

    const versions = Object.fromEntries(
      versionsResult.rows.map((row) => [row.id, toStoredVersion(row)])
    );
    const branches = Object.fromEntries(
      branchesResult.rows.map((row) => [row.name, toBranch(row)])
    );

    const state: VersionedState = {
      version: '3.0.0',
      storyId: story.id,
      createdAt: toIsoString(story.created_at),
      updatedAt: toIsoString(story.updated_at),
      history: {
        versions,
        branches,
        currentBranch: story.current_branch,
        currentVersionId: story.current_version_id,
      },
    };

    if (story.metadata !== null && story.metadata !== undefined) {
      state.metadata = story.metadata as NonNullable<VersionedState['metadata']>;
    }

    return state;
  }

  async saveVersionedState(
    storyId: string,
    state: VersionedState,
    _ctx: StorageContext
  ): Promise<void> {
    const pool = getPostgresPool();
    const client = await pool.connect();

    try {
      await client.query('begin');
      await this.upsertStory(client, storyId, state);
      await this.upsertVersions(client, storyId, state);
      await client.query('delete from story_branches where story_id = $1', [storyId]);
      await this.insertBranches(client, storyId, state);
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  private async upsertStory(
    client: PoolClient,
    storyId: string,
    state: VersionedState
  ): Promise<void> {
    await client.query(
      `
        insert into stories (
          id, name, metadata, current_branch, current_version_id, created_at, updated_at
        ) values ($1, $2, $3::jsonb, $4, $5, $6::timestamptz, $7::timestamptz)
        on conflict (id) do update
        set
          name = excluded.name,
          metadata = excluded.metadata,
          current_branch = excluded.current_branch,
          current_version_id = excluded.current_version_id,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at
      `,
      [
        storyId,
        state.metadata?.name ?? null,
        JSON.stringify(state.metadata ?? null),
        state.history.currentBranch,
        state.history.currentVersionId,
        state.createdAt,
        state.updatedAt,
      ]
    );
  }

  private async upsertVersions(
    client: PoolClient,
    storyId: string,
    state: VersionedState
  ): Promise<void> {
    const versions = Object.values(state.history.versions).sort((a, b) =>
      a.created_at.localeCompare(b.created_at)
    );

    for (const version of versions) {
      await client.query(
        `
          insert into story_versions (
            id, story_id, parent_version_id, label, graph, enrichment_summary, package_title, created_at
          ) values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8::timestamptz)
          on conflict (id) do update
          set
            story_id = excluded.story_id,
            parent_version_id = excluded.parent_version_id,
            label = excluded.label,
            graph = excluded.graph,
            enrichment_summary = excluded.enrichment_summary,
            package_title = excluded.package_title,
            created_at = excluded.created_at
        `,
        [
          version.id,
          storyId,
          version.parent_id,
          version.label,
          JSON.stringify(version.graph),
          version.enrichmentSummary ?? null,
          version.packageTitle ?? null,
          version.created_at,
        ]
      );
    }
  }

  private async insertBranches(
    client: PoolClient,
    storyId: string,
    state: VersionedState
  ): Promise<void> {
    for (const branch of Object.values(state.history.branches)) {
      await client.query(
        `
          insert into story_branches (
            story_id, name, head_version_id, description, created_at
          ) values ($1, $2, $3, $4, $5::timestamptz)
        `,
        [
          storyId,
          branch.name,
          branch.headVersionId,
          branch.description ?? null,
          branch.createdAt,
        ]
      );
    }
  }
}
