/**
 * Output formatting utilities.
 */

import pc from 'picocolors';
import type { OpenQuestion, OQSeverity } from '@apollo/core';

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
