/**
 * API client for Apollo backend
 */

import type {
  APIResponse,
  StatusData,
  OpenQuestionsData,
  ClusterData,
  ClusterRequest,
  PreviewData,
  AcceptData,
  DiffData,
  LogData,
  InitRequest,
  InitData,
  ListStoriesData,
  NodesListData,
  NodeData,
  NodeRelationsData,
  UpdateNodeData,
  DeleteNodeData,
  ConnectedNodesData,
  OutlineData,
  ExtractData,
  ExtractRequest,
  ExtractPreviewData,
  ExtractAcceptData,
  EdgesListData,
  EdgeData,
  EdgeMutationData,
  BatchEdgeResult,
  UpsertEdgeResult,
  EdgeFilters,
  CreateEdgeRequest,
  UpdateEdgeRequest,
  BatchEdgeRequest,
  LintData,
  LintRequest,
  ApplyFixData,
  ApplyFixRequest,
  PreCommitLintData,
  BulkAttachRequest,
  BulkAttachData,
  PlotPointData,
  PlotPointsListData,
  CreatePlotPointRequest,
  CreatePlotPointData,
  UpdatePlotPointData,
  DeletePlotPointData,
  PlotPointFilters,
} from './types';

const API_BASE = '/api';

class ApiError extends Error {
  constructor(
    message: string,
    public suggestion?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = (await response.json()) as APIResponse<T>;

  if (!data.success) {
    throw new ApiError(data.error ?? 'Unknown error', data.suggestion);
  }

  return data.data as T;
}

function GET<T>(path: string): Promise<T> {
  return request<T>('GET', path);
}

function POST<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('POST', path, body);
}

function PATCH<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('PATCH', path, body);
}

function DELETE<T>(path: string): Promise<T> {
  return request<T>('DELETE', path);
}

