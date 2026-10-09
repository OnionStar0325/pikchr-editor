import {
  CompletionItem,
  AnalyzedContext,
} from './types';
import {
  SHAPE_COMPLETIONS,
  DIRECTION_COMPLETIONS,
  PROPERTY_COMPLETIONS,
  PATH_COMPLETIONS,
  POSITION_LAYOUT_COMPLETIONS,
  TEXT_ATTR_COMPLETIONS,
  ANCHOR_COMPLETIONS,
  RELATIVE_COMPLETIONS,
  DECLARATION_COMPLETIONS,
  GLOBAL_PROPERTY_COMPLETIONS,
  MATH_FUNCTION_COMPLETIONS,
  COLOR_COMPLETIONS,
  SNIPPET_COMPLETIONS,
} from './pikchrDictionary';
import { PikchrObject, PikchrDefinition } from '../types';

/**
 * 현재 문서 내에서 선언된 심볼(라벨, 변수, 매크로 등)을 CompletionItem 목록으로 추출
 */
export function extractDocumentSymbols(
  objects: PikchrObject[] = [],
  definitions: PikchrDefinition[] = []
): CompletionItem[] {
  const symbols: CompletionItem[] = [];
  const seen = new Set<string>();

  // 1. 객체 라벨 (Label Names)
  objects.forEach(obj => {
    if (obj.labelName && !seen.has(obj.labelName)) {
      seen.add(obj.labelName);
      symbols.push({
        label: obj.labelName,
        insertText: obj.labelName,
        kind: 'symbol',
        detail: `Object Label (${obj.type})`,
        documentation: `Reference to ${obj.type} declared on line ${obj.lineNumber}.\n\nExample: arrow from ${obj.labelName}.e to ...`,
        boost: 12,
      });
    }
  });

  // 2. 변수 및 매크로 정의 (Definitions)
  definitions.forEach(def => {
    if (def.name && !seen.has(def.name)) {
      seen.add(def.name);
      const isMacro = def.type === 'macro';
      symbols.push({
        label: def.name,
        insertText: def.name,
        kind: isMacro ? 'snippet' : 'symbol',
        detail: isMacro ? 'Macro Definition' : `Variable = ${def.value}`,
        documentation: isMacro ? `Defined macro: ${def.name}` : `Defined variable: ${def.name} = ${def.value}`,
        boost: isMacro ? 11 : 10,
      });
    }
  });

  return symbols;
}

/**
 * 문맥과 검색어(Prefix)에 따라 최적화된 자동완성 제안 목록 생성
 */
