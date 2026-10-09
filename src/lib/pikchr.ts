import { CompileResult, CompileError, PikchrObject, PikchrDefinition, PikchrShapeType, PathSegment } from './types';

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

/**
 * 소스 코드를 파싱하여 정의(변수, 매크로, scale 등) 목록 추출
 */
export function parseDefinitionsFromSource(source: string): PikchrDefinition[] {
  const lines = source.split('\n');
  const definitions: PikchrDefinition[] = [];

  let inMacro = false;
  let currentMacroName = '';
  let currentMacroBody: string[] = [];
  let macroStartLine = 0;

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
      return;
    }

    // 1. 매크로 정의: define macroname { ... } (단일행 및 복수행 지원)
    if (!inMacro) {
      const macroStartMatch = trimmed.match(/^define\s+([a-zA-Z0-9_]+)\s*\{([\s\S]*)$/i);
      if (macroStartMatch) {
        currentMacroName = macroStartMatch[1];
        macroStartLine = lineNumber;
        const rest = macroStartMatch[2];
        if (rest.includes('}')) {
          const body = rest.substring(0, rest.indexOf('}')).trim();
          definitions.push({
            id: `macro_${currentMacroName}_${lineNumber}`,
            name: currentMacroName,
            type: 'macro',
            value: body,
            lineNumber,
            rawStatement: line,
          });
        } else {
          inMacro = true;
          currentMacroBody = rest.trim() ? [rest.trim()] : [];
        }
        return;
      }
    } else {
      if (trimmed.includes('}')) {
        const endIdx = trimmed.indexOf('}');
        const beforeEnd = trimmed.substring(0, endIdx).trim();
        if (beforeEnd) currentMacroBody.push(beforeEnd);
        definitions.push({
          id: `macro_${currentMacroName}_${macroStartLine}`,
          name: currentMacroName,
          type: 'macro',
          value: currentMacroBody.join('\n'),
          lineNumber: macroStartLine,
          rawStatement: `define ${currentMacroName} { ... }`,
        });
        inMacro = false;
        currentMacroName = '';
        currentMacroBody = [];
      } else {
        currentMacroBody.push(trimmed);
      }
      return;
    }

    // 2. 변수 / 전역 프로퍼티 대입문 (=, *=, +=, -=, /=) 파싱 (세미콜론 복수 문장 분리 지원)
    const stmts = splitStatements(trimmed);
    for (const stmt of stmts) {
      const stmtTrimmed = stmt.trim();
      if (!stmtTrimmed) continue;

      const varMatch = stmtTrimmed.match(/^([$@a-zA-Z][a-zA-Z0-9_]*)\s*([+\-*/]?=)\s*(.+)$/);
      if (varMatch) {
        const varName = varMatch[1];
        const op = varMatch[2];
        const rawVal = varMatch[3].trim();
        const value = op === '=' ? rawVal : `${op} ${rawVal}`;
        const isGlobalProp = GLOBAL_PROPERTY_NAMES.has(varName.toLowerCase());

        definitions.push({
          id: `var_${varName}_${lineNumber}_${definitions.length}`,
          name: varName,
          type: isGlobalProp ? 'global_property' : 'variable',
          value,
          lineNumber,
          rawStatement: stmtTrimmed,
        });
      }
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

interface LogicalLine {
  text: string;
  lineNumber: number;
  raw: string;
}

interface ExpandedStatement {
  id: string;
  text: string;
  lineNumber: number;
  raw?: string;
}

/**
 * 매크로(define ... { ... }) 추출 및 논리행 병합, 세미콜론 분리, 매크로 호출 인라인 확장을 수행
 */
function getExpandedStatements(source: string): ExpandedStatement[] {
  const rawLines = source.split('\n');
  const macros = new Map<string, string[]>();
  let inMacro = false;
  let currentMacroName = '';
  let currentMacroLines: string[] = [];

  const nonMacroLines: { text: string; lineNumber: number; raw: string }[] = [];

  rawLines.forEach((rawLine, idx) => {
    const lineNum = idx + 1;
    const trimmed = rawLine.trim();

    if (!inMacro) {
      const macroStartMatch = trimmed.match(/^define\s+([a-zA-Z0-9_]+)\s*\{([\s\S]*)$/i);
      if (macroStartMatch) {
        currentMacroName = macroStartMatch[1];
        const rest = macroStartMatch[2];
        if (rest.includes('}')) {
          const body = rest.substring(0, rest.indexOf('}')).trim();
          macros.set(currentMacroName, splitStatements(body));
        } else {
          inMacro = true;
          currentMacroLines = rest.trim() ? [rest.trim()] : [];
        }
        return;
      }
    } else {
      if (trimmed.includes('}')) {
        const endIdx = trimmed.indexOf('}');
        const beforeEnd = trimmed.substring(0, endIdx).trim();
        if (beforeEnd) currentMacroLines.push(beforeEnd);
        const allMacroStmts: string[] = [];
        for (const mLine of currentMacroLines) {
          allMacroStmts.push(...splitStatements(mLine));
        }
        macros.set(currentMacroName, allMacroStmts);
        inMacro = false;
        currentMacroName = '';
        currentMacroLines = [];
      } else {
        currentMacroLines.push(trimmed);
      }
      return;
    }

    nonMacroLines.push({ text: trimmed, lineNumber: lineNum, raw: rawLine });
  });

  // 백슬래시(\) 연속행 논리행으로 병합
  const logicalLines: { text: string; lineNumber: number; raw: string }[] = [];
  let currentText = '';
  let currentRaw = '';
  let startLine = 1;
  let inContinuation = false;

  nonMacroLines.forEach(({ text: trimmed, lineNumber: lineNum, raw: rawLine }) => {
    if (!inContinuation && (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed.startsWith('/*'))) {
      return;
    }

    if (inContinuation) {
      currentRaw += '\n' + rawLine;
      if (trimmed.endsWith('\\')) {
        currentText += ' ' + trimmed.slice(0, -1).trim();
      } else {
        currentText += ' ' + trimmed;
        logicalLines.push({ text: currentText.trim(), lineNumber: startLine, raw: currentRaw });
        currentText = '';
        currentRaw = '';
        inContinuation = false;
      }
    } else {
      if (trimmed.endsWith('\\')) {
        startLine = lineNum;
        currentText = trimmed.slice(0, -1).trim();
        currentRaw = rawLine;
        inContinuation = true;
      } else {
        logicalLines.push({ text: trimmed, lineNumber: lineNum, raw: rawLine });
      }
    }
  });
  if (inContinuation && currentText) {
    logicalLines.push({ text: currentText.trim(), lineNumber: startLine, raw: currentRaw });
  }

  // 세미콜론 분리 및 매크로 확장 (각 문장마다 고유하고 결정론적인 식별자 생성)
  const expanded: ExpandedStatement[] = [];
  for (const { text, lineNumber, raw } of logicalLines) {
    const stmts = splitStatements(text);
    let sIdx = 0;
    for (const stmt of stmts) {
      const s = stmt.trim();
      if (!s) continue;
      sIdx++;
      const id = `obj_${lineNumber}_${sIdx}`;
      if (macros.has(s)) {
        const macroStmts = macros.get(s)!;
        let mIdx = 0;
        for (const mStmt of macroStmts) {
          mIdx++;
          expanded.push({ id: `${id}_m${mIdx}`, text: mStmt, lineNumber, raw: mStmt });
        }
      } else {
        expanded.push({ id, text: s, lineNumber, raw: stmts.length === 1 ? raw : s });
      }
    }
  }

  return expanded;
}

/**
 * 소스 코드를 파싱하여 오브젝트 메타데이터 목록 생성
 */
export function parseObjectsFromSource(source: string): PikchrObject[] {
  const expanded = getExpandedStatements(source);
  const objects: PikchrObject[] = [];
  let unnamedVisualCount = 0;
  let unnamedDirCount = 0;
  let unnamedMoveCount = 0;

  expanded.forEach(({ id, text, lineNumber, raw }) => {
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
  const quoteIdx = s.indexOf('"');
  if (quoteIdx !== -1) {
    return s.substring(0, quoteIdx).trim();
  }
  return s
    .replace(/\bcolor\s+(0x[0-9a-fA-F]+|[a-zA-Z]+)/gi, '')
    .replace(/\b(?:thick|thin|solid|dashed|dotted|chop)\b/gi, '')
    .replace(/\b(?:above|below|aligned|ljust|rjust|big|small|bold|italic|mono)\b/gi, '')
    .trim();
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
  isInvis: boolean;
}

/**
 * 소스 코드에서 실제 SVG 요소를 생성하는 시각적 객체(Visual Objects) 목록 추출
 */
function parseVisualStatements(source: string): VisualObject[] {
  const expanded = getExpandedStatements(source);
  const visualObjs: VisualObject[] = [];
  let lastBehindInsertIndex: number | null = null;

  for (const { id, text, lineNumber } of expanded) {
    const stmtTrimmed = text.trim();
    if (!stmtTrimmed) continue;

    if (stmtTrimmed.startsWith('define ') || /^[a-zA-Z$@][a-zA-Z0-9_]*\s*([+\-*/]?=)\s*/.test(stmtTrimmed)) {
      continue;
    }

    if (stmtTrimmed === '[' || stmtTrimmed === ']' || stmtTrimmed === '{' || stmtTrimmed === '}') {
      continue;
    }

    let labelDef: string | undefined;
    let body = stmtTrimmed;

    const labelColonMatch = stmtTrimmed.match(/^([A-Z][a-zA-Z0-9_]*)\s*:\s*(.*)$/);
    if (labelColonMatch) {
      labelDef = labelColonMatch[1];
      body = labelColonMatch[2].trim();
    }

    let matchedType: PikchrShapeType | null = null;
    if (body.startsWith('"') || /^\s*"/.test(body)) {
      matchedType = 'text';
    } else {
      // 따옴표 문자열 내부 단어 및 상대 참조(last arrow 등) 제외 후 도형 키워드 탐색
      const nonStringBody = body.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, '');
      const nonRelative = nonStringBody.replace(/\b(?:last|first|previous|\d+(?:st|nd|rd|th)?\s+last)\s+[a-z]+/gi, '');
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
        } else if (body.includes('->') || body.includes('<-')) {
          matchedType = 'arrow';
        } else if (body.startsWith('[') || body.includes('[')) {
          matchedType = 'block';
        } else if (body.startsWith('"') || /^\s*"/.test(body)) {
          matchedType = 'text';
        } else {
          continue;
        }
      }
    }

    // move 및 direction 명령어는 SVG 그래픽 요소를 생성하지 않음
    if (matchedType === 'move' || matchedType === 'direction') {
      continue;
    }

    const nonStringBody = body.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, '');
    const isInvis = nonStringBody.includes('invis') || nonStringBody.includes('invisible');
    const textCount = countStringsInStatement(body);
    
    const objectId = id || `obj_${lineNumber}_${visualObjs.length + 1}`;

    // 레이블 정의가 없는 경우 첫 번째 식별자형 문자열(예: "C0")을 자동 레이블로 등록
    const firstStringMatch = body.match(/"([^"\\]*(?:\\.[^"\\]*)*)"/);
    const autoLabel = firstStringMatch ? firstStringMatch[1].trim() : undefined;

    let pathCount = 1;
    if (matchedType === 'file' && !isInvis) {
      pathCount = 2;
    } else if (matchedType === 'text' || isInvis) {
      pathCount = 0;
    }

    // Behind check
    const behindMatch = nonStringBody.match(/\bbehind\s+([A-Z0-9_]+|previous|last\s+[a-z]+)/i);
    const behindTarget = behindMatch ? behindMatch[1] : null;

    const vObj: VisualObject = {
      id: objectId,
      labelDef: labelDef || autoLabel,
      type: matchedType,
      lineNumber,
      statement: stmtTrimmed,
      textCount,
      pathCount,
      isInvis,
    };

    if (behindTarget) {
      let targetIdx = -1;
      if (behindTarget.toLowerCase() === 'previous' || behindTarget.toLowerCase().startsWith('last')) {
        targetIdx = visualObjs.length - 1;
      } else {
        // Pikchr 런타임 스코핑: 선언 이전 객체 중 해당 라벨을 가진 가장 최근 객체 탐색
        targetIdx = visualObjs.map(o => o.labelDef).lastIndexOf(behindTarget);
      }
      if (targetIdx >= 0) {
        visualObjs.splice(targetIdx, 0, vObj);
        lastBehindInsertIndex = targetIdx + 1;
      } else {
        visualObjs.push(vObj);
        lastBehindInsertIndex = null;
      }
    } else if (lastBehindInsertIndex !== null && stmtTrimmed.includes('same')) {
      visualObjs.splice(lastBehindInsertIndex, 0, vObj);
      lastBehindInsertIndex++;
    } else {
      visualObjs.push(vObj);
      lastBehindInsertIndex = null;
    }
  }

  return visualObjs;
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