export const api = {
  // Stories
  listStories: () => GET<ListStoriesData>('/stories'),
  createStory: (data: InitRequest) => POST<InitData>('/stories/init', data),
  getStatus: (id: string) => GET<StatusData>(`/stories/${id}/status`),

  // Open Questions
  getOpenQuestions: (id: string) =>
    GET<OpenQuestionsData>(`/stories/${id}/open-questions`),

  // Clusters
  generateCluster: (id: string, data: ClusterRequest) =>
    POST<ClusterData>(`/stories/${id}/clusters`, data),

  // Moves
  previewMove: (storyId: string, moveId: string) =>
    GET<PreviewData>(`/stories/${storyId}/moves/${moveId}/preview`),
  acceptMoves: (id: string, moveIds: string[]) =>
    POST<AcceptData>(`/stories/${id}/accept`, { moveIds }),

  // Version History
  getDiff: (id: string, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const query = params.toString();
    return GET<DiffData>(`/stories/${id}/diff${query ? `?${query}` : ''}`);
  },
  getLog: (id: string, limit?: number) => {
    const query = limit ? `?limit=${limit}` : '';
    return GET<LogData>(`/stories/${id}/log${query}`);
  },

  // Node browsing and editing
  listNodes: (id: string, type?: string, limit?: number, offset?: number) => {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (limit) params.set('limit', limit.toString());
    if (offset) params.set('offset', offset.toString());
    const query = params.toString();
    return GET<NodesListData>(`/stories/${id}/nodes${query ? `?${query}` : ''}`);
  },
  getNode: (storyId: string, nodeId: string) =>
    GET<NodeData>(`/stories/${storyId}/nodes/${nodeId}`),
  getNodeRelations: (storyId: string, nodeId: string) =>
    GET<NodeRelationsData>(`/stories/${storyId}/nodes/${nodeId}/relations`),
  getConnectedNodes: (storyId: string, nodeId: string) =>
    GET<ConnectedNodesData>(`/stories/${storyId}/nodes/${nodeId}/connected`),
  updateNode: (storyId: string, nodeId: string, changes: Record<string, unknown>) =>
    PATCH<UpdateNodeData>(`/stories/${storyId}/nodes/${nodeId}`, { changes }),
  deleteNode: (storyId: string, nodeId: string) =>
    DELETE<DeleteNodeData>(`/stories/${storyId}/nodes/${nodeId}`),

  // Outline
  getOutline: (id: string) => GET<OutlineData>(`/stories/${id}/outline`),

  // Extraction
  extract: (id: string, data: ExtractRequest) =>
    POST<ExtractData>(`/stories/${id}/extract`, data),
  previewExtract: (storyId: string, proposalId: string) =>
    GET<ExtractPreviewData>(`/stories/${storyId}/extract/${proposalId}/preview`),
  acceptExtract: (storyId: string, proposalId: string) =>
    POST<ExtractAcceptData>(`/stories/${storyId}/extract/${proposalId}/accept`),

  // Edge CRUD (Phase D)
  listEdges: (storyId: string, filters?: EdgeFilters) => {
    const params = new URLSearchParams();
    if (filters?.type) params.set('type', filters.type);
    if (filters?.from) params.set('from', filters.from);
    if (filters?.to) params.set('to', filters.to);
    if (filters?.status) params.set('status', filters.status);
    const query = params.toString();
    return GET<EdgesListData>(`/stories/${storyId}/edges${query ? `?${query}` : ''}`);
  },
  getEdge: (storyId: string, edgeId: string) =>
    GET<EdgeData>(`/stories/${storyId}/edges/${edgeId}`),
  createEdge: (storyId: string, data: CreateEdgeRequest) =>
    POST<EdgeMutationData>(`/stories/${storyId}/edges`, data),
  updateEdge: (storyId: string, edgeId: string, data: UpdateEdgeRequest) =>
    PATCH<EdgeMutationData>(`/stories/${storyId}/edges/${edgeId}`, data),
  deleteEdge: (storyId: string, edgeId: string) =>
    DELETE<{ deleted: boolean; newVersionId: string }>(`/stories/${storyId}/edges/${edgeId}`),
  batchEdges: (storyId: string, data: BatchEdgeRequest) =>
    POST<BatchEdgeResult>(`/stories/${storyId}/edges:batch`, data),
  upsertEdge: (storyId: string, data: CreateEdgeRequest) =>
    POST<UpsertEdgeResult>(`/stories/${storyId}/edges:upsert`, data),

  // Lint (Rule Engine - Milestone 1)
  lint: (storyId: string, data?: LintRequest) =>
    POST<LintData>(`/stories/${storyId}/lint`, data ?? { scope: 'full' }),
  applyFix: (storyId: string, data: ApplyFixRequest) =>
    POST<ApplyFixData>(`/stories/${storyId}/lint/apply`, data),
  preCommitLint: (storyId: string) =>
    GET<PreCommitLintData>(`/stories/${storyId}/lint/precommit`),

  // Bulk Attach (Milestone 2)
  bulkAttach: (storyId: string, data: BulkAttachRequest) =>
    POST<BulkAttachData>(`/stories/${storyId}/relations/bulk-attach`, data),

  // Plot Points
  listPlotPoints: (storyId: string, filters?: PlotPointFilters, limit?: number, offset?: number) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.act) params.set('act', filters.act.toString());
    if (filters?.intent) params.set('intent', filters.intent);
    if (filters?.unfulfilled !== undefined) params.set('unfulfilled', filters.unfulfilled.toString());
    if (limit) params.set('limit', limit.toString());
    if (offset) params.set('offset', offset.toString());
    const query = params.toString();
    return GET<PlotPointsListData>(`/stories/${storyId}/plot-points${query ? `?${query}` : ''}`);
  },
  getPlotPoint: (storyId: string, ppId: string) =>
    GET<PlotPointData>(`/stories/${storyId}/plot-points/${ppId}`),
  createPlotPoint: (storyId: string, data: CreatePlotPointRequest) =>
    POST<CreatePlotPointData>(`/stories/${storyId}/plot-points`, data),
  updatePlotPoint: (storyId: string, ppId: string, changes: Record<string, unknown>) =>
    PATCH<UpdatePlotPointData>(`/stories/${storyId}/plot-points/${ppId}`, { changes }),
  deletePlotPoint: (storyId: string, ppId: string) =>
    DELETE<DeletePlotPointData>(`/stories/${storyId}/plot-points/${ppId}`),
};

export { ApiError };
