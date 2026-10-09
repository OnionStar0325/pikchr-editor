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
  const lines = code.split('\n');

  // 스크롤 동기화: 텍스트 영역 스크롤 시 라인 번호 영역 동시 스크롤
  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // 커서 위치 변경 시 활성 statement 및 라인 동기화
  const handleCursorSync = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const cursor = (e.target as HTMLTextAreaElement).selectionStart;

    // 1. 오브젝트 목록에서 커서가 위치한 statement 탐색
    const matchedObj = objects.find(o => 
      o.startChar !== undefined && o.endChar !== undefined &&
      cursor >= o.startChar && cursor <= o.endChar
    );

    if (matchedObj) {
      onSelectLine(matchedObj.lineNumber, matchedObj.id);
      return;
    }

    // 2. 정의(변수, 매크로 등)에서 탐색
    const matchedDef = definitions.find(d => 
      d.startChar !== undefined && d.endChar !== undefined &&
      cursor >= d.startChar && cursor <= d.endChar
    );

    if (matchedDef) {
      onSelectLine(matchedDef.lineNumber, matchedDef.id);
      return;
    }

    // 3. Fallback: 줄 번호 계산
    let currentChars = 0;
    for (let i = 0; i < lines.length; i++) {
      currentChars += lines[i].length + 1;
      if (cursor < currentChars) {
        onSelectLine(i + 1, undefined);
        break;
      }
    }
  };

  // statement 단위 텍스트 블록 선택 및 스크롤 동기화
  useEffect(() => {
    if (!textareaRef.current) return;

    let targetStart: number | null = null;
    let targetEnd: number | null = null;
    let scrollLine = selectedLine || 1;

    if (selectedObjectId) {
      const targetObj = objects.find(o => o.id === selectedObjectId);
      const targetDef = !targetObj ? definitions.find(d => d.id === selectedObjectId) : undefined;
      const target = targetObj || targetDef;

      if (target && target.startChar !== undefined && target.endChar !== undefined) {
        targetStart = target.startChar;
        targetEnd = target.endChar;
        scrollLine = target.lineNumber;
      }
    }

    if (targetStart === null && selectedLine !== null) {
      const targetObj = objects.find(o => {
        const endLine = o.endLineNumber || o.lineNumber;
        return selectedLine >= o.lineNumber && selectedLine <= endLine;
      });

      if (targetObj && targetObj.startChar !== undefined && targetObj.endChar !== undefined) {
        targetStart = targetObj.startChar;
        targetEnd = targetObj.endChar;
        scrollLine = targetObj.lineNumber;
      } else {
        const targetLine = Math.min(Math.max(selectedLine, 1), lines.length);
        let charCount = 0;
        for (let i = 0; i < targetLine - 1 && i < lines.length; i++) {
          charCount += lines[i].length + 1;
        }
        const lineLen = lines[targetLine - 1]?.length || 0;
        targetStart = charCount;
        targetEnd = charCount + lineLen;
        scrollLine = targetLine;
      }
    }

    if (targetStart !== null && targetEnd !== null) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(targetStart, targetEnd);

      // 선택된 statement 위치로 스크롤 동기화
      const lineHeight = 20; // 20px per line
      const targetTop = (scrollLine - 1) * lineHeight;
      const currentScroll = textareaRef.current.scrollTop;
      const clientHeight = textareaRef.current.clientHeight;

      if (targetTop < currentScroll || targetTop > currentScroll + clientHeight - 40) {
        textareaRef.current.scrollTop = Math.max(0, targetTop - Math.floor(clientHeight / 2));
        if (lineNumbersRef.current) {
          lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
        }
      }
    }
  }, [selectedLine, selectedObjectId, objects, definitions]);

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
            const currentSelectedObj = selectedObjectId
              ? (objects.find(o => o.id === selectedObjectId) || definitions.find(d => d.id === selectedObjectId))
              : (selectedLine ? objects.find(o => lineNum >= o.lineNumber && lineNum <= (o.endLineNumber || o.lineNumber)) : null);

            const isSelected = currentSelectedObj
              ? lineNum >= currentSelectedObj.lineNumber && lineNum <= (currentSelectedObj.endLineNumber || currentSelectedObj.lineNumber)
              : selectedLine === lineNum;

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

        {/* Textarea Code Input (줄바꿈 방지 및 20px 정확한 줄높이 일치) */}
        <div className="flex-1 relative bg-white dark:bg-slate-900/90 overflow-hidden">
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => onChangeCode(e.target.value)}
            onSelect={handleCursorSync}
            onClick={handleCursorSync}
            onKeyUp={handleCursorSync}
            onKeyDown={(e) => {
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
            className="w-full h-full p-2.5 bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 font-mono text-xs resize-none focus:outline-none leading-[20px] selection:bg-blue-500/30 overflow-auto whitespace-pre"
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
