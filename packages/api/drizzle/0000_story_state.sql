CREATE TABLE IF NOT EXISTS stories (
  id text PRIMARY KEY,
  name text,
  metadata jsonb,
  current_branch text,
  current_version_id text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS story_versions (
  id text PRIMARY KEY,
  story_id text NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  parent_version_id text REFERENCES story_versions(id) DEFERRABLE INITIALLY DEFERRED,
  label text NOT NULL,
  graph jsonb NOT NULL,
  enrichment_summary text,
  package_title text,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS story_branches (
  story_id text NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  name text NOT NULL,
  head_version_id text NOT NULL REFERENCES story_versions(id) ON DELETE CASCADE,
  description text,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (story_id, name)
);

CREATE INDEX IF NOT EXISTS story_versions_story_created_idx
  ON story_versions (story_id, created_at DESC);

CREATE INDEX IF NOT EXISTS story_versions_story_parent_idx
  ON story_versions (story_id, parent_version_id);

CREATE INDEX IF NOT EXISTS story_branches_story_idx
  ON story_branches (story_id);
