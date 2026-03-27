/**
 * ActSwimlane - Vertical expansion model for an act.
 * Contains BeatTimeline and StoryBeatSwimlanes.
 * Supports beat selection with empty state view.
 */

import { useState, useCallback, useMemo } from 'react';
import type { MergedOutlineAct, MergedOutlinePlotPoint, MergedOutlineScene, MergedOutlineBeat } from '../../utils/outlineMergeUtils';
import { BeatTimeline } from './BeatTimeline';
import { StoryBeatSwimlane } from './StoryBeatSwimlane';
import styles from './ActSwimlane.module.css';

interface ActSwimlaneProps {
  act: MergedOutlineAct;
  onEditPlotPoint?: (pp: MergedOutlinePlotPoint) => void;
  onEditScene?: (scene: MergedOutlineScene, plotPointId: string) => void;
  onDeletePlotPoint?: (pp: MergedOutlinePlotPoint) => void;
  onDeleteScene?: (scene: MergedOutlineScene) => void;
  onAddPlotPoint?: (beatId: string) => void;
  onAddScene?: () => void;
  onEditProposed?: (nodeId: string, updates: Partial<Record<string, unknown>>) => void;
  onRemoveProposed?: (nodeId: string) => void;
  removedNodeIds?: Set<string>;
}

const ACT_NAMES: Record<number, string> = {
  1: 'Act 1 - Setup',
  2: 'Act 2A - Fun & Games',
  3: 'Act 3 - Midpoint & Bad Guys',
  4: 'Act 4 - All Is Lost',
  5: 'Act 5 - Finale',
};

// Get all plot points from an act (flattened from all beats)
function getAllPlotPoints(act: MergedOutlineAct): MergedOutlinePlotPoint[] {
  const plotPoints: MergedOutlinePlotPoint[] = [];
  for (const beat of act.beats) {
    for (const pp of beat.plotPoints) {
      plotPoints.push(pp);
    }
  }
  return plotPoints;
}

// Count scenes in an act
function getSceneCount(act: MergedOutlineAct): number {
  let count = 0;
  for (const beat of act.beats) {
    for (const pp of beat.plotPoints) {
      count += pp.scenes.length;
    }
  }
  return count;
}

// Format beat type for display
function formatBeatType(beatType: string): string {
  return beatType
    .replace(/([A-Z])/g, ' $1')
    .replace(/^[\s]/, '')
    .replace('And', '&')
    .trim();
}

