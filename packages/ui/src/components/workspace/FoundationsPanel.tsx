import { useState, useEffect, useCallback } from 'react';
import { useStory } from '../../context/StoryContext';
import { api } from '../../api/client';
import type { NodeData } from '../../api/types';
import { NodeCardGrid } from './NodeCardGrid';
import { NodeDetailModal } from './NodeDetailModal';
import type { StoryMapCategory } from './StoryMap';
import styles from './FoundationsPanel.module.css';

interface FoundationsPanelProps {
  category: StoryMapCategory;
  nodeType: string;
}

export function FoundationsPanel({ category, nodeType }: FoundationsPanelProps) {
  const { currentStoryId, refreshStatus } = useStory();

  // Node state
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [nodesLoading, setNodesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const data = await api.listNodes(currentStoryId, nodeType);
      setNodes(data.nodes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load nodes');
      setNodes([]);
    } finally {
      setNodesLoading(false);
    }
  }, [currentStoryId, nodeType]);

  // Fetch all nodes for the relation picker
  const fetchAllNodes = useCallback(async () => {
    if (!currentStoryId) return;
    try {
      const types = ['Beat', 'Scene', 'Character', 'Location', 'CharacterArc', 'Object', 'StoryBeat', 'Logline', 'Setting', 'GenreTone'];
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
    void fetchAllNodes();
  }, [fetchNodes, fetchAllNodes]);

  // Handlers
  const handleSelectNode = useCallback((node: NodeData) => {
    setSelectedNode(node);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleNodeUpdated = useCallback(() => {
    void fetchNodes();
    void refreshStatus();
  }, [fetchNodes, refreshStatus]);

  const handleNodeDeleted = useCallback(() => {
    setSelectedNode(null);
    void fetchNodes();
    void refreshStatus();
  }, [fetchNodes, refreshStatus]);

  const getCategoryLabel = () => {
    const labels: Record<StoryMapCategory, string> = {
      storyContext: 'Story Context',
      logline: 'Logline',
      genreTone: 'Genre/Tone',
      setting: 'Setting',
      characters: 'Characters',
      locations: 'Locations',
      objects: 'Objects',
      board: 'Structure Board',
      storyBeats: 'Story Beats',
      scenes: 'Scenes',
      unassigned: 'Unassigned',
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
            onSelectNode={handleSelectNode}
            categoryLabel={getCategoryLabel()}
          />
        )}
      </div>

      {/* Modal for node detail */}
      {selectedNode && (
        <NodeDetailModal
          node={selectedNode}
          allNodes={allNodes}
          onClose={handleCloseModal}
          onNodeUpdated={handleNodeUpdated}
          onNodeDeleted={handleNodeDeleted}
        />
      )}
    </div>
  );
}
