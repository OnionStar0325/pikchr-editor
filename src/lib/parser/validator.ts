/**
 * Pikchr Statement Validator
 * 
 * Performs syntactic and semantic validation for single Pikchr statements.
 * Checks statement boundary, token validity, AST structure, and shape-attribute compatibility.
 */

import { Parser } from './parser';
import { Lexer } from './lexer';
import {
  StatementValidationResult,
  ValidationIssue,
  StatementNode,
  ShapeStatementNode,
} from './types';

// Compatibility matrix based on doc/pikchr_grammar_specification.md
const INCOMPATIBLE_ATTRIBUTES_MAP: Record<string, string[]> = {
  box: ['cw', 'ccw', 'then', 'chop'],
  circle: ['fit', 'cw', 'ccw', 'then', 'chop', 'width', 'wid', 'height', 'ht'],
  cylinder: ['cw', 'ccw', 'then', 'chop'],
  diamond: ['rad', 'radius', 'cw', 'ccw', 'then', 'chop'],
  file: ['cw', 'ccw', 'then', 'chop'],
  oval: ['cw', 'ccw', 'then', 'chop'],
  ellipse: ['cw', 'ccw', 'then', 'chop'],
  dot: ['fit', 'wid', 'width', 'ht', 'height', 'cw', 'ccw', 'then'],
  arrow: ['fit', 'cw', 'ccw'],
  line: ['fit', 'cw', 'ccw'],
  spline: ['fit', 'cw', 'ccw'],
  arc: ['fit'],
  text: ['wid', 'width', 'ht', 'height', 'rad', 'radius', 'fill', 'cw', 'ccw', 'then', 'chop'],
  move: ['fill', 'color', 'dashed', 'dotted', 'thin', 'thick', 'invis', 'fit', 'cw', 'ccw'],
};

export function validatePikchrStatement(statementText: string): StatementValidationResult {
  const issues: ValidationIssue[] = [];
  const trimmed = statementText.trim();

  // 1. Empty statement is valid
  if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) {
    return {
      isValid: true,
      isComplete: true,
      issues: [],
    };
  }

  // 2. Pre-scan: Check unclosed strings
  let inString = false;
  let quoteCount = 0;
  for (let i = 0; i < statementText.length; i++) {
    const ch = statementText[i];
    const prevCh = i > 0 ? statementText[i - 1] : '';
    if (ch === '"' && prevCh !== '\\') {
      inString = !inString;
      quoteCount++;
    }
  }

  if (inString) {
    issues.push({
      severity: 'error',
      message: 'Unterminated string literal (missing closing quote)',
      line: 1,
      column: statementText.lastIndexOf('"') + 1,
      offset: statementText.lastIndexOf('"'),
      suggestion: 'Close the string with a double quotation mark (")',
    });
    return {
      isValid: false,
      isComplete: false,
      issues,
    };
  }

  // 3. Completeness check: trailing incomplete operators or keywords
  const incompleteEndsRegex = /(at|from|to|with|go|chop|then|until|even|between|and|of|heading|fill|color|wid|width|ht|height|rad|radius|thick|thickness|=|\+=|-=|\*=|\/=|\+|-|\*|\/|<|>)\s*$/i;
  if (incompleteEndsRegex.test(trimmed)) {
    // Might be in the middle of typing
    const parseRes = Parser.parseStatement(statementText);
    if (!parseRes.success && parseRes.error) {
      issues.push({
        severity: 'error',
        message: parseRes.error.message,
        line: parseRes.error.line,
        column: parseRes.error.column,
        offset: parseRes.error.offset,
      });
      return {
        isValid: false,
        isComplete: false,
        issues,
      };
    }
  }

  // 4. Recursive descent parse attempt
  const parseResult = Parser.parseStatement(statementText);
  if (!parseResult.success) {
    const err = parseResult.error!;
    issues.push({
      severity: 'error',
      message: err.message,
      line: err.line,
      column: err.column,
      offset: err.offset,
    });
    return {
      isValid: false,
      isComplete: false,
      issues,
    };
  }

  const statement = parseResult.ast!;

  // 5. Semantic checks on AST: Shape attribute compatibility
  if (statement.type === 'ShapeStatement') {
    const shapeStmt = statement as ShapeStatementNode;
    const forbiddenAttrs = INCOMPATIBLE_ATTRIBUTES_MAP[shapeStmt.shapeType];

    if (forbiddenAttrs) {
      for (const attr of shapeStmt.attributes) {
        let attrIdentifier = '';
        if (attr.type === 'DimensionAttribute') attrIdentifier = attr.rawName;
        else if (attr.type === 'FitAttribute') attrIdentifier = 'fit';
        else if (attr.type === 'ArcAttribute') attrIdentifier = attr.property;
        else if (attr.type === 'WaypointAttribute') attrIdentifier = 'then';
        else if (attr.type === 'PositionAttribute') attrIdentifier = attr.kind;

        if (attrIdentifier && forbiddenAttrs.includes(attrIdentifier.toLowerCase())) {
          issues.push({
            severity: 'warning',
            message: `Attribute '${attrIdentifier}' is incompatible or not applicable to shape '${shapeStmt.shapeType}'`,
            line: attr.loc?.start.line || 1,
            column: attr.loc?.start.column || 1,
            offset: attr.loc?.start.offset || 0,
            suggestion: `Remove '${attrIdentifier}' from '${shapeStmt.shapeType}' declaration`,
          });
        }
      }
    }
  }

  return {
    isValid: issues.filter(i => i.severity === 'error').length === 0,
    isComplete: true,
    statement,
    issues,
  };
}
