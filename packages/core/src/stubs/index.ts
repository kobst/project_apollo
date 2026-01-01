/**
 * Stub implementations for MVP testing.
 * These simulate LLM/agent behavior for contract testing.
 *
 * In production, these would be replaced with actual LLM calls.
 */

// Extractor stub - input → Patch
export * from './extractorStub.js';

// Cluster stub - OQ → MoveCluster[]
export * from './clusterStub.js';
