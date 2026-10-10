import { AnalyzedContext, AutocompleteContextType } from './types';

/**
 * 소스 코드와 커서 위치를 기반으로 현재 입력 문맥(Context)을 분석
 */
export function analyzeAutocompleteContext(
  source: string,
  cursor: number
): AnalyzedContext | null {
  if (cursor < 0 || cursor > source.length) return null;

  // 1. 주석 및 문자열 내부인지 검사
  let inString = false;
  let inSingleComment = false;
  let inMultiComment = false;

  for (let i = 0; i < cursor; i++) {
    const ch = source[i];
    const nextCh = i + 1 < source.length ? source[i + 1] : '';

    if (inSingleComment) {
      if (ch === '\n') inSingleComment = false;
      continue;
    }
    if (inMultiComment) {
      if (ch === '*' && nextCh === '/') {
        inMultiComment = false;
        i++;
      }
      continue;
    }
    if (inString) {
      if (ch === '\\' && nextCh === '"') {
        i++;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === '/' && nextCh === '/') {
      inSingleComment = true;
      i++;
    } else if (ch === '#') {
      inSingleComment = true;
    } else if (ch === '/' && nextCh === '*') {
      inMultiComment = true;
      i++;
    }
  }

  // 주석 내부에서는 자동완성 비활성화
  if (inSingleComment || inMultiComment) {
    return null;
  }

  // 2. 현재 라인 텍스트 및 라인 시작 위치 추출
  let lineStart = cursor;
  while (lineStart > 0 && source[lineStart - 1] !== '\n') {
    lineStart--;
  }

  let lineEnd = cursor;
  while (lineEnd < source.length && source[lineEnd] !== '\n') {
    lineEnd++;
  }

  const textBeforeCursorOnLine = source.substring(lineStart, cursor);

  // 3. 단어 prefix 및 대체 범위(replaceStart, replaceEnd) 계산
  let replaceStart = cursor;
  while (replaceStart > lineStart) {
    const ch = source[replaceStart - 1];
    // '.' 포함하여 앵커 트리거 탐색 (.c, .ne 등)
    if (/[a-zA-Z0-9_$@\-.]/.test(ch)) {
      replaceStart--;
      // '.'를 만나면 점 앞에서 단어 종료 (예: BoxA.e 에서 .e 만 치환하거나 . 포함 치환)
      if (ch === '.') {
        break;
      }
    } else {
      break;
    }
  }

  let replaceEnd = cursor;
  while (replaceEnd < lineEnd && /[a-zA-Z0-9_$@\-]/.test(source[replaceEnd])) {
    replaceEnd++;
  }

  const rawPrefix = source.substring(replaceStart, cursor);

  // 4. 문장 분리 (세미콜론 ';' 또는 라인 시작 기준)
  let stmtStart = cursor;
  while (stmtStart > lineStart) {
    if (source[stmtStart - 1] === ';') break;
    stmtStart--;
  }

  const textBeforeInStmt = source.substring(stmtStart, cursor).trimStart();
  const tokens = textBeforeInStmt.trim().split(/\s+/).filter(Boolean);

  // 5. 문맥 판별 (Context Determination)
  let contextType: AutocompleteContextType = 'general';
  let targetObject: string | undefined = undefined;

  const textBeforePrefix = rawPrefix.length > 0
    ? textBeforeCursorOnLine.slice(0, -rawPrefix.length)
    : textBeforeCursorOnLine;

  // Case A: 점 '.' 직후 또는 .로 시작하는 prefix (앵커/점속성)
  if (rawPrefix.startsWith('.') || (cursor > 0 && source[cursor - 1] === '.')) {
    contextType = 'dot';
    // 점 앞의 객체 토큰 추출
    const dotIdx = rawPrefix.startsWith('.') ? replaceStart : cursor - 1;
    let objStart = dotIdx;
    while (objStart > lineStart && /[a-zA-Z0-9_$@\-]/.test(source[objStart - 1])) {
      objStart--;
    }
    if (objStart < dotIdx) {
      targetObject = source.substring(objStart, dotIdx);
    }
  }
  // Case B: 색상 속성 직후 ('color', 'fill', 'color =', 'fill =')
  else if (/\b(color|fill)\s*(=)?\s*$/i.test(textBeforePrefix)) {
    contextType = 'color';
  }
  // Case C: 경로/선분 문맥 ('from', 'to', 'then', 'go', 'arrow', 'line', 'spline')
  else if (/\b(from|to|then|go|until|heading)\s*$/i.test(textBeforePrefix)) {
    contextType = 'path';
  }
  // Case D: 상대 참조 문맥 ('same as', 'behind', 'between', 'vertex of')
  else if (/\b(same\s+as|behind|between|vertex\s+of)\s*$/i.test(textBeforePrefix)) {
    contextType = 'relative';
  }
  // Case E: 문장/라인 시작 (새 도형/선언/방향 정의)
  else if (
    tokens.length === 0 || 
    (tokens.length === 1 && rawPrefix === tokens[0]) ||
    /^[A-Z][a-zA-Z0-9_]*\s*:\s*$/i.test(textBeforeInStmt.slice(0, -(rawPrefix.length || 0)).trim())
  ) {
    contextType = 'stmt_start';
  }
  // Case F: 도형 키워드 직후 (속성/스타일)
  else if (
    tokens.length > 0 &&
    ['box', 'circle', 'arrow', 'line', 'cylinder', 'diamond', 'oval', 'ellipse', 'file', 'dot', 'text', 'move', 'spline', 'arc', 'block'].includes(tokens[0].toLowerCase())
  ) {
    contextType = 'shape_attr';
  }

  return {
    contextType,
    prefix: rawPrefix,
    targetObject,
    precedingKeywords: tokens,
    replaceStart,
    replaceEnd,
  };
}
