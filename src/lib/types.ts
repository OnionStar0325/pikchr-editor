export type PikchrShapeType = 
  | 'arc'
  | 'arrow'
  | 'box'
  | 'circle'
  | 'cylinder'
  | 'diamond'
  | 'dot'
  | 'ellipse'
  | 'file'
  | 'line'
  | 'move'
  | 'oval'
  | 'spline'
  | 'text'
  | 'block'
  | 'direction';

export interface PathSegment {
  direction?: 'right' | 'left' | 'up' | 'down' | '';
  length?: string;
  endMode?: 'none' | 'to' | 'until';
  to?: string;
  until?: string;
  raw?: string;
}

export interface PikchrObjectProperties {
  // Common Box / Shape
  width?: string;
  height?: string;
  radius?: string;
  diameter?: string;
  fill?: string;
  color?: string;
  thickness?: 'thick' | 'thin' | 'solid';
  dash?: 'dashed' | 'dotted';
  fit?: boolean;
  invis?: boolean;
  
  // Connectors / Lines / Arcs / Move
  arrowHead?: '->' | '<-' | '<->' | 'none';
  direction?: 'right' | 'left' | 'up' | 'down';
  length?: string;
  from?: string;
  to?: string;
  until?: string;
  chop?: boolean;
  arcDir?: 'cw' | 'ccw';
  path?: string;
  pathSegments?: PathSegment[];
  
  // Text Attributes
  textPosition?: 'above' | 'below' | 'aligned' | 'center';
  textAlign?: 'ljust' | 'rjust' | 'center';
  textSize?: 'big' | 'small' | 'normal';
  textStyle?: 'bold' | 'italic' | 'mono';
  
  // Placement & Relative Positioning
  at?: string;
  with?: string;
  withAnchor?: string;
  location?: string;
  distance?: string;
  extraModifiers?: string;
}

export type ActiveTargetField = 'at' | 'with' | 'from' | 'to' | 'until' | string | null;

export interface PikchrObject {
  id: string;              // 고유 ID (예: "obj_1", "Server")
  name: string;            // 표시 이름 (예: "Box 1", "Database")
  labelName?: string;      // 선언 앞 레이블 식별자 (예: Server:, DB_1:)
  type: PikchrShapeType;   // 도형/오브젝트 타입
  label?: string;          // 텍스트 라벨 (따옴표 안 문자열)
  lineNumber: number;      // 1-based 시작 라인 번호
  endLineNumber?: number;  // 1-based 끝 라인 번호
  startChar?: number;      // 소스 내 시작 문자 위치 (0-based)
  endChar?: number;        // 소스 내 끝 문자 위치 (0-based)
  rawStatement: string;    // 원본 코드 라인
  properties: PikchrObjectProperties;
}

export interface PikchrDefinition {
  id: string;
  name: string;
  type: 'variable' | 'macro' | 'global_property';
  value: string;
  lineNumber: number;
  endLineNumber?: number;
  startChar?: number;
  endChar?: number;
  rawStatement: string;
}

export interface CompileError {
  line: number;
  column: number;
  message: string;
  rawText: string;
}

export interface CompileResult {
  success: boolean;
  svgHtml: string;
  error: CompileError | null;
  durationMs: number;
}

export interface PaletteItem {
  id: string;
  title: string;
  type: PikchrShapeType;
  category: 'objects' | 'directions' | 'snippets';
  icon: string;
  snippet: string;
  description: string;
}
