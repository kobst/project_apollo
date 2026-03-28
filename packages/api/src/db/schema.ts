import {
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const stories = pgTable('stories', {
  id: text('id').primaryKey(),
  name: text('name'),
  metadata: jsonb('metadata'),
  currentBranch: text('current_branch'),
  currentVersionId: text('current_version_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

export const storyVersions = pgTable('story_versions', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull().references(() => stories.id, { onDelete: 'cascade' }),
  parentVersionId: text('parent_version_id'),
  label: text('label').notNull(),
  graph: jsonb('graph').notNull(),
  enrichmentSummary: text('enrichment_summary'),
  packageTitle: text('package_title'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});

export const storyBranches = pgTable(
  'story_branches',
  {
    storyId: text('story_id').notNull().references(() => stories.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    headVersionId: text('head_version_id').notNull().references(() => storyVersions.id, { onDelete: 'cascade' }),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.storyId, table.name] }),
  })
);
