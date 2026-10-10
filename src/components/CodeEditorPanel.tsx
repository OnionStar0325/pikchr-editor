import React, { useRef, useEffect, useState, useMemo } from 'react';
import { 
  AlertCircle, 
  CheckCircle2, 
  ChevronUp, 
  ChevronDown, 
  FileCode2
} from 'lucide-react';
import { CompileResult, PikchrObject, PikchrDefinition } from '../lib/types';
import { useTranslation } from '../lib/i18n';
import { AutocompletePopover } from './AutocompletePopover';
import { analyzeAutocompleteContext } from '../lib/autocomplete/contextAnalyzer';
import { getCompletions } from '../lib/autocomplete/completionEngine';
import { getCaretCoordinates } from '../lib/autocomplete/caretPosition';
import { CompletionItem, AutocompleteState } from '../lib/autocomplete/types';
import { isStatementCompleted } from '../lib/statementDetector';

interface CodeEditorPanelProps {
  code: string;
  onChangeCode: (newCode: string, isStatementComplete?: boolean) => void;
  selectedLine: number | null;
  selectedObjectId?: string | null;
  objects?: PikchrObject[];
  definitions?: PikchrDefinition[];
  onSelectLine: (line: number | null, objId?: string) => void;
  compileResult: CompileResult;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onCommitHistory?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  height?: number;
  isMobileFull?: boolean;
}

