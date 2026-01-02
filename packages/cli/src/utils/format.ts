/**
 * Output formatting utilities.
 */

import pc from 'picocolors';
import type { OpenQuestion, OQSeverity, Patch, PatchOp, AddNodeOp, UpdateNodeOp, DeleteNodeOp, AddEdgeOp, DeleteEdgeOp, ValidationError } from '@apollo/core';

// =============================================================================
// Colors
// =============================================================================

export function severityColor(severity: OQSeverity): (text: string) => string {
  switch (severity) {
    case 'BLOCKING':
      return pc.red;
    case 'IMPORTANT':
      return pc.yellow;
    case 'SOFT':
      return pc.dim;
  }
}

export function phaseColor(phase: string): string {
  switch (phase) {
    case 'OUTLINE':
      return pc.blue(phase);
    case 'DRAFT':
      return pc.magenta(phase);
    case 'REVISION':
      return pc.green(phase);
    default:
      return phase;
  }
}

// =============================================================================
// Table Formatting
// =============================================================================

export function formatTable(
  headers: string[],
  rows: string[][],
  options: { indent?: number } = {}
): string {
  const indent = ' '.repeat(options.indent ?? 0);

  // Calculate column widths
  const widths = headers.map((h, i) => {
    const maxRowWidth = Math.max(...rows.map((r) => (r[i] ?? '').length));
    return Math.max(h.length, maxRowWidth);
  });

  // Format header
  const headerLine = headers
    .map((h, i) => h.padEnd(widths[i] ?? 0))
    .join('  ');
  const separator = widths.map((w) => '-'.repeat(w)).join('  ');

  // Format rows
  const rowLines = rows.map((row) =>
    row.map((cell, i) => cell.padEnd(widths[i] ?? 0)).join('  ')
  );

  return [
    indent + pc.bold(headerLine),
    indent + pc.dim(separator),
    ...rowLines.map((r) => indent + r),
  ].join('\n');
}

// =============================================================================
// Open Question Formatting
// =============================================================================

export function formatOQ(oq: OpenQuestion): string {
  const color = severityColor(oq.severity);
  const id = pc.dim(`[${oq.id}]`);
  const severity = color(oq.severity.padEnd(9));
  const domain = pc.cyan(oq.domain.padEnd(12));
  const message = oq.message;

  return `${id} ${severity} ${domain} ${message}`;
}

export function formatOQList(questions: OpenQuestion[]): string {
  if (questions.length === 0) {
    return pc.green('No open questions!');
  }

  const lines: string[] = [];

  // Group by severity
  const blocking = questions.filter((q) => q.severity === 'BLOCKING');
  const important = questions.filter((q) => q.severity === 'IMPORTANT');
  const soft = questions.filter((q) => q.severity === 'SOFT');

  if (blocking.length > 0) {
    lines.push(pc.red(pc.bold(`BLOCKING (${blocking.length}):`)));
    for (const oq of blocking) {
      lines.push('  ' + formatOQ(oq));
    }
    lines.push('');
  }

  if (important.length > 0) {
    lines.push(pc.yellow(pc.bold(`IMPORTANT (${important.length}):`)));
    for (const oq of important) {
      lines.push('  ' + formatOQ(oq));
    }
    lines.push('');
  }

  if (soft.length > 0) {
    lines.push(pc.dim(pc.bold(`SOFT (${soft.length}):`)));
    for (const oq of soft) {
      lines.push('  ' + formatOQ(oq));
    }
  }

  return lines.join('\n');
}

// =============================================================================
// Node Count Formatting
// =============================================================================

export function formatNodeCounts(counts: Record<string, number>): string {
  const order = [
    'Beat',
    'Scene',
    'Character',
    'Conflict',
    'Location',
    'Theme',
    'Motif',
    'CharacterArc',
  ];

  const lines: string[] = [];

  for (const type of order) {
    const count = counts[type];
    if (count !== undefined && count > 0) {
      lines.push(`  ${type.padEnd(14)} ${pc.bold(String(count))}`);
    }
  }

  // Add any types not in the order
  for (const [type, count] of Object.entries(counts)) {
    if (!order.includes(type) && count > 0) {
      lines.push(`  ${type.padEnd(14)} ${pc.bold(String(count))}`);
    }
  }

  return lines.join('\n');
}

