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
  method: 'GET' | 'POST',
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

  // Node browsing
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
};

export { ApiError };
