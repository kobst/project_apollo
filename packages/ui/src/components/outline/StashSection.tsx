/**
 * StashSection - Collapsible section showing stashed (unassigned) content.
 *
 * Contains:
 * - StoryBeats without ALIGNS_WITH edges (not assigned to structural beats)
 * - Scenes without SATISFIED_BY edges (not linked to story beats)
 * - Ideas (including proposed ideas from AI packages)
 *
 * Use the Assign button on items to assign them to structure.
 */

import { useState, useCallback } from 'react';
import type { OutlineIdea } from '../../api/types';
import type { MergedOutlineStoryBeat, MergedOutlineScene, MergedOutlineIdea } from '../../utils/outlineMergeUtils';
import { UnassignedStoryBeatCard } from './UnassignedStoryBeatCard';
import { UnassignedSceneCard } from './UnassignedSceneCard';
import { UnassignedIdeaCard } from './UnassignedIdeaCard';
import { ProposedStoryBeatCard } from './ProposedStoryBeatCard';
import { ProposedSceneCard } from './ProposedSceneCard';
import { ProposedIdeaCard } from './ProposedIdeaCard';
import styles from './StashSection.module.css';

interface StashSectionProps {
  storyBeats: MergedOutlineStoryBeat[];
  scenes: MergedOutlineScene[];
  ideas: OutlineIdea[];
  proposedStoryBeats?: MergedOutlineStoryBeat[] | undefined;
  proposedScenes?: MergedOutlineScene[] | undefined;
  proposedIdeas?: MergedOutlineIdea[] | undefined;
  onAddStoryBeat: () => void;
  onAddScene: () => void;
  onAddIdea: () => void;
  onStoryBeatClick?: ((pp: MergedOutlineStoryBeat) => void) | undefined;
  onSceneClick?: ((scene: MergedOutlineScene) => void) | undefined;
  onIdeaClick?: ((idea: OutlineIdea) => void) | undefined;
  onEditProposed?: ((nodeId: string, updates: Partial<Record<string, unknown>>) => void) | undefined;
  onRemoveProposed?: ((nodeId: string) => void) | undefined;
  removedNodeIds?: Set<string> | undefined;
  // Stashed ideas exclusion
  excludedIdeaIds?: Set<string> | undefined;
  onToggleIdeaExclusion?: ((id: string) => void) | undefined;
  // Deletion
  onDeleteStoryBeat?: ((storyBeat: MergedOutlineStoryBeat) => void) | undefined;
  onDeleteScene?: ((scene: MergedOutlineScene) => void) | undefined;
  onDeleteIdea?: ((idea: OutlineIdea) => void) | undefined;
  // Assignment
  onAssignStoryBeat?: ((storyBeat: MergedOutlineStoryBeat) => void) | undefined;
  onAssignScene?: ((scene: MergedOutlineScene) => void) | undefined;
}

export function StashSection({
  storyBeats,
  scenes,
  ideas,
  proposedStoryBeats = [],
  proposedScenes = [],
  proposedIdeas = [],
  onAddStoryBeat,
  onAddScene,
  onAddIdea,
  onStoryBeatClick,
  onSceneClick,
  onIdeaClick,
  onEditProposed,
  onRemoveProposed,
  removedNodeIds,
  excludedIdeaIds,
  onToggleIdeaExclusion,
  onDeleteStoryBeat,
  onDeleteScene,
  onDeleteIdea,
  onAssignStoryBeat,
  onAssignScene,
}: StashSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'storyBeats' | 'scenes' | 'ideas'>('storyBeats');

  // Include proposed items in counts
  const totalStoryBeats = storyBeats.length + proposedStoryBeats.length;
  const totalScenes = scenes.length + proposedScenes.length;
  const totalIdeas = ideas.length + proposedIdeas.length;
  const totalCount = totalStoryBeats + totalScenes + totalIdeas;

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
              : 'Create story beats, scenes, or ideas here before assigning them.'}
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
              {totalIdeas > 0 && (
                <span className={`${styles.tabCount} ${proposedIdeas.length > 0 ? styles.tabCountHasProposed : ''}`}>
                  {totalIdeas}
                </span>
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
                      <h4 className={styles.proposedSubsectionTitle}>Proposed</h4>
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
                      onDelete={onDeleteStoryBeat ? () => onDeleteStoryBeat(pp) : undefined}
                      onAssign={onAssignStoryBeat ? () => onAssignStoryBeat(pp) : undefined}
                    />
                  ))}
                  {totalStoryBeats === 0 && (
                    <div className={styles.emptyMessage}>
                      No story beats in stash
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
                      <h4 className={styles.proposedSubsectionTitle}>Proposed</h4>
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