// =============================================================================
// Move Formatting
// =============================================================================

export function formatMoveList(
  moves: Array<{ move: { id: string; title: string; rationale: string; confidence?: number } }>
): string {
  const lines: string[] = [];

  for (let i = 0; i < moves.length; i++) {
    const { move } = moves[i]!;
    const num = pc.dim(`${i + 1}.`);
    const id = pc.cyan(`[${move.id}]`);
    const confidence = move.confidence
      ? pc.dim(` (${Math.round(move.confidence * 100)}% confidence)`)
      : '';

    lines.push(`${num} ${id} ${pc.bold(move.title)}${confidence}`);
    lines.push(`   ${pc.dim(move.rationale)}`);
    lines.push('');
  }

  return lines.join('\n');
}

// =============================================================================
// Patch Formatting
// =============================================================================

export function formatPatchOp(op: PatchOp, index: number): string {
  const num = pc.dim(`${index + 1}.`);

  switch (op.op) {
    case 'ADD_NODE': {
      const addOp = op as AddNodeOp;
      const node = addOp.node;
      const nodeType = pc.green(node.type);
      const lines = [`${num} ${pc.bold('ADD_NODE')} ${nodeType}`];
      lines.push(`   ${pc.dim('id:')} ${node.id}`);

      // Show key fields based on node type
      if ('heading' in node && node.heading) {
        lines.push(`   ${pc.dim('heading:')} "${node.heading}"`);
      }
      if ('scene_overview' in node && node.scene_overview) {
        const overview = String(node.scene_overview);
        const truncated = overview.length > 60 ? overview.slice(0, 60) + '...' : overview;
        lines.push(`   ${pc.dim('overview:')} "${truncated}"`);
      }
      if ('name' in node && node.name) {
        lines.push(`   ${pc.dim('name:')} "${node.name}"`);
      }
      if ('beat_id' in node && node.beat_id) {
        lines.push(`   ${pc.dim('beat_id:')} ${node.beat_id}`);
      }
      if ('description' in node && node.description) {
        const desc = String(node.description);
        const truncated = desc.length > 60 ? desc.slice(0, 60) + '...' : desc;
        lines.push(`   ${pc.dim('description:')} "${truncated}"`);
      }
      if ('statement' in node && node.statement) {
        lines.push(`   ${pc.dim('statement:')} "${node.statement}"`);
      }

      return lines.join('\n');
    }

    case 'UPDATE_NODE': {
      const updateOp = op as UpdateNodeOp;
      const lines = [`${num} ${pc.bold('UPDATE_NODE')} ${pc.cyan(updateOp.id)}`];
      for (const [key, value] of Object.entries(updateOp.set)) {
        const valStr = typeof value === 'string' ? `"${value}"` : String(value);
        lines.push(`   ${pc.dim('set')} ${key} = ${valStr}`);
      }
      if (updateOp.unset && updateOp.unset.length > 0) {
        lines.push(`   ${pc.dim('unset')} ${updateOp.unset.join(', ')}`);
      }
      return lines.join('\n');
    }

    case 'DELETE_NODE': {
      const deleteOp = op as DeleteNodeOp;
      return `${num} ${pc.bold('DELETE_NODE')} ${pc.red(deleteOp.id)}`;
    }

    case 'ADD_EDGE': {
      const addEdgeOp = op as AddEdgeOp;
      const edge = addEdgeOp.edge;
      return `${num} ${pc.bold('ADD_EDGE')} ${pc.magenta(edge.type)}\n   ${edge.from} ${pc.dim('→')} ${edge.to}`;
    }

    case 'DELETE_EDGE': {
      const deleteEdgeOp = op as DeleteEdgeOp;
      const edge = deleteEdgeOp.edge;
      return `${num} ${pc.bold('DELETE_EDGE')} ${pc.red(edge.type)}\n   ${edge.from} ${pc.dim('→')} ${edge.to}`;
    }

    default:
      return `${num} ${pc.dim('Unknown operation')}`;
  }
}

export function formatPatch(patch: Patch): string {
  const lines: string[] = [];
  lines.push(pc.bold(`Patch Operations (${patch.ops.length} ops):`));
  lines.push('');

  for (let i = 0; i < patch.ops.length; i++) {
    const op = patch.ops[i];
    if (op) {
      lines.push(formatPatchOp(op, i));
      lines.push('');
    }
  }

  return lines.join('\n');
}

