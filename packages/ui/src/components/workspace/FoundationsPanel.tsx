import { useState, useEffect, useCallback, useMemo } from 'react';
import { useStory } from '../../context/StoryContext';
import { api } from '../../api/client';
import type { NodeData, GapsData } from '../../api/types';
import { NodeCardGrid } from './NodeCardGrid';
import { NodeDetailModal } from './NodeDetailModal';
import { InputPanel } from '../input/InputPanel';
import type { StoryMapCategory } from './StoryMap';
import styles from './FoundationsPanel.module.css';

interface FoundationsPanelProps {
  category: StoryMapCategory;
  nodeType: string;
  includeMotifs?: boolean;
}

export function FoundationsPanel({ category, nodeType, includeMotifs }: FoundationsPanelProps) {
  const { currentStoryId, refreshStatus } = useStory();

  // Node state
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [nodesLoading, setNodesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Gaps state
  const [gapsData, setGapsData] = useState<GapsData | null>(null);

  // Modal state
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);

  // All nodes for relation picker in modal
  const [allNodes, setAllNodes] = useState<NodeData[]>([]);

  // Fetch nodes
  const fetchNodes = useCallback(async () => {
    if (!currentStoryId) return;

    setNodesLoading(true);
    setError(null);

    try {
      // Fetch primary type
      const data = await api.listNodes(currentStoryId, nodeType);
      let fetchedNodes = data.nodes;

      // Include motifs if needed (for themes category)
      if (includeMotifs) {
        const motifData = await api.listNodes(currentStoryId, 'Motif');
        fetchedNodes = [...fetchedNodes, ...motifData.nodes];
      }

      setNodes(fetchedNodes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load nodes');
      setNodes([]);
    } finally {
      setNodesLoading(false);
    }
  }, [currentStoryId, nodeType, includeMotifs]);

  // Fetch gaps for this category
  const fetchGaps = useCallback(async () => {
    if (!currentStoryId) return;

    try {
      const data = await api.getGaps(currentStoryId);
      setGapsData(data);
    } catch (err) {
      console.error('Failed to fetch gaps:', err);
    }
  }, [currentStoryId]);

  // Fetch all nodes for the relation picker
  const fetchAllNodes = useCallback(async () => {
    if (!currentStoryId) return;
    try {
      const types = ['Beat', 'Scene', 'Character', 'Conflict', 'Location', 'Theme', 'Motif', 'CharacterArc', 'Object', 'PlotPoint', 'Premise', 'Setting', 'GenreTone'];
      const results = await Promise.all(
        types.map(type => api.listNodes(currentStoryId, type).catch(() => ({ nodes: [] })))
      );
      const all = results.flatMap(r => r.nodes);
      setAllNodes(all);
    } catch (err) {
      console.error('Failed to load all nodes:', err);
    }
  }, [currentStoryId]);

  useEffect(() => {
    void fetchNodes();
    void fetchGaps();
    void fetchAllNodes();
  }, [fetchNodes, fetchGaps, fetchAllNodes]);

  // Filter gaps for this category
  const categoryGaps = useMemo(() => {
    if (!gapsData) return [];

    return gapsData.gaps.filter(gap => {
      // Match by node type or tier
      const nodeTypeLower = nodeType.toLowerCase();
      const titleLower = gap.title.toLowerCase();

      if (titleLower.includes(nodeTypeLower)) return true;
      if (includeMotifs && titleLower.includes('motif')) return true;

      // Match by tier for some categories
      if (category === 'premise' && gap.tier === 'premise') return true;
      if (category === 'characters' && gap.tier === 'foundations' && gap.domain === 'CHARACTER') return true;
      if (category === 'conflicts' && gap.tier === 'foundations' && gap.domain === 'CONFLICT') return true;
      if (category === 'plotPoints' && gap.tier === 'plotPoints') return true;
      if (category === 'scenes' && gap.tier === 'scenes') return true;

      return false;
    });
  }, [gapsData, nodeType, includeMotifs, category]);

  // Get gaps for a specific node
  const getNodeGaps = useCallback((nodeId: string) => {
    return categoryGaps.filter(gap =>
      gap.scopeRefs?.nodeIds?.includes(nodeId)
    );
  }, [categoryGaps]);

  // Handlers
  const handleSelectNode = useCallback((node: NodeData) => {
    setSelectedNode(node);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleNodeUpdated = useCallback(() => {
    void fetchNodes();
    void fetchGaps();
    void refreshStatus();
  }, [fetchNodes, fetchGaps, refreshStatus]);

  const handleNodeDeleted = useCallback(() => {
    setSelectedNode(null);
    void fetchNodes();
    void fetchGaps();
    void refreshStatus();
  }, [fetchNodes, fetchGaps, refreshStatus]);

  const getCategoryLabel = () => {
    const labels: Record<StoryMapCategory, string> = {
      premise: 'Premise',
      genreTone: 'Genre/Tone',
      setting: 'Setting',
      characters: 'Characters',
      conflicts: 'Conflicts',
      themes: 'Themes & Motifs',
      board: 'Structure Board',
      plotPoints: 'Plot Points',
      scenes: 'Scenes',
    };
    return labels[category];
  };

  return (
    <div className={styles.container}>
      {/* Main content: Card grid */}
      <div className={styles.mainPane}>
        <div className={styles.header}>
          <h3 className={styles.title}>{getCategoryLabel()}</h3>
          <span className={styles.nodeCount}>{nodes.length}</span>
        </div>

        {nodesLoading ? (
          <div className={styles.loading}>Loading...</div>
        ) : error ? (
          <div className={styles.error}>{error}</div>
        ) : (
          <NodeCardGrid
            nodes={nodes}
            gaps={categoryGaps}
            onSelectNode={handleSelectNode}
            categoryLabel={getCategoryLabel()}
          />
        )}
      </div>

      {/* Right: Input Panel */}
      <div className={styles.inputPane}>
        <InputPanel />
      </div>

      {/* Modal for node detail */}
      {selectedNode && (
        <NodeDetailModal
          node={selectedNode}
          nodeGaps={getNodeGaps(selectedNode.id)}
          allNodes={allNodes}
          onClose={handleCloseModal}
          onNodeUpdated={handleNodeUpdated}
          onNodeDeleted={handleNodeDeleted}
        />
      )}
    </div>
  );
}
