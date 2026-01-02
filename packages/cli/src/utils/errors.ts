/**
 * CLI error handling utilities.
 */

import pc from 'picocolors';

// =============================================================================
// Error Classes
// =============================================================================

export class CLIError extends Error {
  constructor(
    message: string,
    public readonly suggestion?: string,
    public readonly exitCode: number = 1
  ) {
    super(message);
    this.name = 'CLIError';
  }
}

export class StateError extends CLIError {
  constructor(message: string) {
    super(
      message,
      'Run "project-apollo list" to see stories, or "project-apollo init" to create one.',
      1
    );
    this.name = 'StateError';
  }
}

export class ValidationError extends CLIError {
  constructor(
    message: string,
    public readonly errors: string[]
  ) {
    super(message, undefined, 1);
    this.name = 'ValidationError';
  }
}

// =============================================================================
// Error Handler
// =============================================================================

export function handleError(error: unknown): never {
  if (error instanceof ValidationError) {
    console.error(pc.red(`Error: ${error.message}`));
    for (const err of error.errors) {
      console.error(pc.dim(`  - ${err}`));
    }
    process.exit(error.exitCode);
  }

  if (error instanceof CLIError) {
    console.error(pc.red(`Error: ${error.message}`));
    if (error.suggestion) {
      console.log(pc.dim(`Hint: ${error.suggestion}`));
    }
    process.exit(error.exitCode);
  }

  if (error instanceof Error) {
    console.error(pc.red(`Unexpected error: ${error.message}`));
    if (process.env['DEBUG']) {
      console.error(error.stack);
    }
    process.exit(2);
  }

  console.error(pc.red('An unknown error occurred'));
  process.exit(2);
}

// =============================================================================
// Guard Functions
// =============================================================================

export function requireState<T>(
  state: T | null,
  message = 'No story found.'
): asserts state is T {
  if (state === null) {
    throw new StateError(message);
  }
}