// =============================================================================
// Validation Error Formatting
// =============================================================================

/**
 * Get a suggested fix for a validation error.
 */
function getSuggestedFix(error: ValidationError): string | null {
  switch (error.code) {
    case 'FK_INTEGRITY':
      if (error.field === 'beat_id') {
        return 'Ensure the beat exists before creating the scene';
      }
      if (error.field === 'character_id') {
        return 'Create the character first: project-apollo add character --name "..."';
      }
      if (error.message.includes('source node')) {
        return 'Create the source node before adding the edge';
      }
      if (error.message.includes('target node')) {
        return 'Create the target node before adding the edge';
      }
      return 'Create the referenced node first';

    case 'MISSING_REQUIRED':
      return `Add the required field: ${error.field}`;

    case 'INVALID_ENUM':
      return `Use a valid value for ${error.field}`;

    case 'DUPLICATE_ID':
      return 'Use a unique ID for the new node';

    case 'DUPLICATE_EDGE':
      return 'This relationship already exists';

    case 'CONSTRAINT_VIOLATION':
      if (error.field === 'scene_overview') {
        return 'Scene overview must be at least 20 characters';
      }
      if (error.field === 'description') {
        return 'Description must be at least 20 characters';
      }
      if (error.field === 'statement') {
        return 'Theme statement must be 5-240 characters';
      }
      return null;

    case 'OUT_OF_RANGE':
      if (error.field === 'order_index') {
        return 'order_index must be >= 1';
      }
      if (error.field === 'intensity') {
        return 'intensity must be 1-5';
      }
      if (error.field === 'act') {
        return 'act must be 1-5';
      }
      return null;

    case 'INVALID_EDGE_TYPE':
      return 'Use a valid edge type: HAS_CHARACTER, LOCATED_AT, INVOLVES, MANIFESTS_IN, etc.';

    case 'INVALID_EDGE_SOURCE':
    case 'INVALID_EDGE_TARGET':
      return 'Check the edge type documentation for valid source/target node types';

    default:
      return null;
  }
}

/**
 * Format a single validation error with details.
 */
export function formatValidationError(error: ValidationError, index: number): string {
  const lines: string[] = [];
  const num = pc.dim(`${index + 1}.`);
  const code = pc.red(error.code);

  lines.push(`${num} ${code}`);
  lines.push(`   ${error.message}`);

  if (error.node_id) {
    lines.push(`   ${pc.dim('node:')} ${error.node_id}`);
  }
  if (error.field) {
    lines.push(`   ${pc.dim('field:')} ${error.field}`);
  }
  if (error.op_index !== undefined) {
    lines.push(`   ${pc.dim('operation:')} #${error.op_index + 1}`);
  }

  const fix = getSuggestedFix(error);
  if (fix) {
    lines.push(`   ${pc.cyan('fix:')} ${fix}`);
  }

  return lines.join('\n');
}

/**
 * Format validation errors with structured output and next actions.
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  const lines: string[] = [];

  lines.push(pc.red(pc.bold(`Validation Failed: ${errors.length} error${errors.length === 1 ? '' : 's'}`)));
  lines.push('');

  for (let i = 0; i < errors.length; i++) {
    const error = errors[i];
    if (error) {
      lines.push(formatValidationError(error, i));
      lines.push('');
    }
  }

  lines.push(pc.bold('Next Actions:'));
  lines.push(`  ${pc.dim('•')} Regenerate moves: ${pc.cyan('project-apollo cluster <oq_id> --regenerate')}`);
  lines.push(`  ${pc.dim('•')} Add missing nodes: ${pc.cyan('project-apollo add <type> --name "..."')}`);

  return lines.join('\n');
}

// =============================================================================
// General Formatting
// =============================================================================

export function success(message: string): void {
  console.log(pc.green('✓') + ' ' + message);
}

export function info(message: string): void {
  console.log(pc.blue('ℹ') + ' ' + message);
}

export function warn(message: string): void {
  console.log(pc.yellow('⚠') + ' ' + message);
}

export function heading(text: string): void {
  console.log();
  console.log(pc.bold(text));
  console.log(pc.dim('─'.repeat(text.length)));
}
