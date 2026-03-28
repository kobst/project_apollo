import type { GraphState, KGNode, Edge, StoryContext } from '@apollo/core';

export interface SerializedGraph {
  nodes: Record<string, KGNode>;
  edges: Edge[];
}

export interface StoryMetadata {
  name?: string;
  storyContext?: StoryContext;
  storyContextModifiedAt?: string;
}

export interface StoredVersion {
  id: string;
  parent_id: string | null;
  label: string;
  created_at: string;
  graph: SerializedGraph;
  enrichmentSummary?: string;
  packageTitle?: string;
}

export interface Branch {
  name: string;
  headVersionId: string;
  createdAt: string;
  description?: string;
}

export interface VersionHistory {
  versions: Record<string, StoredVersion>;
  branches: Record<string, Branch>;
  currentBranch: string | null;
  currentVersionId: string;
}

export interface PersistedState {
  version: string;
  storyId: string;
  storyVersionId: string;
  createdAt: string;
  updatedAt: string;
  graph: SerializedGraph;
  metadata?: StoryMetadata;
}

export interface VersionedState {
  version: string;
  storyId: string;
  createdAt: string;
  updatedAt: string;
  metadata?: StoryMetadata;
  history: VersionHistory;
}

export type StoredState = PersistedState | VersionedState;

export interface StoryInfo {
  id: string;
  name?: string;
  updatedAt: string;
}

export interface VersionInfo {
  id: string;
  label: string;
  parent_id: string | null;
  created_at: string;
  isCurrent: boolean;
  branch?: string;
  enrichmentSummary?: string;
  packageTitle?: string;
}

export interface BranchInfo {
  name: string;
  headVersionId: string;
  createdAt: string;
  description?: string;
  isCurrent: boolean;
}

export function isVersionedState(state: StoredState): state is VersionedState {
  return 'history' in state && state.history !== undefined;
}

export type { GraphState };
