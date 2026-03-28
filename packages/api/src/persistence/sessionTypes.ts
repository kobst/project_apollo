import type { Patch } from '@apollo/core';
import type { ai } from '@apollo/core';

export interface ExtractionProposal {
  id: string;
  title: string;
  description: string;
  confidence: number;
  extractedEntities: Array<{
    type: string;
    name: string;
    id: string;
  }>;
  patch: Patch;
}

export interface SessionState {
  lastSeeds?: Record<string, number>;
  extractionProposals?: ExtractionProposal[];
}

export type GenerationEntryPointType =
  | 'beat'
  | 'plotPoint'
  | 'character'
  | 'gap'
  | 'idea'
  | 'naked';

export interface GenerationEntryPoint {
  type: GenerationEntryPointType;
  targetId?: string;
  targetData?: Record<string, unknown>;
}

export interface GenerationSessionParams {
  depth: ai.GenerationDepth;
  count: ai.GenerationCount;
  direction?: string;
}

export interface GenerationSession {
  id: string;
  storyId: string;
  createdAt: string;
  updatedAt: string;
  entryPoint: GenerationEntryPoint;
  initialParams: GenerationSessionParams;
  sourceVersionId?: string;
  sourceVersionLabel?: string;
  packages: ai.NarrativePackage[];
  packageContext?: Record<string, { includedIdeaIds?: string[] }>;
  currentPackageId?: string;
  status: 'active' | 'accepted' | 'abandoned';
  acceptedPackageId?: string;
  archivedAt?: string;
}

export interface IdeaRefinementVariant {
  id: string;
  kind?: 'proposal' | 'question' | 'direction' | 'constraint' | 'note';
  title: string;
  description: string;
  resolution?: string;
  confidence?: number;
  suggestedArtifacts?: Array<{
    type: 'PlotPoint' | 'Scene';
    title: string;
    summary?: string;
    rationale?: string;
  }>;
}

export interface IdeaRefinementSession {
  id: string;
  storyId: string;
  ideaId: string;
  guidance: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'committed' | 'abandoned';
  variants: IdeaRefinementVariant[];
  committedVariantIndex?: number;
}