export function ActSwimlane({
  act,
  onEditPlotPoint,
  onEditScene,
  onDeletePlotPoint,
  onDeleteScene,
  onAddPlotPoint,
  onAddScene,
  onEditProposed,
  onRemoveProposed,
  removedNodeIds,
}: ActSwimlaneProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedBeatId, setSelectedBeatId] = useState<string | null>(null);

  const actName = ACT_NAMES[act.act] || `Act ${act.act}`;
  const plotPoints = useMemo(() => getAllPlotPoints(act), [act]);
  const sceneCount = useMemo(() => getSceneCount(act), [act]);
  const beatCount = act.beats.length;

  // Check if any content is proposed
  const hasProposed = useMemo(() => {
    return plotPoints.some(pp => pp._isProposed || pp.scenes.some(s => s._isProposed));
  }, [plotPoints]);

  // Get selected beat object
  const selectedBeat = useMemo((): MergedOutlineBeat | null => {
    if (!selectedBeatId) return null;
    return act.beats.find(b => b.id === selectedBeatId) ?? null;
  }, [act.beats, selectedBeatId]);

  // Check if selected beat is empty
  const selectedBeatIsEmpty = selectedBeat ? selectedBeat.plotPoints.length === 0 : false;

  // Get plot points to display: if a beat is selected, show only its plot points
  // Otherwise show all plot points in the act
  const displayedPlotPoints = useMemo(() => {
    if (selectedBeat) {
      return selectedBeat.plotPoints;
    }
    return plotPoints;
  }, [selectedBeat, plotPoints]);

  const handleBeatClick = useCallback((beatId: string) => {
    const beat = act.beats.find(b => b.id === beatId);
    if (!beat) return;

    // If beat has content, just select it (could scroll to plot points)
    // If beat is empty, select it to show the empty state card
    if (selectedBeatId === beatId) {
      // Clicking same beat deselects it
      setSelectedBeatId(null);
    } else {
      setSelectedBeatId(beatId);
    }
  }, [act.beats, selectedBeatId]);

  // Handle add plot point from empty beat card
  const handleAddPlotPointFromBeat = useCallback(() => {
    if (selectedBeatId && onAddPlotPoint) {
      onAddPlotPoint(selectedBeatId);
    }
  }, [selectedBeatId, onAddPlotPoint]);

  // Clear selection when clicking outside
  const handleClearSelection = useCallback(() => {
    setSelectedBeatId(null);
  }, []);

  return (
    <div className={`${styles.container} ${hasProposed ? styles.hasProposed : ''}`} id={`act-${act.act}`}>
      {/* Act header */}
      <div className={styles.header}>
        <button
          type="button"
          className={styles.expandToggle}
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
        >
          <span className={`${styles.chevron} ${isExpanded ? styles.expanded : ''}`}>
            {'\u25BC'}
          </span>
        </button>

        <h3 className={styles.actTitle}>{actName}</h3>

        <span className={styles.stats}>
          {beatCount} beats, {plotPoints.length} plot points, {sceneCount} scenes
          {hasProposed && <span className={styles.proposedIndicator}> (has proposed)</span>}
        </span>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className={styles.content}>
          {/* Beat timeline */}
          <BeatTimeline
            beats={act.beats}
            selectedBeatId={selectedBeatId}
            onBeatClick={handleBeatClick}
            onClearSelection={handleClearSelection}
          />

          {/* Empty beat card - shown when an empty beat is selected */}
          {selectedBeat && selectedBeatIsEmpty && (
            <div className={styles.emptyBeatCard}>
              <div className={styles.emptyBeatHeader}>
                <h4 className={styles.emptyBeatTitle}>{formatBeatType(selectedBeat.beatType)}</h4>
                <button
                  type="button"
                  className={styles.emptyBeatClose}
                  onClick={handleClearSelection}
                  aria-label="Close"
                >
                  {'\u2715'}
                </button>
              </div>
              {selectedBeat.guidance && (
                <p className={styles.emptyBeatGuidance}>{selectedBeat.guidance}</p>
              )}
              <p className={styles.emptyBeatMessage}>No plot points aligned to this beat yet.</p>
              <div className={styles.emptyBeatActions}>
                {onAddPlotPoint && (
                  <button
                    type="button"
                    className={styles.emptyBeatBtn}
                    onClick={handleAddPlotPointFromBeat}
                  >
                    + Add Story Beat
                  </button>
                )}
                {onAddScene && (
                  <button
                    type="button"
                    className={styles.emptyBeatBtnSecondary}
                    onClick={onAddScene}
                  >
                    + Add Scene
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Story beat swimlanes - hidden when viewing an empty beat */}
          {!selectedBeatIsEmpty && (
            <>
              <div className={styles.plotPoints}>
                {selectedBeat ? (
                  // When a beat is selected, show only its plot points
                  displayedPlotPoints.length === 0 ? (
                    <div className={styles.emptyState}>
                      <p>No plot points aligned to this beat.</p>
                      <p className={styles.hint}>Click a beat in the timeline above to add a plot point.</p>
                    </div>
                  ) : (
                    displayedPlotPoints.map((pp) => (
                      <StoryBeatSwimlane
                        key={pp.id}
                        plotPoint={pp}
                        onEditPlotPoint={onEditPlotPoint ? () => onEditPlotPoint(pp) : undefined}
                        onEditScene={onEditScene ? (scene) => onEditScene(scene, pp.id) : undefined}
                        onDelete={!pp._isProposed && onDeletePlotPoint ? () => onDeletePlotPoint(pp) : undefined}
                        onDeleteScene={onDeleteScene}
                        onAddScene={onAddScene}
                        onEditProposed={onEditProposed}
                        onRemoveProposed={pp._operation === 'add' ? onRemoveProposed : undefined}
                        isRemoved={removedNodeIds?.has(pp.id)}
                      />
                    ))
                  )
                ) : (
                  // When no beat is selected, show plot points grouped by beat
                  plotPoints.length === 0 ? (
                    <div className={styles.emptyState}>
                      <p>No plot points in this act yet.</p>
                      <p className={styles.hint}>Click a beat in the timeline above to add a plot point.</p>
                    </div>
                  ) : (
                    act.beats.filter(beat => beat.plotPoints.length > 0).map((beat) => (
                      <div key={beat.id} className={styles.beatGroup}>
                        <div className={styles.beatGroupHeader}>
                          <span className={styles.beatGroupTitle}>{formatBeatType(beat.beatType)}</span>
                          <span className={styles.beatGroupCount}>
                            {beat.plotPoints.length} plot point{beat.plotPoints.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        {beat.plotPoints.map((pp) => (
                          <StoryBeatSwimlane
                            key={pp.id}
                            plotPoint={pp}
                            onEditPlotPoint={onEditPlotPoint ? () => onEditPlotPoint(pp) : undefined}
                            onEditScene={onEditScene ? (scene) => onEditScene(scene, pp.id) : undefined}
                            onDelete={!pp._isProposed && onDeletePlotPoint ? () => onDeletePlotPoint(pp) : undefined}
                            onDeleteScene={onDeleteScene}
                            onAddScene={onAddScene}
                            onEditProposed={onEditProposed}
                            onRemoveProposed={pp._operation === 'add' ? onRemoveProposed : undefined}
                            isRemoved={removedNodeIds?.has(pp.id)}
                          />
                        ))}
                      </div>
                    ))
                  )
                )}
              </div>

              {/* Add plot point button */}
              {onAddPlotPoint && (
                <button
                  type="button"
                  className={styles.addPlotPointBtn}
                  onClick={() => onAddPlotPoint(act.beats[0]?.id ?? '')}
                >
                  + Add Story Beat to {actName.split(' - ')[0]}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
