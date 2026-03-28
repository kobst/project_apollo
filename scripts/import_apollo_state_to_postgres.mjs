import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import pg from 'pg';

const { Client } = pg;

const dataDir = process.env.APOLLO_DATA_DIR || path.join(os.homedir(), '.apollo');
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const storiesDir = path.join(dataDir, 'stories');

async function readJson(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

async function importStory(client, storyId, state) {
  await client.query('BEGIN');
  try {
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

    await client.query('delete from story_branches where story_id = $1', [storyId]);

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

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  const entries = await fs.readdir(storiesDir, { withFileTypes: true }).catch(() => []);
  let imported = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const storyId = entry.name;
    const statePath = path.join(storiesDir, storyId, 'state.json');

    try {
      const state = await readJson(statePath);
      if (!state.history) {
        console.warn(`Skipping non-versioned story ${storyId}`);
        continue;
      }
      await importStory(client, storyId, state);
      imported++;
      console.log(`Imported ${storyId}`);
    } catch (error) {
      console.error(`Failed to import ${storyId}:`, error);
    }
  }

  await client.end();
  console.log(`Imported ${imported} stories from ${storiesDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