export const CodeEditorPanel: React.FC<CodeEditorPanelProps> = ({
  code,
  onChangeCode,
  selectedLine,
  selectedObjectId,
  objects = [],
  definitions = [],
  onSelectLine,
  compileResult,
  isExpanded,
  onToggleExpand,
  onCommitHistory,
  onUndo,
  onRedo,
  height,
  isMobileFull,
}) => {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const isInternalEditorChangeRef = useRef(false);
  const lines = code.split('\n');

  // 자동완성 상태 관리
  const [autocomplete, setAutocomplete] = useState<AutocompleteState>({
    isOpen: false,
    items: [],
    selectedIndex: 0,
    context: null,
    position: { top: 0, left: 0, lineHeight: 20 },
  });

  // 현재 선택된 객체 및 하이라이트할 라인 범위 계산
  const currentSelectedObj = selectedObjectId
    ? (objects.find(o => o.id === selectedObjectId) || definitions.find(d => d.id === selectedObjectId))
    : (selectedLine ? objects.find(o => selectedLine >= o.lineNumber && selectedLine <= (o.endLineNumber || o.lineNumber)) : null);

  const selectedStartLine = currentSelectedObj
    ? currentSelectedObj.lineNumber
    : selectedLine;

  const selectedEndLine = currentSelectedObj
    ? (currentSelectedObj.endLineNumber || currentSelectedObj.lineNumber)
    : selectedLine;

  // 스크롤 동기화: 텍스트 영역 스크롤 시 라인 번호 영역 및 하이라이트 배경 레이어 동시 스크롤
  const handleScroll = () => {
    if (textareaRef.current) {
      const top = textareaRef.current.scrollTop;
      const left = textareaRef.current.scrollLeft;
      if (lineNumbersRef.current) {
        lineNumbersRef.current.scrollTop = top;
      }
      if (highlightRef.current) {
        highlightRef.current.scrollTop = top;
        highlightRef.current.scrollLeft = left;
      }
      // 스크롤 시 자동완성 팝업 위치 동기화 또는 닫기
      if (autocomplete.isOpen && textareaRef.current) {
        const cursor = textareaRef.current.selectionStart;
        const pos = getCaretCoordinates(textareaRef.current, cursor);
        setAutocomplete(prev => ({ ...prev, position: pos }));
      }
    }
  };

  // 라인별 시작 및 종료 문자 인덱스 계산 (정확한 토큰/문장 하이라이트 매핑용)
  const lineDetails = useMemo(() => {
    let offset = 0;
    return lines.map((lineText, idx) => {
      const startChar = offset;
      const endChar = offset + lineText.length;
      offset = endChar + 1; // +1 for '\n'
      return {
        lineNum: idx + 1,
        startChar,
        endChar,
        text: lineText,
      };
    });
  }, [code]);

  // 커서 위치 변경 시 활성 statement 및 라인 동기화 (네이티브 셀렉션은 건드리지 않음)
  const handleCursorSync = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    isInternalEditorChangeRef.current = true;
    const cursor = (e.target as HTMLTextAreaElement).selectionStart;

    // 1. 오브젝트 및 정의 목록을 startChar 기준으로 정렬하여 탐색
    const allItems = [...objects, ...definitions]
      .filter(item => item.startChar !== undefined && item.endChar !== undefined)
      .sort((a, b) => a.startChar! - b.startChar!);

    // 1차: 구문 텍스트 내부에 커서가 위치하는 경우
    let matched = allItems.find(item => cursor >= item.startChar! && cursor <= item.endChar!);

    // 2차: box; box; box; 등 한 줄에 여러 구문이 있을 때 세미콜론/공백 위치 커서 매핑
    if (!matched && allItems.length > 0) {
      for (let i = 0; i < allItems.length; i++) {
        const cur = allItems[i];
        const next = allItems[i + 1];
        const nextStart = next ? next.startChar! : Infinity;
        if (cursor >= cur.startChar! && cursor < nextStart) {
          matched = cur;
          break;
        }
      }
    }

    if (matched) {
      if (matched.id !== selectedObjectId || matched.lineNumber !== selectedLine) {
        onSelectLine(matched.lineNumber, matched.id);
      }
      return;
    }

    // 3. Fallback: 줄 번호 계산
    let currentChars = 0;
    for (let i = 0; i < lines.length; i++) {
      currentChars += lines[i].length + 1;
      if (cursor < currentChars) {
        const objOnLine = objects.find(o => o.lineNumber === i + 1);
        onSelectLine(i + 1, objOnLine?.id);
        break;
      }
    }
  };

  // 자동완성 문맥 분석 및 팝오버 갱신
  const updateAutocomplete = (text: string, cursorPos: number) => {
    if (!textareaRef.current) return;

    const ctx = analyzeAutocompleteContext(text, cursorPos);
    if (!ctx) {
      setAutocomplete(prev => ({ ...prev, isOpen: false }));
      return;
    }

    // 1글자 이상 입력되었거나 점(.)/색상/경로 문맥인 경우에만 자동 팝업
    const shouldTrigger = 
      ctx.prefix.length > 0 || 
      ctx.contextType === 'dot' || 
      ctx.contextType === 'color';

    if (!shouldTrigger) {
      setAutocomplete(prev => ({ ...prev, isOpen: false }));
      return;
    }

    const completions = getCompletions(ctx, objects, definitions);
    if (completions.length === 0) {
      setAutocomplete(prev => ({ ...prev, isOpen: false }));
      return;
    }

    const pos = getCaretCoordinates(textareaRef.current, cursorPos);

    // 이전 선택 인덱스를 보존하거나 동일 라벨/타입 항목과 매칭 (키보드 이동 중 인덱스 0 초기화 방지)
    setAutocomplete(prev => {
      let nextIndex = 0;
      if (prev.isOpen && prev.items.length > 0 && prev.selectedIndex < prev.items.length) {
        const prevItem = prev.items[prev.selectedIndex];
        const matchIdx = completions.findIndex(c => c.label === prevItem.label && c.kind === prevItem.kind);
        if (matchIdx >= 0) {
          nextIndex = matchIdx;
        } else {
          nextIndex = Math.min(prev.selectedIndex, completions.length - 1);
        }
      }
      return {
        isOpen: true,
        items: completions,
        selectedIndex: nextIndex,
        context: ctx,
        position: pos,
      };
    });
  };

  // 자동완성 항목 적용 (Insert)
  const handleApplyCompletion = (item: CompletionItem) => {
    if (!autocomplete.context || !textareaRef.current) return;
    const { replaceStart, replaceEnd } = autocomplete.context;

    const newCode = code.substring(0, replaceStart) + item.insertText + code.substring(replaceEnd);
    const isCompleted = isStatementCompleted(code, newCode);
    onChangeCode(newCode, isCompleted);

    const newCursor = replaceStart + (item.cursorOffset !== undefined ? item.cursorOffset : item.insertText.length);

    setAutocomplete(prev => ({ ...prev, isOpen: false }));

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursor, newCursor);
      }
      if (onCommitHistory) onCommitHistory();
    }, 0);
  };

  // statement 단위 스크롤 동기화 (네이티브 텍스트 selectionRange는 실행하지 않고 시각적 하이라이트만 제공)
  useEffect(() => {
    if (!textareaRef.current) return;

    if (isInternalEditorChangeRef.current) {
      isInternalEditorChangeRef.current = false;
      return;
    }

    if (selectedStartLine !== null) {
      const scrollLine = selectedStartLine;
      const lineHeight = 20; // 20px per line
      const targetTop = (scrollLine - 1) * lineHeight;
      const currentScroll = textareaRef.current.scrollTop;
      const clientHeight = textareaRef.current.clientHeight;

      if (targetTop < currentScroll || targetTop > currentScroll + clientHeight - 40) {
        const nextScrollTop = Math.max(0, targetTop - Math.floor(clientHeight / 2));
        textareaRef.current.scrollTop = nextScrollTop;
        if (lineNumbersRef.current) {
          lineNumbersRef.current.scrollTop = nextScrollTop;
        }
        if (highlightRef.current) {
          highlightRef.current.scrollTop = nextScrollTop;
        }
      }
    }
  }, [selectedLine, selectedObjectId, objects, definitions, selectedStartLine]);

  return (
    <div
      style={!isMobileFull && height !== undefined ? { height: `${height}px` } : undefined}
      className={`bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col shrink-0 ${
        isMobileFull ? 'flex-1 h-full w-full border-t-0' : height !== undefined ? '' : isExpanded ? 'h-72' : 'h-48'
      }`}
    >
      {/* Editor Panel Header / Tab */}
      <div className="h-8 bg-slate-100 dark:bg-slate-950 px-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between select-none shrink-0">
        <div className="flex items-center space-x-3 overflow-hidden">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 shrink-0">
            <FileCode2 className="w-3.5 h-3.5 text-blue-500" />
            <span>{t.editor.tabName}</span>
          </div>

          <div className="w-px h-3.5 bg-slate-300 dark:bg-slate-800 shrink-0" />

          {/* Compile Status Pill */}
          {compileResult.success ? (
            <div className="flex items-center space-x-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 truncate">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{t.editor.syntaxOk} ({compileResult.durationMs}ms)</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 text-[11px] text-rose-600 dark:text-rose-400 font-medium truncate">
              <AlertCircle className="w-3.5 h-3.5 animate-pulse shrink-0" />
              <span className="truncate">{t.editor.syntaxErrorPrefix} Line {compileResult.error?.line} - {compileResult.error?.message}</span>
            </div>
          )}
        </div>

        {/* Height toggle button (hidden on mobile full view) */}
        {!isMobileFull && (
          <button
            onClick={onToggleExpand}
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition shrink-0"
            title={t.editor.toggleExpand}
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Editor Body with Line Numbers */}
      <div className="flex-1 flex overflow-hidden font-mono text-xs relative">
        {/* Line Numbers Column (완전한 20px 줄 높이 및 스크롤 동기화) */}
        <div 
          ref={lineNumbersRef}
          className="w-12 bg-slate-50 dark:bg-slate-950/80 border-r border-slate-200/80 dark:border-slate-800/80 py-2.5 px-2 text-right select-none text-slate-400 dark:text-slate-500 overflow-hidden shrink-0 font-mono text-xs"
        >
          {lines.map((_, idx) => {
            const lineNum = idx + 1;
            const isSelected = selectedStartLine !== null && selectedEndLine !== null &&
              lineNum >= selectedStartLine && lineNum <= selectedEndLine;

            const isErrorLine = !compileResult.success && compileResult.error?.line === lineNum;

            return (
              <div
                key={lineNum}
                onClick={() => {
                  const objOnLine = objects.find(o => o.lineNumber === lineNum);
                  onSelectLine(lineNum, objOnLine?.id);
                }}
                style={{ height: '20px', lineHeight: '20px' }}
                className={`cursor-pointer transition flex items-center justify-end space-x-1 h-[20px] leading-[20px] ${
                  isErrorLine
                    ? 'text-rose-600 dark:text-rose-400 font-bold bg-rose-500/20 -mx-2 px-2 rounded-xs'
                    : isSelected
                    ? 'text-blue-600 dark:text-blue-400 font-bold bg-blue-500/20 -mx-2 px-2'
                    : 'hover:text-slate-700 dark:hover:text-slate-400'
                }`}
              >
                {isErrorLine && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />}
                <span>{lineNum}</span>
              </div>
            );
          })}
        </div>

        {/* Textarea Code Input (줄바꿈 방지 및 20px 정확한 줄높이 일치, 시각적 하이라이트 오버레이 포함) */}
        <div 
          ref={editorContainerRef}
          className="flex-1 relative bg-white dark:bg-slate-900/90 overflow-hidden"
        >
          {/* 시각적 배경 하이라이트 레이어 (텍스트 셀렉션을 유발하지 않고 부드러운 강조 표시) */}
          <div
            ref={highlightRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 py-2.5 px-2.5 font-mono text-xs overflow-hidden select-none whitespace-pre"
          >
            {lineDetails.map(({ lineNum, startChar: lineStart, endChar: lineEnd, text }) => {
              const isLineActive = selectedStartLine !== null && selectedEndLine !== null &&
                lineNum >= selectedStartLine && lineNum <= selectedEndLine;

              // 현재 선택된 객체가 이 라인과 겹치는지 확인 (box; box; box; 등 복수 구문 인라인 매핑)
              let hasTokenHighlight = false;
              let beforeText = '';
              let matchText = '';
              let afterText = '';

              if (
                currentSelectedObj &&
                currentSelectedObj.startChar !== undefined &&
                currentSelectedObj.endChar !== undefined &&
                currentSelectedObj.startChar < lineEnd &&
                currentSelectedObj.endChar > lineStart
              ) {
                const relStart = Math.max(0, currentSelectedObj.startChar - lineStart);
                const relEnd = Math.min(text.length, currentSelectedObj.endChar - lineStart);
                if (relStart < relEnd) {
                  hasTokenHighlight = true;
                  beforeText = text.substring(0, relStart);
                  matchText = text.substring(relStart, relEnd);
                  afterText = text.substring(relEnd);
                }
              }

              return (
                <div
                  key={lineNum}
                  style={{ height: '20px', lineHeight: '20px' }}
                  className={`h-[20px] leading-[20px] -mx-2.5 px-2.5 transition-colors whitespace-pre overflow-hidden ${
                    isLineActive
                      ? 'bg-blue-50/50 dark:bg-blue-950/30 border-l-2 border-blue-500'
                      : ''
                  }`}
                >
                  {hasTokenHighlight ? (
                    <>
                      <span className="text-transparent">{beforeText}</span>
                      <span className="text-transparent bg-blue-500/25 dark:bg-blue-400/35 ring-1 ring-blue-500/60 dark:ring-blue-400/60 rounded-xs font-semibold shadow-xs">
                        {matchText}
                      </span>
                      <span className="text-transparent">{afterText}</span>
                    </>
                  ) : (
                    <span className="text-transparent">&nbsp;</span>
                  )}
                </div>
              );
            })}
          </div>

          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => {
              isInternalEditorChangeRef.current = true;
              const val = e.target.value;
              const cursor = e.target.selectionStart;
              const isCompleted = isStatementCompleted(code, val, cursor);
              onChangeCode(val, isCompleted);
              updateAutocomplete(val, cursor);
            }}
            onClick={(e) => {
              handleCursorSync(e);
              const cursor = (e.target as HTMLTextAreaElement).selectionStart;
              updateAutocomplete(code, cursor);
            }}
            onKeyUp={(e) => {
              // 자동완성 팝오버 키보드 조작 중에는 updateAutocomplete 및 커서 재계산 건너뛰기 (선택 인덱스 초기화 버그 방지)
              if (autocomplete.isOpen && ['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape', 'PageUp', 'PageDown'].includes(e.key)) {
                return;
              }
              if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
                handleCursorSync(e);
                const cursor = (e.target as HTMLTextAreaElement).selectionStart;
                updateAutocomplete(code, cursor);
              }
            }}
            onKeyDown={(e) => {
              isInternalEditorChangeRef.current = true;

              // 수동 호출 단축키: Ctrl+Space 또는 Cmd+Space
              if ((e.ctrlKey || e.metaKey) && e.code === 'Space') {
                e.preventDefault();
                const cursor = e.currentTarget.selectionStart;
                const ctx = analyzeAutocompleteContext(code, cursor);
                if (ctx) {
                  const completions = getCompletions(ctx, objects, definitions);
                  if (completions.length > 0 && textareaRef.current) {
                    const pos = getCaretCoordinates(textareaRef.current, cursor);
                    setAutocomplete({
                      isOpen: true,
                      items: completions,
                      selectedIndex: 0,
                      context: ctx,
                      position: pos,
                    });
                  }
                }
                return;
              }

              // 자동완성 팝오버 열려있을 때 키보드 조작 가로채기
              if (autocomplete.isOpen && autocomplete.items.length > 0) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setAutocomplete(prev => ({
                    ...prev,
                    selectedIndex: (prev.selectedIndex + 1) % prev.items.length,
                  }));
                  return;
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setAutocomplete(prev => ({
                    ...prev,
                    selectedIndex: (prev.selectedIndex - 1 + prev.items.length) % prev.items.length,
                  }));
                  return;
                }
                if (e.key === 'Enter' || e.key === 'Tab') {
                  e.preventDefault();
                  handleApplyCompletion(autocomplete.items[autocomplete.selectedIndex]);
                  return;
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setAutocomplete(prev => ({ ...prev, isOpen: false }));
                  return;
                }
                if (e.key === 'PageDown') {
                  e.preventDefault();
                  setAutocomplete(prev => ({
                    ...prev,
                    selectedIndex: Math.min(prev.items.length - 1, prev.selectedIndex + 5),
                  }));
                  return;
                }
                if (e.key === 'PageUp') {
                  e.preventDefault();
                  setAutocomplete(prev => ({
                    ...prev,
                    selectedIndex: Math.max(0, prev.selectedIndex - 5),
                  }));
                  return;
                }
              }

              if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                  if (onRedo) onRedo();
                } else {
                  if (onUndo) onUndo();
                }
                return;
              }
              if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                if (onRedo) onRedo();
                return;
              }
              if (e.key === 'Enter' || e.key === ';') {
                if (onCommitHistory) onCommitHistory();
              }
            }}
            onBlur={() => {
              // 팝오버 클릭 이벤트 처리를 위해 약간의 지연 후 닫기
              setTimeout(() => {
                setAutocomplete(prev => ({ ...prev, isOpen: false }));
              }, 150);
              if (onCommitHistory) onCommitHistory();
            }}
            onScroll={handleScroll}
            wrap="off"
            spellCheck={false}
            placeholder={t.editor.placeholder}
            style={{ lineHeight: '20px' }}
            className="w-full h-full p-2.5 bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 font-mono text-xs resize-none focus:outline-none leading-[20px] overflow-auto whitespace-pre relative z-10"
          />

          {/* 키워드 및 스니펫 자동완성 팝오버 */}
          <AutocompletePopover
            isOpen={autocomplete.isOpen}
            items={autocomplete.items}
            selectedIndex={autocomplete.selectedIndex}
            position={autocomplete.position}
            onSelect={handleApplyCompletion}
            onClose={() => setAutocomplete(prev => ({ ...prev, isOpen: false }))}
            textareaRef={textareaRef}
            containerRef={editorContainerRef}
          />
        </div>
      </div>

      {/* Bottom Diagnostics / Error Banner */}
      {!compileResult.success && compileResult.error && (
        <div className="bg-rose-50 dark:bg-rose-950/80 border-t border-rose-200 dark:border-rose-900/60 px-3 py-1.5 flex items-center justify-between text-xs text-rose-700 dark:text-rose-200">
          <div className="flex items-center space-x-2 font-mono">
            <AlertCircle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />
            <span className="font-semibold text-rose-700 dark:text-rose-300">[Line {compileResult.error.line}, Col {compileResult.error.column}]</span>
            <span className="truncate">{compileResult.error.message}</span>
          </div>
          <button
            onClick={() => onSelectLine(compileResult.error!.line)}
            className="px-2 py-0.5 rounded bg-rose-200 dark:bg-rose-900/80 hover:bg-rose-300 dark:hover:bg-rose-800 text-[11px] text-rose-900 dark:text-rose-100 font-medium transition"
          >
            {t.editor.jumpToError}
          </button>
        </div>
      )}
    </div>
  );
};

