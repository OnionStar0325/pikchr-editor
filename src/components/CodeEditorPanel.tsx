import React, { useRef, useEffect } from 'react';
import { 
  AlertCircle, 
  CheckCircle2, 
  ChevronUp, 
  ChevronDown, 
  FileCode2
} from 'lucide-react';
import { CompileResult, PikchrObject, PikchrDefinition } from '../lib/types';
import { useTranslation } from '../lib/i18n';

interface CodeEditorPanelProps {
  code: string;
  onChangeCode: (newCode: string) => void;
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
}) => {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const isInternalEditorChangeRef = useRef(false);
  const lines = code.split('\n');

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
    }
  };

  // 커서 위치 변경 시 활성 statement 및 라인 동기화 (네이티브 셀렉션은 건드리지 않음)
  const handleCursorSync = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    isInternalEditorChangeRef.current = true;
    const cursor = (e.target as HTMLTextAreaElement).selectionStart;

    // 1. 오브젝트 목록에서 커서가 위치한 statement 탐색
    const matchedObj = objects.find(o => 
      o.startChar !== undefined && o.endChar !== undefined &&
      cursor >= o.startChar && cursor <= o.endChar
    );

    if (matchedObj) {
      if (matchedObj.id !== selectedObjectId || matchedObj.lineNumber !== selectedLine) {
        onSelectLine(matchedObj.lineNumber, matchedObj.id);
      }
      return;
    }

    // 2. 정의(변수, 매크로 등)에서 탐색
    const matchedDef = definitions.find(d => 
      d.startChar !== undefined && d.endChar !== undefined &&
      cursor >= d.startChar && cursor <= d.endChar
    );

    if (matchedDef) {
      if (matchedDef.id !== selectedObjectId || matchedDef.lineNumber !== selectedLine) {
        onSelectLine(matchedDef.lineNumber, matchedDef.id);
      }
      return;
    }

    // 3. Fallback: 줄 번호 계산
    let currentChars = 0;
    for (let i = 0; i < lines.length; i++) {
      currentChars += lines[i].length + 1;
      if (cursor < currentChars) {
        if (selectedLine !== i + 1 || selectedObjectId !== undefined) {
          onSelectLine(i + 1, undefined);
        }
        break;
      }
    }
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
    <div className={`bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col shrink-0 transition-all duration-200 ${
      isExpanded ? 'h-72' : 'h-48'
    }`}>
      {/* Editor Panel Header / Tab */}
      <div className="h-8 bg-slate-100 dark:bg-slate-950 px-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between select-none">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <FileCode2 className="w-3.5 h-3.5 text-blue-500" />
            <span>{t.editor.tabName}</span>
          </div>

          <div className="w-px h-3.5 bg-slate-300 dark:bg-slate-800" />

          {/* Compile Status Pill */}
          {compileResult.success ? (
            <div className="flex items-center space-x-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{t.editor.syntaxOk} ({compileResult.durationMs}ms)</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 text-[11px] text-rose-600 dark:text-rose-400 font-medium">
              <AlertCircle className="w-3.5 h-3.5 animate-pulse" />
              <span>{t.editor.syntaxErrorPrefix} Line {compileResult.error?.line} - {compileResult.error?.message}</span>
            </div>
          )}
        </div>

        {/* Height toggle button */}
        <button
          onClick={onToggleExpand}
          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition"
          title={t.editor.toggleExpand}
        >
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
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
        <div className="flex-1 relative bg-white dark:bg-slate-900/90 overflow-hidden">
          {/* 시각적 배경 하이라이트 레이어 (텍스트 셀렉션을 유발하지 않고 부드러운 강조 표시) */}
          <div
            ref={highlightRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 py-2.5 px-2.5 font-mono text-xs overflow-hidden select-none"
          >
            {lines.map((_, idx) => {
              const lineNum = idx + 1;
              const isHighlighted = selectedStartLine !== null && selectedEndLine !== null &&
                lineNum >= selectedStartLine && lineNum <= selectedEndLine;

              return (
                <div
                  key={lineNum}
                  style={{ height: '20px', lineHeight: '20px' }}
                  className={`h-[20px] leading-[20px] -mx-2.5 px-2.5 transition-colors ${
                    isHighlighted
                      ? 'bg-blue-50/80 dark:bg-blue-950/50 border-l-2 border-blue-500 text-transparent'
                      : 'text-transparent'
                  }`}
                >
                  &nbsp;
                </div>
              );
            })}
          </div>

          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => {
              isInternalEditorChangeRef.current = true;
              onChangeCode(e.target.value);
            }}
            onClick={handleCursorSync}
            onKeyUp={handleCursorSync}
            onKeyDown={(e) => {
              isInternalEditorChangeRef.current = true;
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
              if (onCommitHistory) onCommitHistory();
            }}
            onScroll={handleScroll}
            wrap="off"
            spellCheck={false}
            placeholder={t.editor.placeholder}
            style={{ lineHeight: '20px' }}
            className="w-full h-full p-2.5 bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 font-mono text-xs resize-none focus:outline-none leading-[20px] overflow-auto whitespace-pre relative z-10"
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
