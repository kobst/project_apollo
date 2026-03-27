/**
 * StashSection - Collapsible section showing stashed (unassigned) content.
 *
 * Contains:
 * - PlotPoints without alignedBeatId (not assigned to structural beats)
 * - Scenes without REALIZED_BY edges (not linked to plot points)
 * - Ideas (including proposed ideas from AI packages)
 *
 * Use the Assign button on items to assign them to structure.
 */

import { useState, useCallback } from 'react';
import type { OutlineIdea } from '../../api/types';
import type { MergedOutlinePlotPoint, MergedOutlineScene, MergedOutlineIdea } from '../../utils/outlineMergeUtils';
import { UnassignedStoryBeatCard } from './UnassignedStoryBeatCard';
import { UnassignedSceneCard } from './UnassignedSceneCard';
import { UnassignedIdeaCard } from './UnassignedIdeaCard';
import { ProposedStoryBeatCard } from './ProposedStoryBeatCard';
import { ProposedSceneCard } from './ProposedSceneCard';
import { ProposedIdeaCard } from './ProposedIdeaCard';
import styles from './StashSection.module.css';

interface StashSectionProps {
  plotPoints: MergedOutlinePlotPoint[];
  scenes: MergedOutlineScene[];
  ideas: OutlineIdea[];
  proposedPlotPoints?: MergedOutlinePlotPoint[] | undefined;
  proposedScenes?: MergedOutlineScene[] | undefined;
  proposedIdeas?: MergedOutlineIdea[] | undefined;
  onAddPlotPoint: () => void;
  onAddScene: () => void;
  onAddIdea: () => void;
  onPlotPointClick?: ((pp: MergedOutlinePlotPoint) => void) | undefined;
  onSceneClick?: ((scene: MergedOutlineScene) => void) | undefined;
  onIdeaClick?: ((idea: OutlineIdea) => void) | undefined;
  onEditProposed?: ((nodeId: string, updates: Partial<Record<string, unknown>>) => void) | undefined;
  onRemoveProposed?: ((nodeId: string) => void) | undefined;
  removedNodeIds?: Set<string> | undefined;
  // Stashed ideas exclusion
  excludedIdeaIds?: Set<string> | undefined;
  onToggleIdeaExclusion?: ((id: string) => void) | undefined;
  // Deletion
  onDeletePlotPoint?: ((plotPoint: MergedOutlinePlotPoint) => void) | undefined;
  onDeleteScene?: ((scene: MergedOutlineScene) => void) | undefined;
  onDeleteIdea?: ((idea: OutlineIdea) => void) | undefined;
  // Assignment
  onAssignPlotPoint?: ((plotPoint: MergedOutlinePlotPoint) => void) | undefined;
  onAssignScene?: ((scene: MergedOutlineScene) => void) | undefined;
}

export function StashSection({
  plotPoints,
  scenes,
  ideas,
  proposedPlotPoints = [],
  proposedScenes = [],
  proposedIdeas = [],
  onAddPlotPoint,
  onAddScene,
  onAddIdea,
  onPlotPointClick,
  onSceneClick,
  onIdeaClick,
  onEditProposed,
  onRemoveProposed,
  removedNodeIds,
  excludedIdeaIds,
  onToggleIdeaExclusion,
  onDeletePlotPoint,
  onDeleteScene,
  onDeleteIdea,
  onAssignPlotPoint,
  onAssignScene,
}: StashSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'plotPoints' | 'scenes' | 'ideas'>('plotPoints');

  // Include proposed items in counts
  const totalPlotPoints = plotPoints.length + proposedPlotPoints.length;
  const totalScenes = scenes.length + proposedScenes.length;
  const totalIdeas = ideas.length + proposedIdeas.length;
  const totalCount = totalPlotPoints + totalScenes + totalIdeas;

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
            {totalCount > 0 ? 'Stash' : 'Stash'}
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
          {totalIdeas > 0 && (
            <span className={`${styles.badge} ${proposedIdeas.length > 0 ? styles.badgeHasProposed : ''}`}>
              {totalIdeas} Idea{totalIdeas !== 1 ? 's' : ''}
              {proposedIdeas.length > 0 && (
                <span className={styles.proposedIndicator}> (+{proposedIdeas.length})</span>
              )}
            </span>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className={styles.content}>
          <p className={styles.description}>
            {totalCount > 0
              ? 'Floating content not yet assigned to structure. Use Assign to link items.'
              : 'Create plot points, scenes, or ideas here before assigning them.'}
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
              {totalIdeas > 0 && (
                <span className={`${styles.tabCount} ${proposedIdeas.length > 0 ? styles.tabCountHasProposed : ''}`}>
                  {totalIdeas}
                </span>
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
                      <h4 className={styles.proposedSubsectionTitle}>Proposed</h4>
                      {proposedPlotPoints.map((pp) => (
                        <ProposedStoryBeatCard
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
                    <UnassignedStoryBeatCard
                      key={pp.id}
                      plotPoint={pp}
                      onClick={() => onPlotPointClick?.(pp)}
                      onDelete={onDeletePlotPoint ? () => onDeletePlotPoint(pp) : undefined}
                      onAssign={onAssignPlotPoint ? () => onAssignPlotPoint(pp) : undefined}
                    />
                  ))}
                  {totalPlotPoints === 0 && (
                    <div className={styles.emptyMessage}>
                      No plot points in stash
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
                      <h4 className={styles.proposedSubsectionTitle}>Proposed</h4>
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
                      onDelete={onDeleteScene ? () => onDeleteScene(scene) : undefined}
                      onAssign={onAssignScene ? () => onAssignScene(scene) : undefined}
                    />
                  ))}
                  {totalScenes === 0 && (
                    <div className={styles.emptyMessage}>
                      No scenes in stash
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
                  {/* Proposed ideas from stashed ideas */}
                  {proposedIdeas.length > 0 && (
                    <div className={styles.proposedSubsection}>
                      <h4 className={styles.proposedSubsectionTitle}>Proposed</h4>
                      {proposedIdeas.map((idea) => (
                        <ProposedIdeaCard
                          key={idea.id}
                          idea={idea}
                          isIncluded={!excludedIdeaIds?.has(idea.id)}
                          onToggleInclude={onToggleIdeaExclusion}
                        />
                      ))}
                    </div>
                  )}
                  {/* Existing ideas */}
                  {ideas.map((idea) => (
                    <UnassignedIdeaCard
                      key={idea.id}
                      idea={idea}
                      onClick={() => onIdeaClick?.(idea)}
                      onDelete={onDeleteIdea ? () => onDeleteIdea(idea) : undefined}
                    />
                  ))}
                  {totalIdeas === 0 && (
                    <div className={styles.emptyMessage}>
                      No ideas in stash
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
