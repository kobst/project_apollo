/**
 * UnassignedSection - Collapsible section showing unassigned PlotPoints and Scenes.
 *
 * PlotPoints can be dragged to Beats to create ALIGNS_WITH edges.
 * Scenes can be dragged to PlotPoints to create SATISFIED_BY edges.
 */

import { useState, useCallback } from 'react';
import type { OutlinePlotPoint, OutlineScene, OutlineIdea } from '../../api/types';
import { UnassignedPlotPointCard } from './UnassignedPlotPointCard';
import { UnassignedSceneCard } from './UnassignedSceneCard';
import { UnassignedIdeaCard } from './UnassignedIdeaCard';
import styles from './UnassignedSection.module.css';

interface UnassignedSectionProps {
  plotPoints: OutlinePlotPoint[];
  scenes: OutlineScene[];
  ideas: OutlineIdea[];
  onAddPlotPoint: () => void;
  onAddScene: () => void;
  onAddIdea: () => void;
  onPlotPointClick?: (pp: OutlinePlotPoint) => void;
  onSceneClick?: (scene: OutlineScene) => void;
  onIdeaClick?: (idea: OutlineIdea) => void;
}

export function UnassignedSection({
  plotPoints,
  scenes,
  ideas,
  onAddPlotPoint,
  onAddScene,
  onAddIdea,
  onPlotPointClick,
  onSceneClick,
  onIdeaClick,
}: UnassignedSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'plotPoints' | 'scenes' | 'ideas'>('plotPoints');

  const totalCount = plotPoints.length + scenes.length + ideas.length;

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
          {plotPoints.length > 0 && (
            <span className={styles.badge}>
              {plotPoints.length} Plot Point{plotPoints.length !== 1 ? 's' : ''}
            </span>
          )}
          {scenes.length > 0 && (
            <span className={styles.badge}>
              {scenes.length} Scene{scenes.length !== 1 ? 's' : ''}
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
              {plotPoints.length > 0 && (
                <span className={styles.tabCount}>{plotPoints.length}</span>
              )}
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'scenes' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('scenes')}
              type="button"
            >
              Scenes
              {scenes.length > 0 && (
                <span className={styles.tabCount}>{scenes.length}</span>
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
                  {plotPoints.map((pp) => (
                    <UnassignedPlotPointCard
                      key={pp.id}
                      plotPoint={pp}
                      onClick={() => onPlotPointClick?.(pp)}
                    />
                  ))}
                  {plotPoints.length === 0 && (
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
                  {scenes.map((scene) => (
                    <UnassignedSceneCard
                      key={scene.id}
                      scene={scene}
                      onClick={() => onSceneClick?.(scene)}
                    />
                  ))}
                  {scenes.length === 0 && (
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