export function getCompletions(
  context: AnalyzedContext,
  objects: PikchrObject[] = [],
  definitions: PikchrDefinition[] = []
): CompletionItem[] {
  const docSymbols = extractDocumentSymbols(objects, definitions);
  const candidates: CompletionItem[] = [];

  switch (context.contextType) {
    case 'dot':
      // 점('.') 직후: 앵커 포인트 및 점 속성
      candidates.push(...ANCHOR_COMPLETIONS);
      break;

    case 'color':
      // 색상 속성 직후: 색상명 및 색상 변수
      candidates.push(...COLOR_COMPLETIONS);
      candidates.push(...docSymbols.filter(s => s.kind === 'symbol'));
      break;

    case 'path':
      // 선분/경로 속성 직후: 경로 키워드, 방향, 상대 참조, 앵커, 라벨
      candidates.push(...PATH_COMPLETIONS);
      candidates.push(...DIRECTION_COMPLETIONS);
      candidates.push(...RELATIVE_COMPLETIONS);
      candidates.push(...docSymbols);
      candidates.push(...ANCHOR_COMPLETIONS);
      break;

    case 'relative':
      // 상대 참조 직후: relative keywords, document labels
      candidates.push(...RELATIVE_COMPLETIONS);
      candidates.push(...docSymbols);
      break;

    case 'stmt_start':
      // 문장 시작: 스니펫, 도형, 방향, 전역 설정, 선언문, 라벨/매크로
      candidates.push(...SNIPPET_COMPLETIONS);
      candidates.push(...SHAPE_COMPLETIONS);
      candidates.push(...DIRECTION_COMPLETIONS);
      candidates.push(...GLOBAL_PROPERTY_COMPLETIONS);
      candidates.push(...DECLARATION_COMPLETIONS);
      candidates.push(...docSymbols);
      break;

    case 'shape_attr':
      // 도형 선언 직후: 속성, 스타일, 위치 배치, 텍스트 정렬, 색상, 경로
      candidates.push(...PROPERTY_COMPLETIONS);
      candidates.push(...POSITION_LAYOUT_COMPLETIONS);
      candidates.push(...TEXT_ATTR_COMPLETIONS);
      candidates.push(...PATH_COMPLETIONS);
      candidates.push(...COLOR_COMPLETIONS.slice(0, 30));
      candidates.push(...RELATIVE_COMPLETIONS);
      candidates.push(...docSymbols);
      break;

    case 'expr':
      // 수식/함수 내부
      candidates.push(...MATH_FUNCTION_COMPLETIONS);
      candidates.push(...docSymbols.filter(s => s.kind === 'symbol'));
      break;

    case 'general':
    default:
      candidates.push(...SNIPPET_COMPLETIONS);
      candidates.push(...SHAPE_COMPLETIONS);
      candidates.push(...PROPERTY_COMPLETIONS);
      candidates.push(...DIRECTION_COMPLETIONS);
      candidates.push(...PATH_COMPLETIONS);
      candidates.push(...POSITION_LAYOUT_COMPLETIONS);
      candidates.push(...TEXT_ATTR_COMPLETIONS);
      candidates.push(...ANCHOR_COMPLETIONS);
      candidates.push(...RELATIVE_COMPLETIONS);
      candidates.push(...GLOBAL_PROPERTY_COMPLETIONS);
      candidates.push(...MATH_FUNCTION_COMPLETIONS);
      candidates.push(...docSymbols);
      break;
  }

  const query = context.prefix.trim().toLowerCase();

  // 검색어 필터링 및 점수화 (Scoring)
  const scoredItems = candidates
    .map(item => {
      const label = item.label.toLowerCase();
      const insert = item.insertText.toLowerCase();
      let matchScore = 0;

      if (!query) {
        // 검색어가 없을 때는 기본 boost 가중치 적용
        matchScore = item.boost || 0;
      } else if (label === query || insert === query) {
        matchScore = 200 + (item.boost || 0);
      } else if (label.startsWith(query) || insert.startsWith(query)) {
        matchScore = 150 + (item.boost || 0) + (10 - Math.min(10, label.length - query.length));
      } else if (label.startsWith('.' + query)) {
        // '.n' 앵커에 대해 'n'으로 검색할 때 매칭
        matchScore = 140 + (item.boost || 0);
      } else if (label.includes(query) || insert.includes(query)) {
        matchScore = 80 + (item.boost || 0);
      } else {
        // 단어 약어(Acronym/CamelCase) 매칭: e.g. "ub" -> "until even with"
        const acronym = label.split(/[\s_-]+/).map(w => w[0]).join('');
        if (acronym.startsWith(query)) {
          matchScore = 90 + (item.boost || 0);
        }
      }

      return {
        item,
        score: matchScore,
      };
    })
    .filter(res => res.score > 0);

  // 중복 항목 제거 (동일 라벨 우선순위 높은 항목 유지)
  const seenLabels = new Set<string>();
  const uniqueItems: CompletionItem[] = [];

  // 점수 내림차순 정렬
  scoredItems.sort((a, b) => b.score - a.score);

  for (const { item } of scoredItems) {
    if (!seenLabels.has(item.label)) {
      seenLabels.add(item.label);
      uniqueItems.push(item);
      if (uniqueItems.length >= 25) break; // 최대 25개 제안 반환
    }
  }

  return uniqueItems;
}
