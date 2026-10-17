/**
 * Pikchr AST (Abstract Syntax Tree) and Parser Type Definitions
 */

export interface SourcePosition {
  line: number;
  column: number;
  offset: number;
}

export interface SourceLocation {
  start: SourcePosition;
  end: SourcePosition;
}

export interface BaseNode {
  type: string;
  loc?: SourceLocation;
}

// ----------------------------------------------------
// Expression Nodes
// ----------------------------------------------------

export interface NumberLiteralNode extends BaseNode {
  type: 'NumberLiteral';
  value: number;
  unit?: 'in' | 'cm' | 'mm' | 'px' | 'pt' | '%';
  raw: string;
}

export interface StringLiteralNode extends BaseNode {
  type: 'StringLiteral';
  value: string;
}

export interface ColorLiteralNode extends BaseNode {
  type: 'ColorLiteral';
  value: string;
  isHex: boolean;
}

export interface VariableReferenceNode extends BaseNode {
  type: 'VariableReference';
  name: string;
}

export interface ObjectReferenceNode extends BaseNode {
  type: 'ObjectReference';
  raw: string;
  name?: string;               // e.g. "In", "CP", "Tokenizer"
  ordinal?: string;            // e.g. "1st", "2nd", "3rd", "last"
  qualifier?: string;          // e.g. "box", "circle", "line"
  anchor?: string;             // e.g. "n", "sw", "e", "top", "bot", "c"
  component?: 'x' | 'y';       // e.g. "x" or "y" component in In.n.y
  subObject?: ObjectReferenceNode; // e.g. Block.InnerObj
  vertexIndex?: number;        // e.g. "2nd vertex of previous"
}

export interface BinaryExpressionNode extends BaseNode {
  type: 'BinaryExpression';
  operator: '+' | '-' | '*' | '/' | '%' | '==' | '!=' | '<' | '<=' | '>' | '>=';
  left: ExpressionNode;
  right: ExpressionNode;
}

export interface UnaryExpressionNode extends BaseNode {
  type: 'UnaryExpression';
  operator: '+' | '-' | '!';
  argument: ExpressionNode;
}

export interface GroupExpressionNode extends BaseNode {
  type: 'GroupExpression';
  expression: ExpressionNode;
}

export interface FunctionCallNode extends BaseNode {
  type: 'FunctionCall';
  name: string;
  args: ExpressionNode[];
}

export interface CoordinatePairNode extends BaseNode {
  type: 'CoordinatePair';
  x: ExpressionNode;
  y: ExpressionNode;
}

export interface BetweenExpressionNode extends BaseNode {
  type: 'BetweenExpression';
  fraction: ExpressionNode;
  from: ExpressionNode;
  to: ExpressionNode;
}

export interface HeadingExpressionNode extends BaseNode {
  type: 'HeadingExpression';
  distance: ExpressionNode;
  angle: ExpressionNode;
  origin: ExpressionNode;
}

export type ExpressionNode =
  | NumberLiteralNode
  | StringLiteralNode
  | ColorLiteralNode
  | VariableReferenceNode
  | ObjectReferenceNode
  | BinaryExpressionNode
  | UnaryExpressionNode
  | GroupExpressionNode
  | FunctionCallNode
  | CoordinatePairNode
  | BetweenExpressionNode
  | HeadingExpressionNode;

// ----------------------------------------------------
// Attribute Nodes
// ----------------------------------------------------

export interface TextAttributeNode extends BaseNode {
  type: 'TextAttribute';
  text: string;
  modifiers: string[]; // "big", "small", "bold", "italic", "mono", "above", "below", "ljust", "rjust", "aligned"
}

export interface DimensionAttributeNode extends BaseNode {
  type: 'DimensionAttribute';
  name: 'width' | 'height' | 'radius' | 'diameter' | 'thickness';
  rawName: string; // "wid", "ht", "rad", "diam", "thick", etc.
  value: ExpressionNode;
}

export interface SameAttributeNode extends BaseNode {
  type: 'SameAttribute';
  asTarget?: ObjectReferenceNode;
}

export interface FitAttributeNode extends BaseNode {
  type: 'FitAttribute';
}

