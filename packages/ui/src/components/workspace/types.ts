/**
 * Workspace view types for managing main content area views.
 */

export type ElementType = 'Character' | 'Location' | 'Object';

export type WorkspaceView = 'structure' | 'elements';

export interface ElementModalState {
  elementId: string;
  elementType: ElementType;
}
