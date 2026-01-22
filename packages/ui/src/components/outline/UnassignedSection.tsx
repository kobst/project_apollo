/**
 * UnassignedSection - Collapsible section showing unassigned PlotPoints and Scenes.
 *
 * PlotPoints can be dragged to Beats to create ALIGNS_WITH edges.
 * Scenes can be dragged to PlotPoints to create SATISFIED_BY edges.
 * Also displays proposed unassigned items from staged packages.
 */

import { useState, useCallback } from 'react';
import type { OutlineIdea } from '../../api/types';
import type { MergedOutlinePlotPoint, MergedOutlineScene } from '../../utils/outlineMergeUtils';
import { UnassignedPlotPointCard } from './UnassignedPlotPointCard';
import { UnassignedSceneCard } from './UnassignedSceneCard';
import { UnassignedIdeaCard } from './UnassignedIdeaCard';
import { ProposedPlotPointCard } from './ProposedPlotPointCard';
import { ProposedSceneCard } from './ProposedSceneCard';
import styles from './UnassignedSection.module.css';

interface UnassignedSectionProps {
  plotPoints: MergedOutlinePlotPoint[];
  scenes: MergedOutlineScene[];
  ideas: OutlineIdea[];
  proposedPlotPoints?: MergedOutlinePlotPoint[] | undefined;
  proposedScenes?: MergedOutlineScene[] | undefined;
  onAddPlotPoint: () => void;
  onAddScene: () => void;
  onAddIdea: () => void;
  onPlotPointClick?: ((pp: MergedOutlinePlotPoint) => void) | undefined;
  onSceneClick?: ((scene: MergedOutlineScene) => void) | undefined;
  onIdeaClick?: ((idea: OutlineIdea) => void) | undefined;
  onEditProposed?: ((nodeId: string, updates: Partial<Record<string, unknown>>) => void) | undefined;
  onRemoveProposed?: ((nodeId: string) => void) | undefined;
  removedNodeIds?: Set<string> | undefined;
}

