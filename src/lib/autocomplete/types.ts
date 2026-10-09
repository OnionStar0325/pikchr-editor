export type CompletionKind = 
  | 'shape'       // 기본 도형 (box, circle, arrow...)
  | 'property'    // 속성 (width, height, rad, fill...)
  | 'anchor'      // 앵커/포인트 (.c, .ne, .start...)
  | 'keyword'     // 문법 키워드 (then, until, define, assert...)
  | 'direction'   // 방향 (right, down, heading...)
  | 'color'       // 색상명 (red, blue, None...)
  | 'function'    // 내장 함수 (dist, sqrt, abs...)
  | 'symbol'      // 사용자 정의 라벨/변수/매크로
  | 'snippet';    // 다구간/복합 스니펫 템플릿

export interface CompletionItem {
  label: string;              // 팝업에 표시되는 텍스트 (예: "box")
  insertText: string;         // 에디터에 실제 삽입되는 텍스트 (예: 'box "${1:Label}" fit')
  kind: CompletionKind;       // 아이템 종류
  detail?: string;            // 부가 정보 (예: "Basic shape", "Anchor point")
  documentation?: string;     // 문법 설명 및 용법 예제
  boost?: number;             // 정렬 우선순위 가중치 (기본값: 0)
  cursorOffset?: number;      // 삽입 후 커서 이동 상대 위치 (기본: insertText.length)
}

export type AutocompleteContextType = 
  | 'stmt_start'    // 라인 시작, 세미콜론 직후 (도형, 방향, 선언문, 라벨)
  | 'shape_attr'    // 도형 선언 이후 (속성, 스타일, 배치)
  | 'dot'           // 점 '.' 직후 (앵커, 점 속성, 좌표 축)
  | 'color'         // 'color', 'fill' 직후 (색상명, 0xHEX)
  | 'path'          // arrow/line/then/from/to 이후 (경로 속성, 방향)
  | 'expr'          // 수식/표현식/함수 호출 내부
  | 'relative'      // relative reference (previous, last, 1st...)
  | 'general';      // 일반 문맥 (모든 유효 키워드)

export interface AnalyzedContext {
  contextType: AutocompleteContextType;
  prefix: string;               // 현재 작성 중인 미완성 단어 (예: "bo", ".n")
  targetObject?: string;        // 점('.') 앞의 객체명 (예: "BoxA." -> "BoxA")
  precedingKeywords: string[];  // 현재 문장 내 앞선 키워드들
  replaceStart: number;         // 텍스트 대체 시작 인덱스
  replaceEnd: number;           // 텍스트 대체 종료 인덱스
}

export interface CaretCoordinates {
  top: number;
  left: number;
  lineHeight: number;
}

export interface AutocompleteState {
  isOpen: boolean;
  items: CompletionItem[];
  selectedIndex: number;
  context: AnalyzedContext | null;
  position: CaretCoordinates;
}
