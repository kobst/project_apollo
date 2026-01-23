/**
 * UnassignedSection - Collapsible section showing unassigned StoryBeats and Scenes.
 *
 * StoryBeats can be dragged to Beats to create ALIGNS_WITH edges.
 * Scenes can be dragged to StoryBeats to create SATISFIED_BY edges.
 * Also displays proposed unassigned items from staged packages.
 */

import { useState, useCallback } from 'react';
import type { OutlineIdea } from '../../api/types';
import type { MergedOutlineStoryBeat, MergedOutlineScene } from '../../utils/outlineMergeUtils';
import { UnassignedStoryBeatCard } from './UnassignedStoryBeatCard';
import { UnassignedSceneCard } from './UnassignedSceneCard';
import { UnassignedIdeaCard } from './UnassignedIdeaCard';
import { ProposedStoryBeatCard } from './ProposedStoryBeatCard';
import { ProposedSceneCard } from './ProposedSceneCard';
import styles from './UnassignedSection.module.css';

interface UnassignedSectionProps {
  storyBeats: MergedOutlineStoryBeat[];
  scenes: MergedOutlineScene[];
  ideas: OutlineIdea[];
  proposedStoryBeats?: MergedOutlineStoryBeat[] | undefined;
  proposedScenes?: MergedOutlineScene[] | undefined;
  onAddStoryBeat: () => void;
  onAddScene: () => void;
  onAddIdea: () => void;
  onStoryBeatClick?: ((pp: MergedOutlineStoryBeat) => void) | undefined;
  onSceneClick?: ((scene: MergedOutlineScene) => void) | undefined;
  onIdeaClick?: ((idea: OutlineIdea) => void) | undefined;
  onEditProposed?: ((nodeId: string, updates: Partial<Record<string, unknown>>) => void) | undefined;
  onRemoveProposed?: ((nodeId: string) => void) | undefined;
  removedNodeIds?: Set<string> | undefined;
}

export function UnassignedSection({
  storyBeats,
  scenes,
  ideas,
  proposedStoryBeats = [],
  proposedScenes = [],
  onAddStoryBeat,
  onAddScene,
  onAddIdea,
  onStoryBeatClick,
  onSceneClick,
  onIdeaClick,
  onEditProposed,
  onRemoveProposed,
  removedNodeIds,
}: UnassignedSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'storyBeats' | 'scenes' | 'ideas'>('storyBeats');

  // Include proposed items in counts
  const totalStoryBeats = storyBeats.length + proposedStoryBeats.length;
  const totalScenes = scenes.length + proposedScenes.length;
  const totalCount = totalStoryBeats + totalScenes + ideas.length;

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
          {totalStoryBeats > 0 && (
            <span className={`${styles.badge} ${proposedStoryBeats.length > 0 ? styles.badgeHasProposed : ''}`}>
              {totalStoryBeats} Story Beat{totalStoryBeats !== 1 ? 's' : ''}
              {proposedStoryBeats.length > 0 && (
                <span className={styles.proposedIndicator}> (+{proposedStoryBeats.length})</span>
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
              ? 'These items need to be assigned. Drag story beats to beats, or drag scenes to story beats.'
              : 'Create story beats and scenes here before assigning them to the structure above.'}
          </p>

          {/* Tabs */}
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'storyBeats' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('storyBeats')}
              type="button"
            >
              Story Beats
              {totalStoryBeats > 0 && (
                <span className={`${styles.tabCount} ${proposedStoryBeats.length > 0 ? styles.tabCountHasProposed : ''}`}>
                  {totalStoryBeats}
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
            {activeTab === 'storyBeats' && (
              <>
                <div className={styles.itemsList}>
                  {/* Proposed unassigned story beats */}
                  {proposedStoryBeats.length > 0 && (
                    <div className={styles.proposedSubsection}>
                      <h4 className={styles.proposedSubsectionTitle}>Proposed (Unassigned)</h4>
                      {proposedStoryBeats.map((pp) => (
                        <ProposedStoryBeatCard
                          key={pp.id}
                          storyBeat={pp}
                          beatId=""
                          onEdit={onEditProposed!}
                          onRemove={pp._operation === 'add' ? onRemoveProposed : undefined}
                          isRemoved={removedNodeIds?.has(pp.id)}
                        />
                      ))}
                    </div>
                  )}
                  {/* Existing unassigned story beats */}
                  {storyBeats.map((pp) => (
                    <UnassignedStoryBeatCard
                      key={pp.id}
                      storyBeat={pp}
                      onClick={() => onStoryBeatClick?.(pp)}
                    />
                  ))}
                  {totalStoryBeats === 0 && (
                    <div className={styles.emptyMessage}>
                      No unassigned story beats
                    </div>
                  )}
                </div>
                <button
                  className={styles.addButton}
                  onClick={onAddStoryBeat}
                  type="button"
                >
                  + Add Story Beat
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
                          parentStoryBeatId=""
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
