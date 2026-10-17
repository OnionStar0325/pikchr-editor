import { CompileResult, CompileError, PikchrObject, PikchrDefinition, PikchrShapeType, PathSegment } from './types';
export { isContinuationLine, containsStatementTerminator, isStatementCompleted } from './statementDetector';
import { Parser } from './parser';

// Pikchr WASM / JS 컴파일러 인스턴스
let pikchrInstance: ((source: string, classname?: string, flags?: number) => string) | null = null;
let initPromise: Promise<void> | null = null;

export async function initPikchr(): Promise<void> {
  if (pikchrInstance) return;
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const pikchrLoader = await import('pikchr-js');
        const fn = typeof pikchrLoader.default === 'function' ? await pikchrLoader.default() : await (pikchrLoader as any)();
        pikchrInstance = fn;
      } catch (err) {
        console.error('Failed to initialize pikchr compiler:', err);
        throw err;
      }
    })();
  }
  return initPromise;
}

/**
 * Pikchr 에러 메시지 텍스트 파싱
 */
export function parsePikchrError(errorHtmlOrText: string): CompileError {
  let text = errorHtmlOrText;
  text = text.replace(/<pre>/gi, '').replace(/<\/pre>/gi, '').replace(/<div>/gi, '').replace(/<\/div>/gi, '');

  let line = 1;
  let column = 1;
  let message = 'Syntax error';

  const lines = text.split('\n');
  const caretLineIdx = lines.findIndex(l => l.includes('^'));

  if (caretLineIdx > 0) {
    // 에러 발생 라인은 caret(^) 바로 윗줄의 주석 /* N */ 에서 추출
    const errSourceLine = lines[caretLineIdx - 1];
    const lineMatch = errSourceLine.match(/\/\*\s*(\d+)\s*\*\//);
    if (lineMatch && lineMatch[1]) {
      line = parseInt(lineMatch[1], 10);
    }

    const caretLine = lines[caretLineIdx];
    const caretCol = caretLine.indexOf('^');
    const matchPrefix = errSourceLine.match(/^(\/\*\s*\d+\s*\*\/\s*)/);
    const codePrefixLen = matchPrefix ? matchPrefix[1].length : 12;

    column = Math.max(1, caretCol - codePrefixLen + 1);
  } else {
    // caret 라인이 없는 경우 마지막으로 출력된 /* N */ 라인 번호 사용
    const allLineMatches = [...text.matchAll(/\/\*\s*(\d+)\s*\*\//g)];
    if (allLineMatches.length > 0) {
      line = parseInt(allLineMatches[allLineMatches.length - 1][1], 10);
    }
  }

  const errorMsgMatch = text.match(/ERROR:\s*(.+)/i);
  if (errorMsgMatch && errorMsgMatch[1]) {
    message = errorMsgMatch[1].trim();
  }

  return {
    line,
    column,
    message,
    rawText: text.trim(),
  };
}

/**
 * Pikchr 코드 컴파일 함수
 */
export async function compilePikchr(source: string, darkMode = false): Promise<CompileResult> {
  const startTime = performance.now();
  await initPikchr();

  if (!pikchrInstance) {
    return {
      success: false,
      svgHtml: '',
      error: { line: 1, column: 1, message: 'Compiler not initialized', rawText: '' },
      durationMs: 0,
    };
  }

  try {
    const flags = darkMode ? 2 : 0;
    const rawOutput = pikchrInstance(source, 'pikchr', flags);

    if (rawOutput.includes('ERROR:') || rawOutput.startsWith('<div><pre>') || rawOutput.startsWith('/*')) {
      const error = parsePikchrError(rawOutput);
      return {
        success: false,
        svgHtml: '',
        error,
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    const taggedSvg = tagSvgElements(rawOutput, source);

    return {
      success: true,
      svgHtml: taggedSvg,
      error: null,
      durationMs: Math.round(performance.now() - startTime),
    };
  } catch (err: any) {
    return {
      success: false,
      svgHtml: '',
      error: {
        line: 1,
        column: 1,
        message: err.message || 'Unknown compilation error',
        rawText: String(err),
      },
      durationMs: Math.round(performance.now() - startTime),
    };
  }
}

const SHAPE_KEYWORDS: PikchrShapeType[] = [
  'arc',
  'arrow',
  'box',
  'circle',
  'cylinder',
  'diamond',
  'dot',
  'ellipse',
  'file',
  'line',
  'move',
  'oval',
  'spline',
  'text',
  'block',
];

const DIRECTION_KEYWORDS = ['right', 'down', 'left', 'up', 'heading'];

export const GLOBAL_PROPERTY_NAMES = new Set([
  'scale',
  'fontscale',
  'charht',
  'charwid',
  'lineht',
  'linewid',
  'linerad',
  'boxwid',
  'boxht',
  'boxrad',
  'circlerad',
  'circlrad',
  'cylwid',
  'cylht',
  'cylinderwid',
  'cylinderht',
  'filewid',
  'fileht',
  'filerand',
  'ovalwid',
  'ovalht',
  'arrowwid',
  'arrowht',
  'dotrad',
  'textoffset',
  'fill',
  'color',
  'thickness',
]);

export interface ScannedStatement {
  id: string;
  text: string;
  raw: string;
  lineNumber: number;
  endLineNumber: number;
  startChar: number;
  endChar: number;
}

/**
 * 소스 코드를 문자 단위로 스캔하여 개별 문장(Statement)과 정확한 문자 위치 범위(startChar, endChar, lineNumber, endLineNumber)를 파싱
 */
export function scanSourceStatements(source: string): ScannedStatement[] {
  const statements: ScannedStatement[] = [];
  const len = source.length;
  if (len === 0) return statements;

  // 줄 번호 인덱스 테이블 구축
  const lineStartOffsets: number[] = [0];
  for (let idx = 0; idx < len; idx++) {
    if (source[idx] === '\n') {
      lineStartOffsets.push(idx + 1);
    }
  }

  const getLineFromCharIndex = (charIdx: number): number => {
    let low = 0, high = lineStartOffsets.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (lineStartOffsets[mid] <= charIdx) {
        if (mid === lineStartOffsets.length - 1 || lineStartOffsets[mid + 1] > charIdx) {
          return mid + 1;
        }
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return 1;
  };

  let i = 0;
  let stmtStart = 0;
  let inString = false;
  let inSingleComment = false;
  let inMultiComment = false;
  let braceDepth = 0;

  const pushStatement = (startIdx: number, endIdx: number) => {
    if (startIdx >= endIdx) return;

    let actualStart = startIdx;
    while (actualStart < endIdx && /\s/.test(source[actualStart])) {
      actualStart++;
    }
    let actualEnd = endIdx;
    while (actualEnd > actualStart && /\s/.test(source[actualEnd - 1])) {
      actualEnd--;
    }

    if (actualStart >= actualEnd) return;

    const raw = source.substring(actualStart, actualEnd);
    const trimmed = raw.trim();
    if (trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
      return;
    }

    const startLine = getLineFromCharIndex(actualStart);
    const endLine = getLineFromCharIndex(actualEnd - 1);
    const id = `stmt_${startLine}_${actualStart}`;
    const cleanedText = raw.replace(/\\[ \t]*\r?\n[ \t]*/g, ' ').trim();

    statements.push({
      id,
      text: cleanedText,
      raw,
      lineNumber: startLine,
      endLineNumber: endLine,
      startChar: actualStart,
      endChar: actualEnd,
    });
  };

  while (i < len) {
    const ch = source[i];
    const nextCh = i + 1 < len ? source[i + 1] : '';

    if (inSingleComment) {
      if (ch === '\n') {
        inSingleComment = false;
        if (braceDepth === 0) {
          pushStatement(stmtStart, i);
          stmtStart = i + 1;
        }
      }
      i++;
      continue;
    }

    if (inMultiComment) {
      if (ch === '*' && nextCh === '/') {
        inMultiComment = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    if (inString) {
      if (ch === '\\' && nextCh === '"') {
        i += 2;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      i++;
      continue;
    }

    if (ch === '"') {
      inString = true;
      i++;
      continue;
    }

    if (ch === '/' && nextCh === '/') {
      inSingleComment = true;
      i += 2;
      continue;
    }

    if (ch === '#') {
      inSingleComment = true;
      i++;
      continue;
    }

    if (ch === '/' && nextCh === '*') {
      inMultiComment = true;
      i += 2;
      continue;
    }

    if (ch === '{') {
      braceDepth++;
      i++;
      continue;
    }

    if (ch === '}') {
      if (braceDepth > 0) {
        braceDepth--;
        if (braceDepth === 0) {
          pushStatement(stmtStart, i + 1);
          stmtStart = i + 1;
        }
      }
      i++;
      continue;
    }

    if (braceDepth === 0) {
      if (ch === ';') {
        pushStatement(stmtStart, i);
        stmtStart = i + 1;
        i++;
        continue;
      }

      if (ch === '\\') {
        let j = i + 1;
        let isContinuation = false;
        while (j < len && source[j] !== '\n') {
          if (source[j] === '#' || (source[j] === '/' && source[j + 1] === '/')) {
            isContinuation = true;
            break;
          }
          if (!/\s/.test(source[j])) {
            break;
          }
          j++;
        }
        if (j === len || source[j] === '\n' || isContinuation) {
          while (j < len && source[j] !== '\n') j++;
          if (j < len && source[j] === '\n') j++;
          i = j;
          continue;
        }
      }

      if (ch === '\n') {
        pushStatement(stmtStart, i);
        stmtStart = i + 1;
        i++;
        continue;
      }
    }

    i++;
  }

  if (stmtStart < len) {
    pushStatement(stmtStart, len);
  }

  return statements;
}

/**
 * 소스 코드를 파싱하여 정의(변수, 매크로, scale 등) 목록 추출
 */
export function parseDefinitionsFromSource(source: string): PikchrDefinition[] {
  const parseRes = Parser.parse(source);
  if (parseRes.success && parseRes.ast) {
    const definitions: PikchrDefinition[] = [];
    for (const stmt of parseRes.ast.statements) {
      if (stmt.type === 'AssignmentStatement') {
        const varName = stmt.variable;
        const op = stmt.operator;
        const startChar = stmt.loc ? stmt.loc.start.offset : 0;
        const endChar = stmt.loc ? stmt.loc.end.offset : 0;
        const lineNumber = stmt.loc ? stmt.loc.start.line : 1;
        const endLineNumber = stmt.loc ? stmt.loc.end.line : lineNumber;
        const rawStatement = source.substring(startChar, endChar);
        const rawExpr = rawStatement.replace(/^[^=+\-*/]*[+\-*/]?=\s*/, '').trim();
        const value = op === '=' ? rawExpr : `${op} ${rawExpr}`;
        const isGlobalProp = GLOBAL_PROPERTY_NAMES.has(varName.toLowerCase());

        definitions.push({
          id: `var_${varName}_${lineNumber}_${definitions.length}`,
          name: varName,
          type: isGlobalProp ? 'global_property' : 'variable',
          value,
          lineNumber,
          endLineNumber,
          startChar,
          endChar,
          rawStatement,
        });
      } else if (stmt.type === 'DefineStatement') {
        const macroName = stmt.name;
        const startChar = stmt.loc ? stmt.loc.start.offset : 0;
        const endChar = stmt.loc ? stmt.loc.end.offset : 0;
        const lineNumber = stmt.loc ? stmt.loc.start.line : 1;
        const endLineNumber = stmt.loc ? stmt.loc.end.line : lineNumber;
        const rawStatement = source.substring(startChar, endChar);
        const bodyMatch = rawStatement.match(/^define\s+[a-zA-Z0-9_]+\s*\{([\s\S]*)\}$/i);
        const value = bodyMatch ? bodyMatch[1].trim() : rawStatement;

        definitions.push({
          id: `macro_${macroName}_${lineNumber}`,
          name: macroName,
          type: 'macro',
          value,
          lineNumber,
          endLineNumber,
          startChar,
          endChar,
          rawStatement,
        });
      }
    }
    return definitions;
  }

  const scanned = scanSourceStatements(source);
  const definitions: PikchrDefinition[] = [];

  scanned.forEach(stmt => {
    const trimmed = stmt.text.trim();
    if (!trimmed) return;

    // 1. 매크로 정의: define macroname { ... }
    const macroStartMatch = trimmed.match(/^define\s+([a-zA-Z0-9_]+)\s*\{([\s\S]*)\}$/i);
    if (macroStartMatch) {
      const macroName = macroStartMatch[1];
      const body = macroStartMatch[2].trim();
      definitions.push({
        id: `macro_${macroName}_${stmt.lineNumber}`,
        name: macroName,
        type: 'macro',
        value: body,
        lineNumber: stmt.lineNumber,
        endLineNumber: stmt.endLineNumber,
        startChar: stmt.startChar,
        endChar: stmt.endChar,
        rawStatement: stmt.raw,
      });
      return;
    }

    // 2. 변수 / 전역 프로퍼티 대입문 (=, *=, +=, -=, /=)
    const varMatch = trimmed.match(/^([$@a-zA-Z][a-zA-Z0-9_]*)\s*([+\-*/]?=)\s*(.+)$/);
    if (varMatch) {
      const varName = varMatch[1];
      const op = varMatch[2];
      const rawVal = varMatch[3].trim();
      const value = op === '=' ? rawVal : `${op} ${rawVal}`;
      const isGlobalProp = GLOBAL_PROPERTY_NAMES.has(varName.toLowerCase());

      definitions.push({
        id: `var_${varName}_${stmt.lineNumber}_${definitions.length}`,
        name: varName,
        type: isGlobalProp ? 'global_property' : 'variable',
        value,
        lineNumber: stmt.lineNumber,
        endLineNumber: stmt.endLineNumber,
        startChar: stmt.startChar,
        endChar: stmt.endChar,
        rawStatement: stmt.raw,
      });
    }
  });

  return definitions;
}

/**
 * 세미콜론(;)으로 구분된 복수 문장을 분리 (따옴표 내부 세미콜론 무시)
 */
export function splitStatements(line: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inString = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && (i === 0 || line[i - 1] !== '\\')) {
      inString = !inString;
      current += ch;
    } else if (ch === ';' && !inString) {
      if (current.trim()) statements.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

export interface ExpandedStatement {
  id: string;
  text: string;
  raw: string;
  lineNumber: number;
  endLineNumber: number;
  startChar: number;
  endChar: number;
}

/**
 * 매크로(define ... { ... }) 추출 및 논리행 병합, 세미콜론 분리, 매크로 호출 인라인 확장을 수행
 */
function getExpandedStatements(source: string): ExpandedStatement[] {
  const scanned = scanSourceStatements(source);
  const macros = new Map<string, string[]>();

  scanned.forEach(stmt => {
    const macroMatch = stmt.text.match(/^define\s+([a-zA-Z0-9_]+)\s*\{([\s\S]*)\}$/i);
    if (macroMatch) {
      const name = macroMatch[1];
      const body = macroMatch[2].trim();
      macros.set(name, splitStatements(body));
    }
  });

  const expanded: ExpandedStatement[] = [];
  scanned.forEach((stmt, idx) => {
    const s = stmt.text.trim();
    if (!s) return;
    if (macros.has(s)) {
      const macroStmts = macros.get(s)!;
      macroStmts.forEach((mStmt, mIdx) => {
        expanded.push({
          id: `${stmt.id}_m${mIdx + 1}`,
          text: mStmt,
          raw: mStmt,
          lineNumber: stmt.lineNumber,
          endLineNumber: stmt.endLineNumber,
          startChar: stmt.startChar,
          endChar: stmt.endChar,
        });
      });
    } else {
      expanded.push({
        id: `obj_${stmt.lineNumber}_${idx + 1}`,
        text: stmt.text,
        raw: stmt.raw,
        lineNumber: stmt.lineNumber,
        endLineNumber: stmt.endLineNumber,
        startChar: stmt.startChar,
        endChar: stmt.endChar,
      });
    }
  });

  return expanded;
}

function parseObjectsFromAst(source: string): PikchrObject[] | null {
  const parseRes = Parser.parse(source);
  if (!parseRes.success || !parseRes.ast) return null;

  const objects: PikchrObject[] = [];
  let unnamedVisualCount = 0;

  const getAttrVal = (attr: any, kwRegex: string): string => {
    if (!attr.loc) return '';
    const full = source.substring(attr.loc.start.offset, attr.loc.end.offset).trim();
    const regex = new RegExp('^' + kwRegex + '\\s*', 'i');
    return full.replace(regex, '').replace(/\\\s*$/, '').trim();
  };

  const macros = new Map<string, any[]>();
  for (const s of parseRes.ast.statements) {
    if (s.type === 'DefineStatement') {
      macros.set((s as any).name, (s as any).body || []);
    }
  }

  const processStatement = (stmt: any) => {
    if (stmt.type === 'ShapeStatement') {
      unnamedVisualCount++;
      const s = stmt as any;
      const startChar = s.loc ? s.loc.start.offset : 0;
      const endChar = s.loc ? s.loc.end.offset : 0;
      const lineNumber = s.loc ? s.loc.start.line : 1;
      const endLineNumber = s.loc ? s.loc.end.line : lineNumber;
      const rawStatement = source.substring(startChar, endChar);

      const properties: PikchrObject['properties'] = {};
      const labels: string[] = [];

      for (const attr of s.attributes) {
        if (attr.type === 'TextAttribute') {
          labels.push(attr.text);
          if (attr.modifiers) {
            for (const mod of attr.modifiers) {
              if (['italic', 'bold', 'mono'].includes(mod)) properties.textStyle = mod as any;
              else if (['big', 'small'].includes(mod)) properties.textSize = mod as any;
              else if (['above', 'below', 'aligned', 'center'].includes(mod)) properties.textPosition = mod as any;
              else if (['ljust', 'rjust'].includes(mod)) properties.textAlign = mod as any;
            }
          }
        } else if (attr.type === 'StyleAttribute') {
          if (attr.property === 'fill') properties.fill = getAttrVal(attr, 'fill');
          else if (attr.property === 'color') properties.color = getAttrVal(attr, 'color');
          else if (attr.property === 'thick' || attr.property === 'thin') properties.thickness = attr.property;
          else if (attr.property === 'dashed' || attr.property === 'dotted') properties.dash = attr.property;
          else if (attr.property === 'invis') properties.invis = true;
        } else if (attr.type === 'DimensionAttribute') {
          const val = getAttrVal(attr, attr.rawName || attr.name);
          if (attr.name === 'width') properties.width = val;
          else if (attr.name === 'height') properties.height = val;
          else if (attr.name === 'radius') properties.radius = val;
          else if (attr.name === 'diameter') properties.diameter = val;
          else if (attr.name === 'thickness') properties.thickness = val as any;
        } else if (attr.type === 'PositionAttribute') {
          if (attr.kind === 'from') properties.from = getAttrVal(attr, 'from');
          else if (attr.kind === 'to') properties.to = getAttrVal(attr, 'to');
          else if (attr.kind === 'at') properties.at = getAttrVal(attr, 'at');
          else if (attr.kind === 'with_at') {
            properties.with = attr.anchor;
            properties.withAnchor = attr.anchor;
            properties.at = getAttrVal(attr, 'with\\s+[^\\s]+\\s+at');
          } else if (attr.kind === 'chop') properties.chop = true;
          else if (attr.kind === 'until_even_with') properties.until = getAttrVal(attr, 'until(?:\\s+even\\s+with)?');
        } else if (attr.type === 'DirectionAttribute') {
          properties.direction = attr.direction;
          if (attr.distance) properties.length = getAttrVal(attr, attr.direction);
        } else if (attr.type === 'ArcAttribute') {
          if (attr.property === 'arrow_head') properties.arrowHead = attr.value;
          else if (attr.property === 'cw' || attr.property === 'ccw') properties.arcDir = attr.property;
        } else if (attr.type === 'FitAttribute') {
          properties.fit = true;
        } else if (attr.type === 'BehindAttribute') {
          const b = getAttrVal(attr, 'behind');
          properties.extraModifiers = properties.extraModifiers ? `${properties.extraModifiers} behind ${b}` : `behind ${b}`;
        } else if (attr.type === 'SameAttribute') {
          const sm = attr.asTarget ? `same as ${getAttrVal(attr, 'same\\s+as')}` : 'same';
          properties.extraModifiers = properties.extraModifiers ? `${properties.extraModifiers} ${sm}` : sm;
        }
      }

      // 커넥터/경로 오브젝트의 경우 path 및 pathSegments 구성
      if (['arrow', 'line', 'spline', 'move'].includes(s.shapeType)) {
        const rawPath = extractConnectorPath(rawStatement, s.shapeType);
        if (rawPath) {
          properties.path = rawPath;
          const parsedSegments = parsePathIntoSegments(rawPath);
          if (parsedSegments.segments.length > 0) {
            properties.pathSegments = parsedSegments.segments;
          }
        }
      }

      const labelText = labels.join(' ');
      const id = `obj_${lineNumber}_${objects.length + 1}`;
      const displayName = s.label
        ? `${s.label}${labelText ? ` ("${labelText}")` : ` (${s.shapeType})`}`
        : (labelText ? `"${labelText}"` : `${s.shapeType} ${unnamedVisualCount}`);

      objects.push({
        id,
        name: displayName,
        labelName: s.label,
        type: s.shapeType as PikchrShapeType,
        label: labelText,
        lineNumber,
        endLineNumber,
        startChar,
        endChar,
        rawStatement,
        properties,
      });
    } else if (stmt.type === 'DirectionStatement') {
      unnamedVisualCount++;
      const s = stmt as any;
      const startChar = s.loc ? s.loc.start.offset : 0;
      const endChar = s.loc ? s.loc.end.offset : 0;
      const lineNumber = s.loc ? s.loc.start.line : 1;
      const endLineNumber = s.loc ? s.loc.end.line : lineNumber;
      const rawStatement = source.substring(startChar, endChar);
      const id = `obj_${lineNumber}_${objects.length + 1}`;
      objects.push({
        id,
        name: rawStatement,
        type: 'direction',
        label: '',
        lineNumber,
        endLineNumber,
        startChar,
        endChar,
        rawStatement,
        properties: {
          direction: s.direction,
          length: s.distance ? getAttrVal(s, s.direction) : undefined,
        },
      });
    } else if (stmt.type === 'BlockStatement' && Array.isArray((stmt as any).body)) {
      for (const inner of (stmt as any).body) {
        processStatement(inner);
      }
    } else if (stmt.type === 'MacroCallStatement' && macros.has((stmt as any).name)) {
      const macroBody = macros.get((stmt as any).name)!;
      for (const mStmt of macroBody) {
        processStatement(mStmt);
      }
    }
  };

  for (const stmt of parseRes.ast.statements) {
    processStatement(stmt);
  }

  return objects;
}

/**
 * 소스 코드를 파싱하여 오브젝트 메타데이터 목록 생성
 */
export function parseObjectsFromSource(source: string): PikchrObject[] {
  const astObjects = parseObjectsFromAst(source);
  if (astObjects) {
    return astObjects;
  }

  const expanded = getExpandedStatements(source);
  const objects: PikchrObject[] = [];
  let unnamedVisualCount = 0;

  expanded.forEach(({ id, text, lineNumber, endLineNumber, startChar, endChar, raw }) => {
    const trimmed = text.trim();

    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
      return;
    }

    // define 문장이나 대입문(=, *=, +=, -=, /=) 또는 블록 괄호 등은 오브젝트 목록에서 제외
    if (
      trimmed.startsWith('define ') || 
      trimmed === '}' || 
      trimmed === '{' ||
      trimmed === ']' ||
      trimmed === '[' ||
      /^[a-zA-Z$@][a-zA-Z0-9_]*\s*([+\-*/]?=)\s*/.test(trimmed)
    ) {
      return;
    }

    let labelDef: string | undefined;
    let statement = trimmed;

    const labelColonMatch = trimmed.match(/^([A-Z][a-zA-Z0-9_]*)\s*:\s*(.*)$/);
    if (labelColonMatch) {
      labelDef = labelColonMatch[1];
      statement = labelColonMatch[2].trim();
    }

    let matchedType: PikchrShapeType | null = null;
    if (statement.startsWith('"') || /^\s*"/.test(statement)) {
      matchedType = 'text';
    } else {
      // 따옴표 문자열 내부 단어 및 상대 참조(last arrow 등) 제거 후 키워드 탐색
      const nonStringStatement = statement.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, '');
      const nonRelative = nonStringStatement.replace(/\b(?:last|first|previous|\d+(?:st|nd|rd|th)?\s+last)\s+[a-z]+/gi, '');
      const words = nonRelative.trim().split(/\s+/);

      for (const word of words) {
        const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '');
        if (SHAPE_KEYWORDS.includes(cleanWord as PikchrShapeType)) {
          matchedType = cleanWord as PikchrShapeType;
          break;
        }
      }

      if (!matchedType) {
        const firstWord = words[0]?.toLowerCase().replace(/[^a-z]/g, '');
        if (DIRECTION_KEYWORDS.includes(firstWord)) {
          matchedType = 'direction';
        } else if (statement.includes('->') || statement.includes('<-')) {
          matchedType = 'arrow';
        } else if (statement.startsWith('[') || statement.includes('[')) {
          matchedType = 'block';
        } else if (statement.startsWith('"') || /^\s*"/.test(statement)) {
          matchedType = 'text';
        } else {
          return;
        }
      }
    }

    let labelText = '';
    const textMatches = statement.match(/"([^"\\]*(?:\\.[^"\\]*)*)"/g);
    if (textMatches && textMatches.length > 0) {
      labelText = textMatches.map(m => m.replace(/^"|"$/g, '')).join(' ');
    }

    const objectId = id || `obj_${lineNumber}_${objects.length + 1}`;
    unnamedVisualCount++;

    const displayName = labelDef 
      ? `${labelDef}${labelText ? ` ("${labelText}")` : ` (${matchedType})`}`
      : (matchedType === 'direction' || matchedType === 'move'
          ? statement 
          : (labelText ? `"${labelText}"` : `${matchedType} ${unnamedVisualCount}`));

    const properties: PikchrObject['properties'] = {};

    // Color & Fill
    const fillMatch = statement.match(/\bfill\s+(0x[0-9a-fA-F]+|[a-zA-Z]+)/i);
    if (fillMatch) properties.fill = fillMatch[1];

    const colorMatch = statement.match(/\bcolor\s+(0x[0-9a-fA-F]+|[a-zA-Z]+)/i);
    if (colorMatch) properties.color = colorMatch[1];

    // Dimensions
    const widthMatch = statement.match(/\b(?:width|wid)\s+([0-9.]+(?:in|cm|px|pt|mm|%)?)/i);
    if (widthMatch) properties.width = widthMatch[1];

    const heightMatch = statement.match(/\b(?:height|ht)\s+([0-9.]+(?:in|cm|px|pt|mm|%)?)/i);
    if (heightMatch) properties.height = heightMatch[1];

    const radiusMatch = statement.match(/\b(?:radius|rad)\s+([0-9.]+(?:in|cm|px|pt|mm|%)?)/i);
    if (radiusMatch) properties.radius = radiusMatch[1];

    const diameterMatch = statement.match(/\b(?:diameter|diam)\s+([0-9.]+(?:in|cm|px|pt|mm|%)?)/i);
    if (diameterMatch) properties.diameter = diameterMatch[1];

    // Length / Distance
    const lengthMatch = statement.match(/\b(?:right|left|up|down|heading\s+[0-9.]+)\s+([0-9.]+(?:in|cm|px|pt|mm|%)?)/i);
    if (lengthMatch) properties.length = lengthMatch[1];

    // From / To endpoints (문장 끝 또는 다음 키워드까지 정확하게 추출)
    const fromMatch = statement.match(/\bfrom\s+([^;]+?)(?=\s+(?:to|then|go|until|with|at|heading|cw|ccw|chop|thick|thin|solid|dashed|dotted|color|fill|rad|radius|diam|diameter|wid|width|ht|height|behind|fit|invis|invisible|above|below|aligned|ljust|rjust|big|small|bold|italic|mono|")|$)/i);
    if (fromMatch) properties.from = fromMatch[1].trim();

    const toMatch = statement.match(/\bto\s+([^;]+?)(?=\s+(?:then|go|until|with|at|heading|cw|ccw|chop|thick|thin|solid|dashed|dotted|color|fill|rad|radius|diam|diameter|wid|width|ht|height|behind|fit|invis|invisible|above|below|aligned|ljust|rjust|big|small|bold|italic|mono|")|$)/i);
    if (toMatch) properties.to = toMatch[1].trim();

    // with <anchor / expression>
    const withMatch = statement.match(/\bwith\s+([^;]+?)(?=\s+(?:at|as|fit|fill|color|thick|thin|solid|dashed|dotted|invis|invisible|behind|rad|radius|wid|width|ht|height|")|$)/i);
    if (withMatch) {
      const val = withMatch[1].trim();
      properties.with = val;
      properties.withAnchor = val;
    }

    // at <position>
    const atMatch = statement.match(/\bat\s+([^;]+?)(?=\s+(?:with|fit|fill|color|thick|thin|solid|dashed|dotted|invis|invisible|behind|rad|radius|wid|width|ht|height|")|$)/i);
    if (atMatch) {
      properties.at = atMatch[1].trim();
    }

    // until <position>
    const untilMatch = statement.match(/\buntil\s+([^;]+?)(?=\s+(?:then|go|with|at|heading|cw|ccw|chop|thick|thin|solid|dashed|dotted|color|fill|rad|radius|diam|diameter|wid|width|ht|height|")|$)/i);
    if (untilMatch) {
      properties.until = untilMatch[1].trim();
    }

    // Strip text inside quotes and clauses (at, with, from, to, until, fill, color, etc.)
    // to prevent false matches on keywords like "below" in "at 0.1cm below CG.se" or text in quotes
    let modifiersText = statement.replace(/"(?:\\.|[^"\\])*"/g, ' ');
    if (fromMatch) modifiersText = modifiersText.replace(fromMatch[0], ' ');
    if (toMatch) modifiersText = modifiersText.replace(toMatch[0], ' ');
    if (withMatch) modifiersText = modifiersText.replace(withMatch[0], ' ');
    if (atMatch) modifiersText = modifiersText.replace(atMatch[0], ' ');
    if (untilMatch) modifiersText = modifiersText.replace(untilMatch[0], ' ');
    if (fillMatch) modifiersText = modifiersText.replace(fillMatch[0], ' ');
    if (colorMatch) modifiersText = modifiersText.replace(colorMatch[0], ' ');
    if (widthMatch) modifiersText = modifiersText.replace(widthMatch[0], ' ');
    if (heightMatch) modifiersText = modifiersText.replace(heightMatch[0], ' ');
    if (radiusMatch) modifiersText = modifiersText.replace(radiusMatch[0], ' ');
    if (diameterMatch) modifiersText = modifiersText.replace(diameterMatch[0], ' ');
    if (lengthMatch) modifiersText = modifiersText.replace(lengthMatch[0], ' ');

    // Stroke & Style
    if (/\bthick\b/i.test(modifiersText)) properties.thickness = 'thick';
    else if (/\bthin\b/i.test(modifiersText)) properties.thickness = 'thin';
    else if (/\bsolid\b/i.test(modifiersText)) properties.thickness = 'solid';

    if (/\bdashed\b/i.test(modifiersText)) properties.dash = 'dashed';
    else if (/\bdotted\b/i.test(modifiersText)) properties.dash = 'dotted';

    if (/\bfit\b/i.test(modifiersText)) properties.fit = true;
    if (/\b(?:invis|invisible)\b/i.test(modifiersText)) properties.invis = true;
    if (/\bchop\b/i.test(modifiersText)) properties.chop = true;

    // Arrowheads
    if (modifiersText.includes('<->')) properties.arrowHead = '<->';
    else if (modifiersText.includes('<-')) properties.arrowHead = '<-';
    else if (modifiersText.includes('->')) properties.arrowHead = '->';

    // Arc Direction
    if (/\bcw\b/i.test(modifiersText)) properties.arcDir = 'cw';
    else if (/\bccw\b/i.test(modifiersText)) properties.arcDir = 'ccw';

    // Directions
    if (/\b(right)\b/i.test(modifiersText)) properties.direction = 'right';
    else if (/\b(left)\b/i.test(modifiersText)) properties.direction = 'left';
    else if (/\b(up)\b/i.test(modifiersText)) properties.direction = 'up';
    else if (/\b(down)\b/i.test(modifiersText)) properties.direction = 'down';

    // Text Position (위치: above, below, aligned, center)
    if (/\babove\b/i.test(modifiersText)) properties.textPosition = 'above';
    else if (/\bbelow\b/i.test(modifiersText)) properties.textPosition = 'below';
    else if (/\baligned\b/i.test(modifiersText)) properties.textPosition = 'aligned';
    else if (/\bcenter\b/i.test(modifiersText)) properties.textPosition = 'center';

    // Text Alignment (정렬: ljust, rjust, center)
    if (/\bljust\b/i.test(modifiersText)) properties.textAlign = 'ljust';
    else if (/\brjust\b/i.test(modifiersText)) properties.textAlign = 'rjust';

    if (/\bbig\b/i.test(modifiersText)) properties.textSize = 'big';
    else if (/\bsmall\b/i.test(modifiersText)) properties.textSize = 'small';

    if (/\bbold\b/i.test(modifiersText)) properties.textStyle = 'bold';
    else if (/\bitalic\b/i.test(modifiersText)) properties.textStyle = 'italic';
    else if (/\b(?:mono|monospace)\b/i.test(modifiersText)) properties.textStyle = 'mono';

    // 속성 창에서 직접 관리하지 않는 비표준/추가 키워드(예: same, same as 1st box, behind B1 등) 보존 추출
    let unmanagedText = modifiersText;
    // 시작 부분의 라벨 식별자(예: "UT:") 제거
    unmanagedText = unmanagedText.replace(/^\s*(?:[A-Z][a-zA-Z0-9_]*\s*:\s*)?/i, ' ');
    // 시작 부분의 객체 타입 키워드(예: "box")만 1회 제거 (주의: "same as 1st box" 등 상대 참조 내부의 box가 제거되지 않도록 ^\s* 적용)
    unmanagedText = unmanagedText.replace(new RegExp('^\\s*\\b' + matchedType + '\\b', 'i'), ' ');
    unmanagedText = unmanagedText.replace(/\b(?:thick|thin|solid|dashed|dotted|fit|chop|cw|ccw)\b/gi, ' ');
    unmanagedText = unmanagedText.replace(/\b(?:invis|invisible)\b/gi, ' ');
    unmanagedText = unmanagedText.replace(/(<->|<-|->)/g, ' ');
    unmanagedText = unmanagedText.replace(/\b(?:above|below|aligned|center|ljust|rjust|big|small|bold|italic|mono|monospace)\b/gi, ' ');
    if (['arrow', 'line', 'spline', 'arc', 'move'].includes(matchedType)) {
      unmanagedText = unmanagedText.replace(/\b(?:then|go)\b/gi, ' ');
      unmanagedText = unmanagedText.replace(/\b(?:right|left|up|down)\b/gi, ' ');
    } else if (matchedType === 'direction') {
      unmanagedText = unmanagedText.replace(/\b(?:right|left|up|down)\b/gi, ' ');
    }

    const trimmedUnmanaged = unmanagedText.trim().replace(/\s+/g, ' ');
    if (trimmedUnmanaged) {
      properties.extraModifiers = trimmedUnmanaged;
    }

    // 선형/이동 객체의 다구간 패스(Multi-segment Path) 파싱 및 to/until 상호배타 보정
    if (['arrow', 'line', 'spline', 'arc', 'move'].includes(matchedType)) {
      const rawPath = extractConnectorPath(statement, matchedType);
      properties.path = rawPath;
      const parsedPath = parsePathIntoSegments(rawPath);
      properties.pathSegments = parsedPath.segments;
      if (parsedPath.from) properties.from = parsedPath.from;
      if (parsedPath.segments.length === 1) {
        const seg0 = parsedPath.segments[0];
        if (seg0.direction) properties.direction = seg0.direction as any;
        if (seg0.length) properties.length = seg0.length;
        if (seg0.endMode === 'to') {
          properties.to = seg0.to;
          properties.until = undefined;
        } else if (seg0.endMode === 'until') {
          properties.until = seg0.until;
          properties.to = undefined;
        }
      }
    }

    objects.push({
      id: objectId,
      name: displayName,
      labelName: labelDef,
      type: matchedType,
      label: labelText,
      lineNumber,
      endLineNumber,
      startChar,
      endChar,
      rawStatement: raw || text,
      properties,
    });
  });

  return objects;
}

/**
 * 선형/커넥터 객체 구문에서 스타일 및 라벨을 제외한 경로(Path) 문자열 추출
 */
export function extractConnectorPath(rawStmt: string, objType: string): string {
  let s = rawStmt.replace(/\\\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/^[A-Z][a-zA-Z0-9_]*\s*:\s*/, '');
  s = s.replace(new RegExp('^' + objType + '\\b', 'i'), '').trim();
  s = s.replace(/^(<->|<-|->)\s*/, '');
  s = s.replace(/\b(?:invis|thick|thin|solid|dashed|dotted|chop)\b/gi, '').trim();
  const quoteIdx = s.indexOf('"');
  if (quoteIdx !== -1) {
    return s.substring(0, quoteIdx).trim();
  }
  return s
    .replace(/\bcolor\s+(0x[0-9a-fA-F]+|[a-zA-Z]+)/gi, '')
}

/**
 * 따옴표 바깥의 연속된 공백만 1개의 공백으로 정리하고 따옴표 내부의 공백은 절대 변경하지 않습니다.
 */
export function collapseWhitespaceOutsideQuotes(text: string): string {
  let res = '';
  let inString = false;
  let inSpaces = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      res += ch;
      if (ch === '\\' && i + 1 < text.length) {
        res += text[++i];
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      inSpaces = false;
      res += ch;
      continue;
    }
    if (ch === ' ' || ch === '\t') {
      if (!inSpaces) {
        res += ' ';
        inSpaces = true;
      }
    } else {
      inSpaces = false;
      res += ch;
    }
  }
  return res;
}

/**
 * Pikchr 문장에서 특정 프로퍼티 수정/삭제/추가 시 기존의 줄 구조(단일행, 멀티라인, 들여쓰기, 백슬래시 연결)를 유지하며
 * 기존 코드의 토큰 순서, 여러 개의 텍스트 문자열, 동의어 키워드(wid/width, ht/height, rad/radius, diam/diameter, invis/invisible 등)를 오염시키지 않고 갱신합니다.
 * 멀티라인에서 한 개 행을 차지하던 속성이 모두 삭제되는 경우 해당 행을 삭제함.
 */
export function updateMultiLineStatement(
  rawStatement: string,
  targetObj: PikchrObject,
  newProps: Partial<PikchrObjectProperties>,
  newLabel?: string,
  newLabelName?: string
): string {
  if (!rawStatement) {
    return rawStatement;
  }

  const parseRes = Parser.parse(rawStatement);
  if (!parseRes.success || !parseRes.ast || parseRes.ast.statements.length === 0) {
    return rawStatement;
  }

  const stmt = parseRes.ast.statements[0];
  if (stmt.type !== 'ShapeStatement' && stmt.type !== 'DirectionStatement') {
    return rawStatement;
  }

  interface Replacement {
    startOffset: number;
    endOffset: number;
    newText: string;
  }
  const replacements: Replacement[] = [];
  const handledKeys = new Set<string>();
  const addedTexts: string[] = [];

  const getAttrContentRange = (loc?: any): { startOffset: number; endOffset: number } => {
    if (!loc) return { startOffset: 0, endOffset: 0 };
    const fullSlice = rawStatement.substring(loc.start.offset, loc.end.offset);
    const match = fullSlice.match(/((?:\\[ \t]*\r?\n[ \t]*|[ \t]+)+)$/);
    if (match) {
      return {
        startOffset: loc.start.offset,
        endOffset: loc.end.offset - match[1].length,
      };
    }
    return {
      startOffset: loc.start.offset,
      endOffset: loc.end.offset,
    };
  };

  // 1. 라벨 식별자 (Label:)
  if (newLabelName !== undefined) {
    const labelMatch = rawStatement.match(/^([A-Z][a-zA-Z0-9_]*\s*:\s*)/);
    const trimmedLabel = newLabelName.trim();
    if (labelMatch) {
      replacements.push({
        startOffset: 0,
        endOffset: labelMatch[0].length,
        newText: trimmedLabel ? `${trimmedLabel}: ` : '',
      });
    } else if (trimmedLabel) {
      replacements.push({
        startOffset: 0,
        endOffset: 0,
        newText: `${trimmedLabel}: `,
      });
    }
  }

  const attrs = (stmt as any).attributes || [];

  // 2. TextAttribute
  const textAttrs = attrs.filter((a: any) => a.type === 'TextAttribute');
  const isTextModified =
    newLabel !== undefined ||
    'textStyle' in newProps ||
    'textSize' in newProps ||
    'textAlign' in newProps ||
    'textPosition' in newProps;

  if (isTextModified) {
    if (newLabel !== undefined) {
      const activeLabel = newLabel.trim();
      let textStr = '';
      if (activeLabel) {
        textStr = `"${activeLabel}"`;
        const ts = newProps.textSize !== undefined ? newProps.textSize : targetObj.properties.textSize;
        if (ts && ts !== 'normal') textStr += ` ${ts}`;
        const st = newProps.textStyle !== undefined ? newProps.textStyle : targetObj.properties.textStyle;
        if (st) textStr += ` ${st}`;
        const ta = newProps.textAlign !== undefined ? newProps.textAlign : targetObj.properties.textAlign;
        if (ta && ta !== 'center') textStr += ` ${ta}`;
        const tp = newProps.textPosition !== undefined ? newProps.textPosition : targetObj.properties.textPosition;
        if (tp && tp !== 'center') textStr += ` ${tp}`;
      }

      if (textAttrs.length > 0) {
        handledKeys.add('label');
        const firstLoc = textAttrs[0].loc;
        const lastLoc = textAttrs[textAttrs.length - 1].loc;
        const range = getAttrContentRange({ start: firstLoc.start, end: lastLoc.end });
        replacements.push({
          startOffset: range.startOffset,
          endOffset: range.endOffset,
          newText: textStr,
        });
      } else if (textStr) {
        addedTexts.push(textStr);
      }
    } else {
      // 라벨 텍스트 자체는 변경하지 않고 텍스트 스타일/크기/위치 모디파이어만 변경 시 기존 따옴표 문자열들 보존
      if (textAttrs.length > 0) {
        handledKeys.add('label');
        const origStrings = textAttrs.map((ta: any) => {
          const slice = rawStatement.substring(ta.loc.start.offset, ta.loc.end.offset);
          const m = slice.match(/^"([^"\\]*(?:\\.[^"\\]*)*)"/);
          return m ? m[0] : `"${ta.text}"`;
        }).join(' ');

        let textStr = origStrings;
        const ts = newProps.textSize !== undefined ? newProps.textSize : targetObj.properties.textSize;
        if (ts && ts !== 'normal') textStr += ` ${ts}`;
        const st = newProps.textStyle !== undefined ? newProps.textStyle : targetObj.properties.textStyle;
        if (st) textStr += ` ${st}`;
        const ta = newProps.textAlign !== undefined ? newProps.textAlign : targetObj.properties.textAlign;
        if (ta && ta !== 'center') textStr += ` ${ta}`;
        const tp = newProps.textPosition !== undefined ? newProps.textPosition : targetObj.properties.textPosition;
        if (tp && tp !== 'center') textStr += ` ${tp}`;

        const firstLoc = textAttrs[0].loc;
        const lastLoc = textAttrs[textAttrs.length - 1].loc;
        const range = getAttrContentRange({ start: firstLoc.start, end: lastLoc.end });
        replacements.push({
          startOffset: range.startOffset,
          endOffset: range.endOffset,
          newText: textStr,
        });
      }
    }
  }

  // 3. Dimension Attributes (width, height, radius, diameter, thickness)
  const dimAttrs = attrs.filter((a: any) => a.type === 'DimensionAttribute');

  // width
  if ('width' in newProps) {
    const attr = dimAttrs.find((a: any) => a.name === 'width');
    if (attr) {
      handledKeys.add('width');
      const val = newProps.width?.trim();
      const range = getAttrContentRange(attr.loc);
      replacements.push({
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        newText: val ? `${attr.rawName || 'wid'} ${val}` : '',
      });
    } else if (newProps.width?.trim()) {
      const defaultWid = /\bwidth\b/i.test(rawStatement) ? 'width' : 'wid';
      addedTexts.push(`${defaultWid} ${newProps.width.trim()}`);
    }
  }

  // height
  if ('height' in newProps) {
    const attr = dimAttrs.find((a: any) => a.name === 'height');
    if (attr) {
      handledKeys.add('height');
      const val = newProps.height?.trim();
      const range = getAttrContentRange(attr.loc);
      replacements.push({
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        newText: val ? `${attr.rawName || 'ht'} ${val}` : '',
      });
    } else if (newProps.height?.trim()) {
      const defaultHt = /\bheight\b/i.test(rawStatement) ? 'height' : 'ht';
      addedTexts.push(`${defaultHt} ${newProps.height.trim()}`);
    }
  }

  // radius
  if ('radius' in newProps) {
    const attr = dimAttrs.find((a: any) => a.name === 'radius');
    if (attr) {
      handledKeys.add('radius');
      const val = newProps.radius?.trim();
      const range = getAttrContentRange(attr.loc);
      replacements.push({
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        newText: val ? `${attr.rawName || 'rad'} ${val}` : '',
      });
    } else if (newProps.radius?.trim()) {
      const defaultRad = /\bradius\b/i.test(rawStatement) ? 'radius' : 'rad';
      addedTexts.push(`${defaultRad} ${newProps.radius.trim()}`);
    }
  }

  // diameter
  if ('diameter' in newProps) {
    const attr = dimAttrs.find((a: any) => a.name === 'diameter');
    if (attr) {
      handledKeys.add('diameter');
      const val = newProps.diameter?.trim();
      const range = getAttrContentRange(attr.loc);
      replacements.push({
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        newText: val ? `${attr.rawName || 'diam'} ${val}` : '',
      });
    } else if (newProps.diameter?.trim()) {
      const defaultDiam = /\bdiameter\b/i.test(rawStatement) ? 'diameter' : 'diam';
      addedTexts.push(`${defaultDiam} ${newProps.diameter.trim()}`);
    }
  }

  // 4. Style Attributes (fill, color, dash, invis, thickness)
  const styleAttrs = attrs.filter((a: any) => a.type === 'StyleAttribute');

  // thickness (StyleAttribute thick/thin 또는 DimensionAttribute thickness)
  if ('thickness' in newProps) {
    const sAttr = styleAttrs.find((a: any) => a.property === 'thick' || a.property === 'thin');
    const dAttr = dimAttrs.find((a: any) => a.name === 'thickness');
    const attr = sAttr || dAttr;
    if (attr) {
      handledKeys.add('thickness');
      const val = newProps.thickness;
      const isThick = val === 'thick' || val === 'thin';
      const range = getAttrContentRange(attr.loc);
      const rawWord = attr.rawName || (attr as any).rawProperty || val;
      replacements.push({
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        newText: isThick ? rawWord : '',
      });
    } else if (newProps.thickness === 'thick' || newProps.thickness === 'thin') {
      addedTexts.push(newProps.thickness);
    }
  }

  // fill
  if ('fill' in newProps) {
    const attr = styleAttrs.find((a: any) => a.property === 'fill');
    if (attr) {
      handledKeys.add('fill');
      const val = newProps.fill?.trim();
      const range = getAttrContentRange(attr.loc);
      replacements.push({
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        newText: val ? `fill ${val}` : '',
      });
    } else if (newProps.fill?.trim()) {
      addedTexts.push(`fill ${newProps.fill.trim()}`);
    }
  }

  // color
  if ('color' in newProps) {
    const attr = styleAttrs.find((a: any) => a.property === 'color');
    if (attr) {
      handledKeys.add('color');
      const val = newProps.color?.trim();
      const range = getAttrContentRange(attr.loc);
      replacements.push({
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        newText: val ? `color ${val}` : '',
      });
    } else if (newProps.color?.trim()) {
      addedTexts.push(`color ${newProps.color.trim()}`);
    }
  }

  // dash
  if ('dash' in newProps) {
    const attr = styleAttrs.find((a: any) => a.property === 'dashed' || a.property === 'dotted');
    if (attr) {
      handledKeys.add('dash');
      const val = newProps.dash;
      const isDash = val === 'dashed' || val === 'dotted';
      const range = getAttrContentRange(attr.loc);
      replacements.push({
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        newText: isDash ? val : '',
      });
    } else if (newProps.dash === 'dashed' || newProps.dash === 'dotted') {
      addedTexts.push(newProps.dash);
    }
  }

  // invis
  if ('invis' in newProps) {
    const attr = styleAttrs.find((a: any) => a.property === 'invis');
    if (attr) {
      handledKeys.add('invis');
      const range = getAttrContentRange(attr.loc);
      const rawWord = (attr as any).rawProperty || (/\binvisible\b/i.test(rawStatement) ? 'invisible' : 'invis');
      replacements.push({
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        newText: newProps.invis ? rawWord : '',
      });
    } else if (newProps.invis) {
      const defaultInvis = /\binvisible\b/i.test(rawStatement) ? 'invisible' : 'invis';
      addedTexts.push(defaultInvis);
    }
  }

  // 5. FitAttribute
  if ('fit' in newProps) {
    const attr = attrs.find((a: any) => a.type === 'FitAttribute');
    if (attr) {
      handledKeys.add('fit');
      const range = getAttrContentRange(attr.loc);
      replacements.push({
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        newText: newProps.fit ? 'fit' : '',
      });
    } else if (newProps.fit) {
      addedTexts.push('fit');
    }
  }

  // 6. Position Attributes (from, to, until, at, chop)
  const posAttrs = attrs.filter((a: any) => a.type === 'PositionAttribute');

  // chop
  if ('chop' in newProps) {
    const attr = posAttrs.find((a: any) => a.kind === 'chop');
    if (attr) {
      handledKeys.add('chop');
      const range = getAttrContentRange(attr.loc);
      replacements.push({
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        newText: newProps.chop ? 'chop' : '',
      });
    } else if (newProps.chop) {
      addedTexts.push('chop');
    }
  }

  // from
  if ('from' in newProps) {
    const attr = posAttrs.find((a: any) => a.kind === 'from');
    if (attr) {
      handledKeys.add('from');
      const val = newProps.from?.trim();
      const range = getAttrContentRange(attr.loc);
      replacements.push({
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        newText: val ? `from ${val}` : '',
      });
    } else if (newProps.from?.trim()) {
      addedTexts.push(`from ${newProps.from.trim()}`);
    }
  }

  // to
  if ('to' in newProps) {
    const attr = posAttrs.find((a: any) => a.kind === 'to');
    if (attr) {
      handledKeys.add('to');
      const val = newProps.to?.trim();
      const range = getAttrContentRange(attr.loc);
      replacements.push({
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        newText: val ? `to ${val}` : '',
      });
    } else if (newProps.to?.trim()) {
      addedTexts.push(`to ${newProps.to.trim()}`);
    }
  }

  // until
  if ('until' in newProps) {
    const attr = posAttrs.find((a: any) => a.kind === 'until_even_with');
    if (attr) {
      handledKeys.add('until');
      const val = newProps.until?.trim();
      const stripped = val ? val.replace(/^until\s+(?:even\s+with\s+)?/i, '').trim() : '';
      const range = getAttrContentRange(attr.loc);
      replacements.push({
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        newText: stripped ? `until even with ${stripped}` : '',
      });
    } else if (newProps.until?.trim()) {
      const stripped = newProps.until.trim().replace(/^until\s+(?:even\s+with\s+)?/i, '').trim();
      addedTexts.push(`until even with ${stripped}`);
    }
  }

  // at / with
  if ('at' in newProps) {
    const attr = posAttrs.find((a: any) => a.kind === 'at' || a.kind === 'with_at');
    if (attr) {
      handledKeys.add('at');
      const val = newProps.at?.trim();
      const range = getAttrContentRange(attr.loc);
      let replacement = '';
      if (val) {
        if (attr.kind === 'with_at' && attr.anchor) {
          replacement = `with ${attr.anchor} at ${val}`;
        } else {
          replacement = `at ${val}`;
        }
      }
      replacements.push({
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        newText: replacement,
      });
    } else if (newProps.at?.trim()) {
      const val = newProps.at.trim();
      if (newProps.with?.trim()) {
        addedTexts.push(`with ${newProps.with.trim()} at ${val}`);
      } else {
        addedTexts.push(`at ${val}`);
      }
    }
  }

  // arcDir (cw / ccw / clockwise / counterclockwise)
  if ('arcDir' in newProps) {
    const arcAttrs = attrs.filter((a: any) => a.type === 'ArcAttribute');
    const attr = arcAttrs.find((a: any) => a.property === 'cw' || a.property === 'ccw');
    if (attr) {
      handledKeys.add('arcDir');
      const val = newProps.arcDir;
      const isDir = val === 'cw' || val === 'ccw';
      const range = getAttrContentRange(attr.loc);
      let newWord = '';
      if (isDir) {
        if (attr.rawProperty && (attr.rawProperty.startsWith('clock') || attr.rawProperty.startsWith('counter'))) {
          newWord = val === 'cw' ? 'clockwise' : 'counterclockwise';
        } else {
          newWord = val;
        }
      }
      replacements.push({
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        newText: newWord,
      });
    } else if (newProps.arcDir) {
      addedTexts.push(newProps.arcDir);
    }
  }

  // arrowHead (-> / <- / <->)
  if ('arrowHead' in newProps) {
    const arcAttrs = attrs.filter((a: any) => a.type === 'ArcAttribute');
    const attr = arcAttrs.find((a: any) => a.property === 'arrow_head');
    if (attr) {
      handledKeys.add('arrowHead');
      const val = newProps.arrowHead;
      const isArrow = val === '->' || val === '<-' || val === '<->';
      const range = getAttrContentRange(attr.loc);
      replacements.push({
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        newText: isArrow ? val : '',
      });
    } else if (newProps.arrowHead && newProps.arrowHead !== 'none') {
      addedTexts.push(newProps.arrowHead);
    }
  }

  // 7. 치환 적용: 뒤쪽 오프셋부터 역순으로 적용하여 인덱스 밀림 방지
  replacements.sort((a, b) => b.startOffset - a.startOffset);

  let updated = rawStatement;
  for (const rep of replacements) {
    updated = updated.substring(0, rep.startOffset) + rep.newText + updated.substring(rep.endOffset);
  }

  // 8. 신규 추가된 속성 붙이기
  if (addedTexts.length > 0) {
    const addedStr = addedTexts.join(' ');
    const lines = updated.split('\n');
    const lastIdx = lines.length - 1;
    let lastLine = lines[lastIdx];
    if (/\\\s*$/.test(lastLine)) {
      lastLine = lastLine.replace(/\s*\\\s*$/, '') + ' ' + addedStr + ' \\';
    } else {
      lastLine = lastLine.trimEnd() + ' ' + addedStr;
    }
    lines[lastIdx] = lastLine;
    updated = lines.join('\n');
  }

  // 9. 행 검사 및 "한 개 행을 차지하던 속성이 모두 삭제된 행" 삭제
  const originalRawLines = rawStatement.split('\n');
  const rawLines = updated.split('\n');
  const survivingLines: string[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const content = line.replace(/\\$/, '').trim();

    // 0번째 행은 라벨 식별자나 shape 타입(box, line 등)이 있으므로 항상 보존
    if (i === 0) {
      const origIndent = originalRawLines[0].match(/^(\s*)/)?.[1] || '';
      const cleaned = collapseWhitespaceOutsideQuotes(content);
      survivingLines.push(origIndent + cleaned);
      continue;
    }

    // 1번째 이후 행에서 속성이 모두 삭제되어 공백만 남은 경우 해당 행 삭제
    if (content === '') {
      continue;
    }

    // 살아남은 행: 원래 행의 앞쪽 들여쓰기 유지 및 내용 공백 정돈
    const origIndent = (originalRawLines[i] && originalRawLines[i].match(/^(\s*)/)?.[1]) ?? (line.match(/^(\s*)/)?.[1] || '    ');
    const cleanedContent = collapseWhitespaceOutsideQuotes(content);
    survivingLines.push(origIndent + cleanedContent);
  }

  // 10. 백슬래시(\) 연결 재구성
  const finalLines: string[] = [];
  for (let i = 0; i < survivingLines.length; i++) {
    const line = survivingLines[i].replace(/\\$/, '').trimEnd();
    if (i < survivingLines.length - 1) {
      finalLines.push(`${line} \\`);
    } else {
      finalLines.push(line);
    }
  }

  return finalLines.join('\n');
}


/**
 * 경로(Path) 문자열을 시작점(from)과 then 다구간 세그먼트 배열로 분해
 */
export function parsePathIntoSegments(pathStr: string): { from: string; segments: PathSegment[] } {
  let s = pathStr.trim();
  let from = '';
  
  const fromMatch = s.match(/^from\s+([^;]+?)(?=\s+(?:then|to|until|right|left|up|down|heading|$))/i);
  if (fromMatch) {
    from = fromMatch[1].trim();
    s = s.slice(fromMatch[0].length).trim();
  }

  const rawParts = s.split(/\bthen\s+/i).map(p => p.trim()).filter(Boolean);
  if (rawParts.length === 0) {
    if (from) {
      return { from, segments: [{ direction: '', length: '', endMode: 'none', to: '', until: '' }] };
    }
    return { from: '', segments: [{ direction: 'right', length: '', endMode: 'none', to: '', until: '' }] };
  }

  const segments: PathSegment[] = rawParts.map(part => {
    let to = '';
    let until = '';
    let direction: 'right' | 'left' | 'up' | 'down' | '' = '';
    let length = '';
    let endMode: 'none' | 'to' | 'until' = 'none';

    const toMatch = part.match(/\bto\s+(.+)$/i);
    const untilMatch = part.match(/\buntil\s+(.+)$/i);

    let prefix = part;
    if (toMatch) {
      to = toMatch[1].trim();
      endMode = 'to';
      prefix = part.slice(0, toMatch.index).trim();
    } else if (untilMatch) {
      until = untilMatch[1].trim();
      endMode = 'until';
      prefix = part.slice(0, untilMatch.index).trim();
    }

    const dirMatch = prefix.match(/^(right|down|left|up)\b/i);
    if (dirMatch) {
      direction = dirMatch[1].toLowerCase() as 'right' | 'down' | 'left' | 'up';
      length = prefix.slice(dirMatch[0].length).trim();
    } else {
      length = prefix;
    }

    return {
      direction,
      length,
      endMode,
      to,
      until,
      raw: part
    };
  });

  return { from, segments };
}

/**
 * 시작점(from)과 세그먼트 배열로부터 유효한 Pikchr 경로 문자열 조합
 */
export function buildPathString(data: { from?: string; segments?: PathSegment[] }): string {
  const from = data.from?.trim() || '';
  const segments = data.segments || [];

  const segStrings = segments.map(seg => {
    let res = '';
    if (seg.direction) res += (res ? ` ` : '') + seg.direction;
    // Length는 endMode가 'none'(또는 'length')이고 to/until이 없을 때만 포함
    if ((seg.endMode === 'none' || !seg.endMode) && !seg.to && !seg.until && seg.length) {
      res += (res ? ` ` : '') + seg.length;
    }
    if (seg.endMode === 'to' && seg.to) {
      const t = seg.to.trim();
      res += (res ? ` ` : '') + (t.startsWith('to ') ? t : `to ${t}`);
    } else if (seg.endMode === 'until' && seg.until) {
      const u = seg.until.trim();
      if (/^even\s+with\b/i.test(u) || /^until\s+even\s+with\b/i.test(u)) {
        res += (res ? ` ` : '') + (u.startsWith('until') ? u : `until ${u}`);
      } else {
        res += (res ? ` ` : '') + `until even with ${u}`;
      }
    }
    return res.trim();
  }).filter(Boolean);

  if (segStrings.length > 0) {
    if (from && segStrings[0].startsWith('to ') && segStrings.length === 1) {
      return `from ${from} ${segStrings[0]}`;
    }
    if (from) {
      return `from ${from} ` + segStrings.join(' then ');
    }
    return segStrings.join(' then ');
  }

  return from ? `from ${from}` : '';
}

/**
 * 다이어그램 내 특정 객체와 앵커에 대한 Pikchr 상대/라벨 참조 문자열 생성
 */
export function getObjectReference(
  allObjects: PikchrObject[],
  currentObjIndex: number,
  targetObj: PikchrObject,
  anchor: string = '.c'
): string {
  const normAnchor = anchor === '.c' || anchor === '.center' ? '' : (anchor.startsWith('.') ? anchor : `.${anchor}`);
  
  // 1. 라벨 식별자가 정의되어 있고, 현재 참조 위치(currentObjIndex)에서 유효하게 해당 객체를 가리키는 경우
  if (targetObj.labelName) {
    const targetGlobalIndex = allObjects.findIndex(o => o.id === targetObj.id);
    if (targetGlobalIndex >= 0 && (currentObjIndex < 0 || targetGlobalIndex < currentObjIndex)) {
      // currentObjIndex 이전에 선언된 targetObj.labelName 중 가장 최근 선언이 targetObj인지 확인 (Pikchr 런타임 스코핑)
      const priorObjsWithSameLabel = allObjects
        .slice(0, currentObjIndex >= 0 ? currentObjIndex : allObjects.length)
        .filter(o => o.labelName === targetObj.labelName);
      const isLatestDeclaration = priorObjsWithSameLabel.length > 0 && priorObjsWithSameLabel[priorObjsWithSameLabel.length - 1].id === targetObj.id;
      if (isLatestDeclaration) {
        return `${targetObj.labelName}${normAnchor}`;
      }
    }
  }

  const shapeType = targetObj.type;
  const sameTypeObjs = allObjects.filter(o => o.type === shapeType);
  const targetIndexInType = sameTypeObjs.findIndex(o => o.id === targetObj.id);
  const targetGlobalIndex = allObjects.findIndex(o => o.id === targetObj.id);

  // 2. 직전 객체(바로 이전 오브젝트)인 경우
  if (currentObjIndex > 0 && targetGlobalIndex === currentObjIndex - 1) {
    return `previous${normAnchor}`;
  }

  const ordinals = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];

  // 3. 현재 객체 기준으로 뒤쪽(역방향)으로 가까운 경우 (last, 2nd last, 3rd last)
  if (currentObjIndex > 0) {
    const backwardsSameType = allObjects.slice(0, currentObjIndex).filter(o => o.type === shapeType);
    const backwardsIdx = backwardsSameType.length - 1 - backwardsSameType.findIndex(o => o.id === targetObj.id);
    if (backwardsIdx === 0) {
      return `last ${shapeType}${normAnchor}`;
    } else if (backwardsIdx > 0 && backwardsIdx < 4) {
      const ord = ordinals[backwardsIdx] || `${backwardsIdx + 1}th`;
      return `${ord} last ${shapeType}${normAnchor}`;
    }
  }

  // 4. 전체 다이어그램의 순서 기준 (1st, 2nd, 3rd 등)
  if (targetIndexInType === 0) {
    return `first ${shapeType}${normAnchor}`;
  } else if (targetIndexInType > 0 && targetIndexInType < ordinals.length) {
    return `${ordinals[targetIndexInType]} ${shapeType}${normAnchor}`;
  }

  return `previous${normAnchor}`;
}

/**
 * Pikchr 문장에서 큰따옴표 문자열("...")의 개수를 정확히 세는 함수
 */
function countStringsInStatement(statement: string): number {
  const matches = statement.match(/"([^"\\]*(?:\\.[^"\\]*)*)"/g);
  return matches ? matches.length : 0;
}

interface VisualObject {
  id: string;
  labelDef?: string;
  type: PikchrShapeType;
  lineNumber: number;
  statement: string;
  textCount: number;
  pathCount: number;
  texts: string[];
  isInvis: boolean;
  isBehind: boolean;
}

/**
 * 소스 코드에서 실제 SVG 요소를 생성하는 시각적 객체(Visual Objects) 목록 추출
 */
function parseVisualStatements(source: string): VisualObject[] {
  const objects = parseObjectsFromSource(source);
  const behindObjs: VisualObject[] = [];
  const normalObjs: VisualObject[] = [];

  const lastObjOfTypeHadBehind = new Map<string, boolean>();
  let lastObjHadBehind = false;

  for (const obj of objects) {
    // move 및 direction 명령어는 SVG 그래픽 요소를 생성하지 않음
    if (obj.type === 'move' || obj.type === 'direction') {
      continue;
    }

    const rawStatement = obj.rawStatement || '';
    const nonStringBody = rawStatement.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, '');
    const isInvis = !!obj.properties.invis || /\b(?:invis|invisible)\b/i.test(nonStringBody);
    const textMatches = rawStatement.match(/"([^"\\]*(?:\\.[^"\\]*)*)"/g);
    const texts = textMatches ? textMatches.map(m => m.replace(/^"|"$/g, '')) : [];
    const textCount = texts.length;

    let pathCount = 1;
    if (obj.type === 'file' && !isInvis) {
      pathCount = 2;
    } else if (obj.type === 'text' || isInvis) {
      pathCount = 0;
    }

    // SVG 그래픽 요소를 전혀 생성하지 않는 객체(예: 라벨 텍스트 없는 invis 도형)는 제외
    if (pathCount === 0 && textCount === 0) {
      continue;
    }

    // Behind check: Pikchr 컴파일러는 behind 속성을 가진 객체들을 behind 버퍼에 모아 SVG 최상단(가장 먼저)에 렌더링
    const hasExplicitBehind = /\bbehind\b/i.test(nonStringBody);
    let isBehind = false;
    if (hasExplicitBehind) {
      isBehind = true;
    } else if (/\bsame\b/i.test(nonStringBody)) {
      const sameAsMatch = nonStringBody.match(/\bsame\s+as\s+([A-Z0-9_]+|previous|first\s+[a-z]+|last\s+[a-z]+|\d+(?:st|nd|rd|th)?\s+[a-z]+)/i);
      if (sameAsMatch) {
        const targetName = sameAsMatch[1];
        const targetObj = objects.find(o => o.labelName === targetName || (o.label && o.label.startsWith(targetName)));
        if (targetObj && /\bbehind\b/i.test(targetObj.rawStatement || '')) {
          isBehind = true;
        }
      } else if (lastObjOfTypeHadBehind.has(obj.type)) {
        isBehind = !!lastObjOfTypeHadBehind.get(obj.type);
      } else if (lastObjHadBehind) {
        isBehind = true;
      }
    }
    lastObjHadBehind = isBehind;
    lastObjOfTypeHadBehind.set(obj.type, isBehind);

    const vObj: VisualObject = {
      id: obj.id,
      labelDef: obj.labelName || (obj.label ? obj.label.split(' ')[0] : undefined),
      type: obj.type,
      lineNumber: obj.lineNumber,
      statement: rawStatement,
      textCount,
      pathCount,
      texts,
      isInvis,
      isBehind,
    };

    if (isBehind) {
      behindObjs.push(vObj);
    } else {
      normalObjs.push(vObj);
    }
  }

  return [...behindObjs, ...normalObjs];
}

/**
 * Pikchr가 생성한 SVG의 viewBox로부터 너비와 높이를 추출하여 누락된 width/height 속성을 자동 보정
 */
function normalizeSvgTag(svgOpenTag: string): string {
  const hasWidth = /\bwidth\s*=/i.test(svgOpenTag);
  const hasHeight = /\bheight\s*=/i.test(svgOpenTag);
  const vbMatch = svgOpenTag.match(/viewBox\s*=\s*['"]\s*([0-9.-]+)\s+([0-9.-]+)\s+([0-9.-]+)\s+([0-9.-]+)\s*['"]/i);

  if ((!hasWidth || !hasHeight) && vbMatch) {
    const vbW = parseFloat(vbMatch[3]);
    const vbH = parseFloat(vbMatch[4]);
    let newTag = svgOpenTag.slice(0, -1); // remove trailing '>'
    if (!hasWidth) newTag += ` width="${vbW}"`;
    if (!hasHeight) newTag += ` height="${vbH}"`;
    return `${newTag}>`;
  }
  return svgOpenTag;
}

/**
 * Pikchr가 생성한 SVG DOM에 라인 번호와 인터랙티브 태그를 부착하고 크기를 보정
 */
function tagSvgElements(svgString: string, source: string): string {
  const svgOpenTagMatch = svgString.match(/<svg[^>]*>/i);
  if (!svgOpenTagMatch) return svgString;

  const normalizedOpenTag = normalizeSvgTag(svgOpenTagMatch[0]);
  const visualObjs = parseVisualStatements(source);

  if (visualObjs.length === 0) {
    return `${normalizedOpenTag}${svgString.substring(svgOpenTagMatch[0].length)}`;
  }

  const content = svgString.substring(svgOpenTagMatch[0].length, svgString.lastIndexOf('</svg>'));

  let vIndex = 0;
  let remainingTexts = 0;
  let remainingPaths = 0;

  const setupObj = (idx: number) => {
    const obj = visualObjs[idx];
    if (obj) {
      remainingTexts = obj.textCount;
      remainingPaths = obj.pathCount;
    }
  };

  setupObj(0);

  const taggedContent = content.replace(/(<(path|circle|ellipse|polygon|text)\b)([^>]*>)/gi, (match, openTag, tagName, rest) => {
    const tag = tagName.toLowerCase();

    // 자가 복구 / 정렬 동기화:
    // 들어온 태그가 text인데 현재 객체에 남은 텍스트가 없다면, 텍스트를 가진 다음 객체로 자동 전진
    if (tag === 'text' && remainingTexts <= 0) {
      while (vIndex < visualObjs.length - 1 && visualObjs[vIndex].textCount <= 0) {
        vIndex++;
      }
      setupObj(vIndex);
    } else if (['path', 'circle', 'ellipse'].includes(tag) && remainingPaths <= 0) {
      // 들어온 태그가 도형 기하요소인데 현재 객체에 남은 path가 없다면, 도형을 가진 다음 객체로 자동 전진
      while (vIndex < visualObjs.length - 1 && visualObjs[vIndex].pathCount <= 0) {
        vIndex++;
      }
      setupObj(vIndex);
    }

    const currentObj = visualObjs[vIndex];
    if (!currentObj) return match;

    const res = `${openTag} data-pikchr-target="true" data-line-number="${currentObj.lineNumber}" data-obj-id="${currentObj.id}"${rest}`;

    if (tag === 'text') {
      remainingTexts--;
      if (remainingTexts <= 0 && remainingPaths <= 0) {
        vIndex++;
        setupObj(vIndex);
      }
    } else if (tag === 'polygon') {
      // 커넥터(arrow)의 화살촉 polygon은 path 카운트를 차감하지 않음
    } else {
      // path, circle, ellipse 도형 기하요소
      remainingPaths--;
      if (remainingPaths <= 0 && remainingTexts <= 0) {
        vIndex++;
        setupObj(vIndex);
      }
    }

    return res;
  });

  return `${normalizedOpenTag}${taggedContent}</svg>`;
}
