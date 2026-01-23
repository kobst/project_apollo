/**
 * Workspace types for Story Bible UI.
 */

export type ElementType = 'Character' | 'Location' | 'Object';

// WorkspaceView type kept for backward compatibility with existing components
// that may still reference it (WorkspaceSidebar, etc.)
export type WorkspaceView = 'structure' | 'elements' | 'premise' | 'allChanges';

export interface ElementModalState {
  elementId: string;
  elementType: ElementType;
}
