import type { ai } from '@apollo/core';

export interface SavedPackage {
  id: string;
  storyId: string;
  package: ai.NarrativePackage;
  sourceVersionId: string;
  sourceVersionLabel: string;
  savedAt: string;
  userNote?: string;
}

export interface PackageCompatibility {
  status: 'compatible' | 'outdated' | 'conflicting';
  currentVersionId: string;
  currentVersionLabel: string;
  versionsBehind: number;
  conflicts: CompatibilityConflict[];
}

export interface CompatibilityConflict {
  type: 'node_deleted' | 'node_modified' | 'edge_deleted';
  nodeId?: string;
  edgeId?: string;
  description: string;
}

export interface SavedPackageWithCompatibility extends SavedPackage {
  compatibility: PackageCompatibility;
}

export interface SavedPackagesState {
  version: '1.0.0';
  packages: SavedPackage[];
}