export function UnassignedSection({
  plotPoints,
  scenes,
  ideas,
  proposedPlotPoints = [],
  proposedScenes = [],
  onAddPlotPoint,
  onAddScene,
  onAddIdea,
  onPlotPointClick,
  onSceneClick,
  onIdeaClick,
  onEditProposed,
  onRemoveProposed,
  removedNodeIds,
}: UnassignedSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'plotPoints' | 'scenes' | 'ideas'>('plotPoints');

  // Include proposed items in counts
  const totalPlotPoints = plotPoints.length + proposedPlotPoints.length;
  const totalScenes = scenes.length + proposedScenes.length;
  const totalCount = totalPlotPoints + totalScenes + ideas.length;

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  return (
    <div className={`${styles.container} ${totalCount > 0 ? styles.containerHasItems : ''}`}>
      <div
        className={styles.header}
        onClick={toggleExpanded}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && toggleExpanded()}
      >
        <div className={styles.headerLeft}>
          <span className={`${styles.chevron} ${isExpanded ? styles.chevronExpanded : ''}`}>
            &#x25B6;
          </span>
          <span className={totalCount > 0 ? styles.icon : styles.iconEmpty}>
            {totalCount > 0 ? '!' : '+'}
          </span>
          <h3 className={styles.title}>
            {totalCount > 0 ? 'Unassigned Items' : 'Staging Area'}
          </h3>
          {totalCount > 0 && <span className={styles.count}>({totalCount})</span>}
        </div>
        <div className={styles.headerRight}>
          {totalPlotPoints > 0 && (
            <span className={`${styles.badge} ${proposedPlotPoints.length > 0 ? styles.badgeHasProposed : ''}`}>
              {totalPlotPoints} Plot Point{totalPlotPoints !== 1 ? 's' : ''}
              {proposedPlotPoints.length > 0 && (
                <span className={styles.proposedIndicator}> (+{proposedPlotPoints.length})</span>
              )}
            </span>
          )}
          {totalScenes > 0 && (
            <span className={`${styles.badge} ${proposedScenes.length > 0 ? styles.badgeHasProposed : ''}`}>
              {totalScenes} Scene{totalScenes !== 1 ? 's' : ''}
              {proposedScenes.length > 0 && (
                <span className={styles.proposedIndicator}> (+{proposedScenes.length})</span>
              )}
            </span>
          )}
          {ideas.length > 0 && (
            <span className={styles.badge}>
              {ideas.length} Idea{ideas.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className={styles.content}>
          <p className={styles.description}>
            {totalCount > 0
              ? 'These items need to be assigned. Drag plot points to beats, or drag scenes to plot points.'
              : 'Create plot points and scenes here before assigning them to the structure above.'}
          </p>

          {/* Tabs */}
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'plotPoints' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('plotPoints')}
              type="button"
            >
              Plot Points
              {totalPlotPoints > 0 && (
                <span className={`${styles.tabCount} ${proposedPlotPoints.length > 0 ? styles.tabCountHasProposed : ''}`}>
                  {totalPlotPoints}
                </span>
              )}
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'scenes' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('scenes')}
              type="button"
            >
              Scenes
              {totalScenes > 0 && (
                <span className={`${styles.tabCount} ${proposedScenes.length > 0 ? styles.tabCountHasProposed : ''}`}>
                  {totalScenes}
                </span>
              )}
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'ideas' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('ideas')}
              type="button"
            >
              Ideas
              {ideas.length > 0 && (
                <span className={styles.tabCount}>{ideas.length}</span>
              )}
            </button>
          </div>

          {/* Content */}
          <div className={styles.itemsContainer}>
            {activeTab === 'plotPoints' && (
              <>
                <div className={styles.itemsList}>
                  {/* Proposed unassigned plot points */}
                  {proposedPlotPoints.length > 0 && (
                    <div className={styles.proposedSubsection}>
                      <h4 className={styles.proposedSubsectionTitle}>Proposed (Unassigned)</h4>
                      {proposedPlotPoints.map((pp) => (
                        <ProposedPlotPointCard
                          key={pp.id}
                          plotPoint={pp}
                          beatId=""
                          onEdit={onEditProposed!}
                          onRemove={pp._operation === 'add' ? onRemoveProposed : undefined}
                          isRemoved={removedNodeIds?.has(pp.id)}
                        />
                      ))}
                    </div>
                  )}
                  {/* Existing unassigned plot points */}
                  {plotPoints.map((pp) => (
                    <UnassignedPlotPointCard
                      key={pp.id}
                      plotPoint={pp}
                      onClick={() => onPlotPointClick?.(pp)}
                    />
                  ))}
                  {totalPlotPoints === 0 && (
                    <div className={styles.emptyMessage}>
                      No unassigned plot points
                    </div>
                  )}
                </div>
                <button
                  className={styles.addButton}
                  onClick={onAddPlotPoint}
                  type="button"
                >
                  + Add Plot Point
                </button>
              </>
            )}

            {activeTab === 'scenes' && (
              <>
                <div className={styles.itemsList}>
                  {/* Proposed unassigned scenes */}
                  {proposedScenes.length > 0 && (
                    <div className={styles.proposedSubsection}>
                      <h4 className={styles.proposedSubsectionTitle}>Proposed (Unassigned)</h4>
                      {proposedScenes.map((scene) => (
                        <ProposedSceneCard
                          key={scene.id}
                          scene={scene}
                          parentPlotPointId=""
                          onEdit={onEditProposed!}
                          onRemove={scene._operation === 'add' ? onRemoveProposed : undefined}
                          isRemoved={removedNodeIds?.has(scene.id)}
                        />
                      ))}
                    </div>
                  )}
                  {/* Existing unassigned scenes */}
                  {scenes.map((scene) => (
                    <UnassignedSceneCard
                      key={scene.id}
                      scene={scene}
                      onClick={() => onSceneClick?.(scene)}
                    />
                  ))}
                  {totalScenes === 0 && (
                    <div className={styles.emptyMessage}>
                      No unassigned scenes
                    </div>
                  )}
                </div>
                <button
                  className={styles.addButton}
                  onClick={onAddScene}
                  type="button"
                >
                  + Add Scene
                </button>
              </>
            )}

            {activeTab === 'ideas' && (
              <>
                <div className={styles.itemsList}>
                  {ideas.map((idea) => (
                    <UnassignedIdeaCard
                      key={idea.id}
                      idea={idea}
                      onClick={() => onIdeaClick?.(idea)}
                    />
                  ))}
                  {ideas.length === 0 && (
                    <div className={styles.emptyMessage}>
                      No ideas yet
                    </div>
                  )}
                </div>
                <button
                  className={styles.addButton}
                  onClick={onAddIdea}
                  type="button"
                >
                  + Add Idea
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