export interface StyleAttributeNode extends BaseNode {
  type: 'StyleAttribute';
  property: 'fill' | 'color' | 'dashed' | 'dotted' | 'thin' | 'thick' | 'invis';
  rawProperty?: string;
  value?: ExpressionNode;
}

export interface BehindAttributeNode extends BaseNode {
  type: 'BehindAttribute';
  target: ObjectReferenceNode;
}

export interface DirectionAttributeNode extends BaseNode {
  type: 'DirectionAttribute';
  direction: 'right' | 'down' | 'left' | 'up' | 'heading';
  distance?: ExpressionNode;
}

export interface PositionAttributeNode extends BaseNode {
  type: 'PositionAttribute';
  kind: 'at' | 'from' | 'to' | 'with_at' | 'go' | 'chop' | 'until_even_with';
  position?: ExpressionNode;
  anchor?: string;
  direction?: 'right' | 'down' | 'left' | 'up';
  distance?: ExpressionNode;
}

export interface WaypointAttributeNode extends BaseNode {
  type: 'WaypointAttribute';
  direction?: 'right' | 'down' | 'left' | 'up';
  distance?: ExpressionNode;
  untilEvenWith?: ExpressionNode;
  to?: ExpressionNode;
  radius?: ExpressionNode;
}

export interface ArcAttributeNode extends BaseNode {
  type: 'ArcAttribute';
  property: 'cw' | 'ccw' | 'arrow_head';
  rawProperty?: string;
  value?: string;
}

export type AttributeNode =
  | TextAttributeNode
  | DimensionAttributeNode
  | SameAttributeNode
  | FitAttributeNode
  | StyleAttributeNode
  | BehindAttributeNode
  | DirectionAttributeNode
  | PositionAttributeNode
  | WaypointAttributeNode
  | ArcAttributeNode;

// ----------------------------------------------------
// Statement Nodes
// ----------------------------------------------------

export interface ShapeStatementNode extends BaseNode {
  type: 'ShapeStatement';
  label?: string;
  shapeType: string; // 'box' | 'circle' | 'arrow' | 'line' | 'arc' | 'spline' | 'oval' | 'cylinder' | 'diamond' | 'file' | 'dot' | 'text' | 'move'
  attributes: AttributeNode[];
}

export interface BlockStatementNode extends BaseNode {
  type: 'BlockStatement';
  label?: string;
  body: StatementNode[];
  attributes: AttributeNode[];
}

export interface AssignmentStatementNode extends BaseNode {
  type: 'AssignmentStatement';
  variable: string;
  operator: '=' | '+=' | '-=' | '*=' | '/=';
  expression: ExpressionNode;
}

export interface DirectionStatementNode extends BaseNode {
  type: 'DirectionStatement';
  direction: 'right' | 'down' | 'left' | 'up' | 'heading';
  distance?: ExpressionNode;
}

export interface DefineStatementNode extends BaseNode {
  type: 'DefineStatement';
  name: string;
  body: StatementNode[];
  rawBody: string;
}

export interface PrintStatementNode extends BaseNode {
  type: 'PrintStatement';
  kind: 'print' | 'assert';
  args: ExpressionNode[];
}

export interface MacroCallStatementNode extends BaseNode {
  type: 'MacroCallStatement';
  name: string;
}

export interface EmptyStatementNode extends BaseNode {
  type: 'EmptyStatement';
}

export type StatementNode =
  | ShapeStatementNode
  | BlockStatementNode
  | AssignmentStatementNode
  | DirectionStatementNode
  | DefineStatementNode
  | PrintStatementNode
  | MacroCallStatementNode
  | EmptyStatementNode;

export interface ProgramNode extends BaseNode {
  type: 'Program';
  statements: StatementNode[];
}

// ----------------------------------------------------
// Parser & Validation Diagnostics
// ----------------------------------------------------

export interface ParseError {
  message: string;
  line: number;
  column: number;
  offset: number;
  unexpectedToken?: string;
  expected?: string[];
}

export interface ParseResult<T> {
  success: boolean;
  ast?: T;
  error?: ParseError;
}

export interface ValidationIssue {
  severity: 'error' | 'warning';
  message: string;
  line: number;
  column: number;
  offset: number;
  suggestion?: string;
}

export interface StatementValidationResult {
  isValid: boolean;
  isComplete: boolean;
  statement?: StatementNode;
  issues: ValidationIssue[];
}
