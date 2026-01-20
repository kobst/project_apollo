/**
 * Workspace view types for managing main content area views.
 */

export type ElementType = 'Character' | 'Location' | 'Object';

export type WorkspaceView = 'structure' | 'elements' | 'premise';

export interface ElementModalState {
  elementId: string;
  elementType: ElementType;
}
