import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Check } from 'lucide-react';
import { useTranslation } from './lib/i18n';
import { useTheme } from './lib/theme';
import { MenuBar } from './components/MenuBar';
import { PaletteSidebar } from './components/PaletteSidebar';
import { CenterStage } from './components/CenterStage';
import { ObjectListSidebar } from './components/ObjectListSidebar';
import { CodeEditorPanel } from './components/CodeEditorPanel';
import { HelpModal } from './components/HelpModal';
import { compilePikchr, parseObjectsFromSource, parseDefinitionsFromSource, splitStatements, buildPathString, parsePathIntoSegments, extractConnectorPath } from './lib/pikchr';
import { CompileResult, PikchrObject, PikchrDefinition, ActiveTargetField, PikchrObjectProperties, PathSegment } from './lib/types';
import { EXAMPLES } from './lib/examples';

const DEFAULT_CODE = EXAMPLES[0].code;

export const copyToClipboard = async (text: string): Promise<boolean> => {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('navigator.clipboard.writeText failed, fallback to execCommand:', err);
    }
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '-9999px';
    textArea.style.opacity = '0';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, 99999);
    const success = document.execCommand('copy');
    document.body.removeChild(textArea);
    return success;
  } catch (err) {
    console.error('execCommand copy failed:', err);
    return false;
  }
};

export const App: React.FC = () => {
  const { t } = useTranslation();
  const { theme, canvasBg } = useTheme();
  const [code, setCode] = useState<string>(DEFAULT_CODE);
  const [compileResult, setCompileResult] = useState<CompileResult>({
    success: true,
    svgHtml: '',
    error: null,
    durationMs: 0,
  });
  const [objects, setObjects] = useState<PikchrObject[]>([]);
  const [definitions, setDefinitions] = useState<PikchrDefinition[]>([]);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isEditorVisible, setIsEditorVisible] = useState(true);
  const [isEditorExpanded, setIsEditorExpanded] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const [activeTargetField, setActiveTargetField] = useState<ActiveTargetField>(null);
  const [refInsertion, setRefInsertion] = useState<{ field: ActiveTargetField; value: string; timestamp: number } | null>(null);
  const [pendingProperties, setPendingProperties] = useState<Record<string, Partial<PikchrObjectProperties>>>({});

  // --- Undo / Redo History Management ---
  const [history, setHistory] = useState<string[]>([DEFAULT_CODE]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const isUndoRedoRef = useRef(false);
  const editorDebounceRef = useRef<any>(null);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const pushHistoryEntry = useCallback((newCode: string) => {
    if (isUndoRedoRef.current) return;
    setHistory(prev => {
      const currentCode = prev[historyIndex];
      if (currentCode === newCode) return prev;
      const sliced = prev.slice(0, historyIndex + 1);
      if (sliced.length >= 100) sliced.shift();
      sliced.push(newCode);
      setHistoryIndex(sliced.length - 1);
      return sliced;
    });
  }, [historyIndex]);

  const handleUndo = useCallback(() => {
    if (editorDebounceRef.current) {
      clearTimeout(editorDebounceRef.current);
      editorDebounceRef.current = null;
    }
    if (historyIndex > 0) {
      isUndoRedoRef.current = true;
      const targetIdx = historyIndex - 1;
      const targetCode = history[targetIdx];
      setHistoryIndex(targetIdx);
      setCode(targetCode);
      setActiveTargetField(null);
      setRefInsertion(null);
      setPendingProperties({});
      setTimeout(() => {
        isUndoRedoRef.current = false;
      }, 50);
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (editorDebounceRef.current) {
      clearTimeout(editorDebounceRef.current);
      editorDebounceRef.current = null;
    }
    if (historyIndex < history.length - 1) {
      isUndoRedoRef.current = true;
      const targetIdx = historyIndex + 1;
      const targetCode = history[targetIdx];
      setHistoryIndex(targetIdx);
      setCode(targetCode);
      setActiveTargetField(null);
      setRefInsertion(null);
      setPendingProperties({});
      setTimeout(() => {
        isUndoRedoRef.current = false;
      }, 50);
    }
  }, [history, historyIndex]);

  // Global Undo / Redo Keyboard Shortcuts (Ctrl+Z, Ctrl+Y, Cmd+Z, Cmd+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputFocused = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      if (!isCtrlOrCmd) return;

      if (e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          if (!isInputFocused) {
            e.preventDefault();
            handleRedo();
          }
        } else {
          if (!isInputFocused) {
            e.preventDefault();
            handleUndo();
          }
        }
      } else if (e.key.toLowerCase() === 'y') {
        if (!isInputFocused) {
          e.preventDefault();
          handleRedo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const isDarkMode = canvasBg === 'paper-dark' || (canvasBg === 'transparent' && theme === 'dark');

  // 코드 또는 테마/캔버스 배경 변경 시 컴파일 및 파싱 수행
  const runCompile = useCallback(async (currentCode: string, dark: boolean) => {
    const result = await compilePikchr(currentCode, dark);
    setCompileResult(result);
    if (result.success) {
      const parsedObjs = parseObjectsFromSource(currentCode);
      const parsedDefs = parseDefinitionsFromSource(currentCode);
      setObjects(parsedObjs);
      setDefinitions(parsedDefs);
    }
  }, []);

  useEffect(() => {
    runCompile(code, isDarkMode);
  }, [code, isDarkMode, runCompile]);

  const augmentedObjects = useMemo(() => {
    return objects.map(obj => {
      const pending = pendingProperties[obj.id];
      if (!pending) return obj;
      return {
        ...obj,
        properties: {
          ...obj.properties,
          ...pending,
        }
      };
    });
  }, [objects, pendingProperties]);

  const commitCodeHistory = useCallback((currentCode?: string) => {
    if (editorDebounceRef.current) {
      clearTimeout(editorDebounceRef.current);
      editorDebounceRef.current = null;
    }
    const codeToCommit = currentCode !== undefined ? currentCode : code;
    pushHistoryEntry(codeToCommit);
  }, [code, pushHistoryEntry]);

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    if (editorDebounceRef.current) clearTimeout(editorDebounceRef.current);
    editorDebounceRef.current = setTimeout(() => {
      pushHistoryEntry(newCode);
    }, 1000);
  };

  const handleSelectObject = (lineNumber: number | null, objId?: string) => {
    setSelectedLine(lineNumber);
    if (objId) {
      setSelectedObjectId(objId);
    } else if (lineNumber !== null) {
      const objOnLine = objects.find(o => {
        const span = o.rawStatement ? o.rawStatement.split('\n').length : 1;
        return lineNumber >= o.lineNumber && lineNumber < o.lineNumber + span;
      });
      setSelectedObjectId(objOnLine ? objOnLine.id : null);
    } else {
      setSelectedObjectId(null);
    }
    setActiveTargetField(null);
    setRefInsertion(null);
  };

  const handleInsertSnippet = (snippet: string) => {
    setCode(prev => {
      let nextCode = prev;
      if (snippet.startsWith('scale') || snippet.startsWith('define') || snippet.startsWith('$') || snippet.startsWith('@')) {
        nextCode = `${snippet}\n\n${prev}`;
      } else {
        const trimmed = prev.trimEnd();
        nextCode = trimmed ? `${trimmed}\n${snippet}\n` : `${snippet}\n`;
      }
      pushHistoryEntry(nextCode);
      return nextCode;
    });
  };

  const handleNewDiagram = () => {
    const newCode = `scale = 0.8\nbox "Start Node" fill 0xe0f2fe fit\narrow right 0.5in\nbox "End Node" fill 0xdcfce7 fit\n`;
    setCode(newCode);
    pushHistoryEntry(newCode);
    setSelectedLine(null);
    setSelectedObjectId(null);
    setActiveTargetField(null);
    setRefInsertion(null);
    setPendingProperties({});
  };

  const handleClearAll = () => {
    setCode('');
    pushHistoryEntry('');
    setSelectedLine(null);
    setSelectedObjectId(null);
    setActiveTargetField(null);
    setRefInsertion(null);
    setPendingProperties({});
  };

  const handleLoadTemplate = (templateCode: string) => {
    setCode(templateCode);
    pushHistoryEntry(templateCode);
    setSelectedLine(null);
    setSelectedObjectId(null);
    setActiveTargetField(null);
    setRefInsertion(null);
    setPendingProperties({});
  };

  const handleUpdateObject = (
    targetObj: PikchrObject,
    newProps: Partial<PikchrObject['properties']>,
    newLabel?: string,
    newLabelName?: string
  ) => {
    const lines = code.split('\n');
    const targetIndex = targetObj.lineNumber - 1;
    if (targetIndex < 0 || targetIndex >= lines.length) return;

    const currentPending = pendingProperties[targetObj.id] || {};
    const mergedProps = { ...targetObj.properties, ...currentPending, ...newProps };
    const label = newLabel !== undefined ? newLabel : (targetObj.label || '');

    const type = targetObj.type;
    const withVal = (mergedProps.with !== undefined ? mergedProps.with : mergedProps.withAnchor)?.trim();
    const atVal = mergedProps.at?.trim();
    const fromVal = mergedProps.from?.trim();
    const toVal = mergedProps.to?.trim();
    const untilVal = mergedProps.until?.trim();

    // with 구문은 at 구문이 있거나 with 내부에 at이 함께 포함된 경우에만 코드에 적용 (도형/텍스트 객체)
    const isWithPending = !!(withVal && !atVal && !withVal.includes(' at ') && !['arrow', 'line', 'spline', 'arc', 'move', 'direction'].includes(type));

    // Update pendingProperties for this object
    setPendingProperties(prev => {
      const next = { ...prev };
      const objPending: Partial<PikchrObjectProperties> = { ...(next[targetObj.id] || {}) };

      if (isWithPending) {
        objPending.with = withVal;
        objPending.withAnchor = withVal;
      } else {
        delete objPending.with;
        delete objPending.withAnchor;
      }

      if (Object.keys(objPending).length > 0) {
        next[targetObj.id] = objPending;
      } else {
        delete next[targetObj.id];
      }
      return next;
    });

    let updatedStatement = '';

    // ID 식별자(라벨명) 처리
    let activeLabelName = newLabelName !== undefined ? newLabelName.trim() : (targetObj.labelName || '');
    if (activeLabelName) {
      // 대문자로 시작하도록 포맷 또는 유지
      updatedStatement += `${activeLabelName}: `;
    }

    // 1. Text Object
    if (type === 'text') {
      updatedStatement += `text`;
      if (atVal) {
        if (withVal) updatedStatement += withVal.startsWith('with ') ? ` ${withVal}` : ` with ${withVal}`;
        updatedStatement += atVal.startsWith('at ') ? ` ${atVal}` : ` at ${atVal}`;
      } else if (withVal && withVal.includes(' at ')) {
        updatedStatement += withVal.startsWith('with ') ? ` ${withVal}` : ` with ${withVal}`;
      }
      if (label) updatedStatement += ` "${label}"`;
      if (mergedProps.textSize && mergedProps.textSize !== 'normal') updatedStatement += ` ${mergedProps.textSize}`;
      if (mergedProps.textStyle) updatedStatement += ` ${mergedProps.textStyle}`;
      if (mergedProps.textAlign && mergedProps.textAlign !== 'center') updatedStatement += ` ${mergedProps.textAlign}`;
      if (mergedProps.textPosition && mergedProps.textPosition !== 'center') updatedStatement += ` ${mergedProps.textPosition}`;
      if (mergedProps.color) updatedStatement += ` color ${mergedProps.color}`;
    }
    // 2. Arrow / Line / Spline Objects
    else if (['arrow', 'line', 'spline'].includes(type)) {
      updatedStatement += `${type}`;
      if (mergedProps.arrowHead && mergedProps.arrowHead !== 'none' && type !== 'arrow') {
        updatedStatement += ` ${mergedProps.arrowHead}`;
      } else if (type === 'arrow' && mergedProps.arrowHead && mergedProps.arrowHead !== '->' && mergedProps.arrowHead !== 'none') {
        updatedStatement += ` ${mergedProps.arrowHead}`;
      }

      const formatUntilClause = (val?: string): string => {
        if (!val) return '';
        const trimmed = val.trim();
        if (!trimmed) return '';
        if (/^until\s+even\s+with\b/i.test(trimmed)) {
          return ` ${trimmed}`;
        }
        if (/^even\s+with\b/i.test(trimmed)) {
          return ` until ${trimmed}`;
        }
        if (/^until\b/i.test(trimmed)) {
          const rest = trimmed.replace(/^until\s+/i, '').trim();
          if (/^even\s+with\b/i.test(rest)) {
            return ` until ${rest}`;
          }
          return ` until even with ${rest}`;
        }
        return ` until even with ${trimmed}`;
      };

      if (newProps.path !== undefined) {
        if (newProps.path.trim()) {
          updatedStatement += ` ${newProps.path.trim()}`;
        }
      } else if (newProps.pathSegments !== undefined) {
        const built = buildPathString({
          from: mergedProps.from,
          segments: newProps.pathSegments,
        });
        if (built) {
          updatedStatement += ` ${built}`;
        }
      } else {
        const isGeometryModified =
          newProps.direction !== undefined ||
          newProps.length !== undefined ||
          newProps.from !== undefined ||
          newProps.to !== undefined ||
          newProps.until !== undefined;

        const existingPath = targetObj.rawStatement ? extractConnectorPath(targetObj.rawStatement, type) : '';

        if (!isGeometryModified && existingPath) {
          updatedStatement += ` ${existingPath}`;
        } else {
          // to와 until은 상호 배타적이므로 하나가 수정되면 다른 하나는 자동 해제
          if (newProps.to !== undefined && newProps.until === undefined) {
            mergedProps.until = undefined;
          }
          if (newProps.until !== undefined && newProps.to === undefined) {
            mergedProps.to = undefined;
          }

          if (mergedProps.direction) updatedStatement += ` ${mergedProps.direction}`;
          if (!mergedProps.to && !mergedProps.until && mergedProps.length) {
            updatedStatement += ` ${mergedProps.length}`;
          }
          if (fromVal) updatedStatement += ` from ${fromVal}`;
          if (mergedProps.to?.trim()) updatedStatement += ` to ${mergedProps.to.trim()}`;
          else if (mergedProps.until?.trim()) updatedStatement += formatUntilClause(mergedProps.until);
        }
      }

      if (label) {
        updatedStatement += ` "${label}"`;
        if (mergedProps.textAlign && mergedProps.textAlign !== 'center') {
          updatedStatement += ` ${mergedProps.textAlign}`;
        }
        if (mergedProps.textPosition && mergedProps.textPosition !== 'center') {
          updatedStatement += ` ${mergedProps.textPosition}`;
        }
      }
      if (mergedProps.color) updatedStatement += ` color ${mergedProps.color}`;
      if (mergedProps.thickness) updatedStatement += ` ${mergedProps.thickness}`;
      if (mergedProps.dash) updatedStatement += ` ${mergedProps.dash}`;
      if (mergedProps.chop) updatedStatement += ` chop`;
    }
    // 3. Arc Object
    else if (type === 'arc') {
      updatedStatement += `arc`;
      if (mergedProps.arrowHead && mergedProps.arrowHead !== 'none') updatedStatement += ` ${mergedProps.arrowHead}`;
      if (mergedProps.arcDir) updatedStatement += ` ${mergedProps.arcDir}`;

      const formatUntilClause = (val?: string): string => {
        if (!val) return '';
        const trimmed = val.trim();
        if (!trimmed) return '';
        if (/^until\s+even\s+with\b/i.test(trimmed)) {
          return ` ${trimmed}`;
        }
        if (/^even\s+with\b/i.test(trimmed)) {
          return ` until ${trimmed}`;
        }
        if (/^until\b/i.test(trimmed)) {
          const rest = trimmed.replace(/^until\s+/i, '').trim();
          if (/^even\s+with\b/i.test(rest)) {
            return ` until ${rest}`;
          }
          return ` until even with ${rest}`;
        }
        return ` until even with ${trimmed}`;
      };

      const isGeometryModified =
        newProps.from !== undefined ||
        newProps.to !== undefined ||
        newProps.until !== undefined;

      const existingPath = targetObj.rawStatement ? extractConnectorPath(targetObj.rawStatement, type) : '';

      if (!isGeometryModified && existingPath) {
        updatedStatement += ` ${existingPath}`;
      } else {
        if (newProps.to !== undefined && newProps.until === undefined) {
          mergedProps.until = undefined;
        }
        if (newProps.until !== undefined && newProps.to === undefined) {
          mergedProps.to = undefined;
        }

        if (fromVal) updatedStatement += ` from ${fromVal}`;
        if (mergedProps.to?.trim()) updatedStatement += ` to ${mergedProps.to.trim()}`;
        else if (mergedProps.until?.trim()) updatedStatement += formatUntilClause(mergedProps.until);
      }

      if (mergedProps.radius) updatedStatement += ` rad ${mergedProps.radius}`;
      if (mergedProps.color) updatedStatement += ` color ${mergedProps.color}`;
      if (mergedProps.thickness) updatedStatement += ` ${mergedProps.thickness}`;
      if (mergedProps.dash) updatedStatement += ` ${mergedProps.dash}`;
    }
    // 4. Move Object / Direction Object
    else if (type === 'move') {
      const formatUntilClause = (val?: string): string => {
        if (!val) return '';
        const trimmed = val.trim();
        if (!trimmed) return '';
        if (/^until\s+even\s+with\b/i.test(trimmed)) {
          return ` ${trimmed}`;
        }
        if (/^even\s+with\b/i.test(trimmed)) {
          return ` until ${trimmed}`;
        }
        if (/^until\b/i.test(trimmed)) {
          const rest = trimmed.replace(/^until\s+/i, '').trim();
          if (/^even\s+with\b/i.test(rest)) {
            return ` until ${rest}`;
          }
          return ` until even with ${rest}`;
        }
        return ` until even with ${trimmed}`;
      };

      if (newProps.path !== undefined) {
        if (newProps.path.trim()) {
          updatedStatement += `move ${newProps.path.trim()}`;
        } else {
          updatedStatement += `move`;
        }
      } else if (newProps.pathSegments !== undefined) {
        const built = buildPathString({
          from: mergedProps.from,
          segments: newProps.pathSegments,
        });
        updatedStatement += `move ${built}`.trim();
      } else {
        if (newProps.to !== undefined && newProps.until === undefined) {
          mergedProps.until = undefined;
        }
        if (newProps.until !== undefined && newProps.to === undefined) {
          mergedProps.to = undefined;
        }
        updatedStatement += `move`;
        if (mergedProps.direction) updatedStatement += ` ${mergedProps.direction}`;
        if (!toVal && !untilVal && mergedProps.length) {
          updatedStatement += ` ${mergedProps.length}`;
        }
        if (toVal && !mergedProps.until) updatedStatement += ` to ${toVal}`;
        else if (untilVal) updatedStatement += formatUntilClause(untilVal);
      }
    }
    else if (type === 'direction') {
      const dir = mergedProps.direction || 'right';
      updatedStatement += `${dir}`;
    }
    // 5. Circle / Dot Objects
    else if (['circle', 'dot'].includes(type)) {
      updatedStatement += `${type}`;
      if (atVal) {
        if (withVal) updatedStatement += withVal.startsWith('with ') ? ` ${withVal}` : ` with ${withVal}`;
        updatedStatement += atVal.startsWith('at ') ? ` ${atVal}` : ` at ${atVal}`;
      } else if (withVal && withVal.includes(' at ')) {
        updatedStatement += withVal.startsWith('with ') ? ` ${withVal}` : ` with ${withVal}`;
      }
      if (label) {
        updatedStatement += ` "${label}"`;
        if (mergedProps.textAlign && mergedProps.textAlign !== 'center') {
          updatedStatement += ` ${mergedProps.textAlign}`;
        }
        if (mergedProps.textPosition && mergedProps.textPosition !== 'center') {
          updatedStatement += ` ${mergedProps.textPosition}`;
        }
      }
      if (mergedProps.radius) updatedStatement += ` rad ${mergedProps.radius}`;
      else if (mergedProps.diameter) updatedStatement += ` diam ${mergedProps.diameter}`;
      if (mergedProps.fill) updatedStatement += ` fill ${mergedProps.fill}`;
      if (mergedProps.color) updatedStatement += ` color ${mergedProps.color}`;
      if (mergedProps.thickness) updatedStatement += ` ${mergedProps.thickness}`;
      if (mergedProps.dash) updatedStatement += ` ${mergedProps.dash}`;
      if (mergedProps.invis) updatedStatement += ` invis`;
    }
    // 6. Box-like Shapes (Box, Cylinder, Diamond, Oval, Ellipse, File, Block)
    else {
      updatedStatement += `${type}`;
      if (atVal) {
        if (withVal) updatedStatement += withVal.startsWith('with ') ? ` ${withVal}` : ` with ${withVal}`;
        updatedStatement += atVal.startsWith('at ') ? ` ${atVal}` : ` at ${atVal}`;
      } else if (withVal && withVal.includes(' at ')) {
        updatedStatement += withVal.startsWith('with ') ? ` ${withVal}` : ` with ${withVal}`;
      }
      if (label) {
        updatedStatement += ` "${label}"`;
        if (mergedProps.textAlign && mergedProps.textAlign !== 'center') {
          updatedStatement += ` ${mergedProps.textAlign}`;
        }
        if (mergedProps.textPosition && mergedProps.textPosition !== 'center') {
          updatedStatement += ` ${mergedProps.textPosition}`;
        }
      }
      if (mergedProps.width) updatedStatement += ` width ${mergedProps.width}`;
      if (mergedProps.height) updatedStatement += ` height ${mergedProps.height}`;
      if (mergedProps.radius) updatedStatement += ` rad ${mergedProps.radius}`;
      if (mergedProps.fill) updatedStatement += ` fill ${mergedProps.fill}`;
      if (mergedProps.color) updatedStatement += ` color ${mergedProps.color}`;
      if (mergedProps.fit) updatedStatement += ` fit`;
      if (mergedProps.thickness) updatedStatement += ` ${mergedProps.thickness}`;
      if (mergedProps.dash) updatedStatement += ` ${mergedProps.dash}`;
      if (mergedProps.invis) updatedStatement += ` invis`;
    }

    const formatMultiLineStatement = (rawStmt: string, singleLine: string): string => {
      if (!rawStmt || !rawStmt.includes('\n')) {
        return indent + singleLine;
      }

      const rawLines = rawStmt.split('\n');
      if (rawLines.length <= 1) return indent + singleLine;

      const prefixLines: string[] = [];
      let remainingSingle = singleLine.trim();

      // singleLine에 레이블 식별자가 포함되어 있는 경우 추출
      let activeLabel = '';
      const labelMatch = remainingSingle.match(/^([A-Z][a-zA-Z0-9_]*\s*:\s*)/);
      if (labelMatch) {
        activeLabel = labelMatch[1];
        remainingSingle = remainingSingle.slice(labelMatch[0].length).trim();
      }

      for (let i = 0; i < rawLines.length - 1; i++) {
        const rawL = rawLines[i];
        const lIndentMatch = rawL.match(/^(\s*)/);
        const lIndent = lIndentMatch ? lIndentMatch[1] : '';
        // 원본 행의 기존 레이블 접두사 및 끝 백슬래시 제거 후 비교
        const content = rawL.trim().replace(/^[A-Z][a-zA-Z0-9_]*\s*:\s*/, '').replace(/\\$/, '').trim();

        if (remainingSingle.startsWith(content)) {
          if (i === 0 && activeLabel) {
            prefixLines.push(lIndent + activeLabel + content + ' \\');
          } else {
            prefixLines.push(lIndent + content + ' \\');
          }
          remainingSingle = remainingSingle.slice(content.length).trim();
        } else {
          break;
        }
      }

      if (prefixLines.length > 0 && prefixLines.length === rawLines.length - 1) {
        const lastRaw = rawLines[rawLines.length - 1];
        const lastIndentMatch = lastRaw.match(/^(\s*)/);
        const lastIndent = lastIndentMatch ? lastIndentMatch[1] : (indent + '   ');
        return [...prefixLines, lastIndent + remainingSingle].join('\n');
      }

      return indent + singleLine;
    };

    const isConnectorType = ['arrow', 'line', 'spline', 'move'].includes(type);
    let activeSegments: PathSegment[] | undefined = undefined;
    if (newProps.pathSegments !== undefined && newProps.pathSegments.length > 0) {
      activeSegments = newProps.pathSegments;
    } else if (newProps.path !== undefined) {
      const parsedPath = parsePathIntoSegments(newProps.path);
      if (parsedPath.segments.length > 0) activeSegments = parsedPath.segments;
    } else if (targetObj.properties.pathSegments && targetObj.properties.pathSegments.length > 0) {
      activeSegments = targetObj.properties.pathSegments;
    }

    const originalLine = lines[targetIndex];
    const indentMatch = originalLine.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] : '';
    const lineSpan = targetObj.rawStatement ? targetObj.rawStatement.split('\n').length : 1;

    let finalStatement = indent + updatedStatement;

    // 다구간 선분(Multi-segment connector)인 경우 각 then 세그먼트를 '\' 개행으로 포맷
    if (isConnectorType && activeSegments && activeSegments.length > 1) {
      let header = `${type}`;
      if (type !== 'move' && mergedProps.arrowHead && mergedProps.arrowHead !== 'none') {
        header += ` ${mergedProps.arrowHead}`;
      }
      if (fromVal) {
        header += ` from ${fromVal}`;
      }

      let suffix = '';
      if (label) {
        suffix += ` "${label}"`;
        if (mergedProps.textAlign && mergedProps.textAlign !== 'center') {
          suffix += ` ${mergedProps.textAlign}`;
        }
        if (mergedProps.textPosition && mergedProps.textPosition !== 'center') {
          suffix += ` ${mergedProps.textPosition}`;
        }
      }
      if (mergedProps.color) suffix += ` color ${mergedProps.color}`;
      if (mergedProps.thickness) suffix += ` ${mergedProps.thickness}`;
      if (mergedProps.dash) suffix += ` ${mergedProps.dash}`;
      if (mergedProps.chop) suffix += ` chop`;

      const rawLines = targetObj.rawStatement ? targetObj.rawStatement.split('\n') : [];
      let subIndent = indent + '    ';
      if (rawLines.length > 1) {
        const matchSub = rawLines[1].match(/^(\s*)/);
        if (matchSub && matchSub[1]) {
          subIndent = matchSub[1];
        }
      }

      const segStrings = activeSegments.map(seg => {
        let res = '';
        if (seg.direction) res += (res ? ` ` : '') + seg.direction;
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
      });

      const multiLines: string[] = [];
      for (let i = 0; i < segStrings.length; i++) {
        const segStr = segStrings[i];
        if (i === 0) {
          const lineContent = `${activeLabelName ? activeLabelName + ': ' : ''}${header} ${segStr}`.trim();
          multiLines.push(indent + lineContent + ' \\');
        } else if (i === segStrings.length - 1) {
          const lineContent = `then ${segStr}${suffix ? ' ' + suffix.trim() : ''}`.trim();
          multiLines.push(subIndent + lineContent);
        } else {
          const lineContent = `then ${segStr}`.trim();
          multiLines.push(subIndent + lineContent + ' \\');
        }
      }
      finalStatement = multiLines.join('\n');
    } else if (lineSpan > 1 && targetObj.rawStatement) {
      finalStatement = formatMultiLineStatement(targetObj.rawStatement, updatedStatement);
    }

    const stmts = splitStatements(originalLine);
    if (stmts.length > 1 && lineSpan === 1) {
      let matchIdx = -1;
      const objsOnLine = objects.filter(o => o.lineNumber === targetObj.lineNumber);
      const idxOnLine = objsOnLine.findIndex(o => o.id === targetObj.id);
      if (idxOnLine >= 0 && idxOnLine < stmts.length) {
        matchIdx = idxOnLine;
      }
      if (matchIdx === -1 && targetObj.labelName) {
        matchIdx = stmts.findIndex(s => s.trim().startsWith(`${targetObj.labelName}:`));
      }
      if (matchIdx === -1 && targetObj.rawStatement) {
        matchIdx = stmts.findIndex(s => s.trim() === targetObj.rawStatement.trim());
      }
      if (matchIdx !== -1) {
        stmts[matchIdx] = updatedStatement;
        lines[targetIndex] = indent + stmts.map(s => s.trim()).join(';  ');
      } else {
        lines.splice(targetIndex, lineSpan, ...finalStatement.split('\n'));
      }
    } else {
      lines.splice(targetIndex, lineSpan, ...finalStatement.split('\n'));
    }

    if (newLabelName !== undefined) {
      setSelectedObjectId(targetObj.id);
    }

    const newCode = lines.join('\n');
    setCode(newCode);
    pushHistoryEntry(newCode);
  };

  const handleDeleteObject = (lineNumber: number, objId?: string) => {
    const lines = code.split('\n');
    const targetIndex = lineNumber - 1;
    if (targetIndex < 0 || targetIndex >= lines.length) return;

    const targetObj = objects.find(o => objId ? o.id === objId : o.lineNumber === lineNumber);
    const lineSpan = targetObj?.rawStatement ? targetObj.rawStatement.split('\n').length : 1;
    const originalLine = lines[targetIndex];
    const indentMatch = originalLine.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] : '';
    const stmts = splitStatements(originalLine);

    if (stmts.length > 1 && objId && lineSpan === 1) {
      let matchIdx = -1;
      const objsOnLine = objects.filter(o => o.lineNumber === lineNumber);
      const idxOnLine = objsOnLine.findIndex(o => o.id === objId);
      if (idxOnLine >= 0 && idxOnLine < stmts.length) {
        matchIdx = idxOnLine;
      }
      if (matchIdx === -1 && targetObj?.labelName) {
        matchIdx = stmts.findIndex(s => s.trim().startsWith(`${targetObj.labelName}:`));
      }
      if (matchIdx === -1 && targetObj?.rawStatement) {
        matchIdx = stmts.findIndex(s => s.trim() === targetObj.rawStatement.trim());
      }
      if (matchIdx !== -1) {
        stmts.splice(matchIdx, 1);
        lines[targetIndex] = indent + stmts.map(s => s.trim()).join(';  ');
        const newCode = lines.join('\n');
        setCode(newCode);
        pushHistoryEntry(newCode);
        if (selectedObjectId === objId) {
          setSelectedObjectId(null);
          setSelectedLine(null);
          setActiveTargetField(null);
          setRefInsertion(null);
        }
        return;
      }
    } else {
      lines.splice(targetIndex, lineSpan);
      const newCode = lines.join('\n');
      setCode(newCode);
      pushHistoryEntry(newCode);
      if (selectedObjectId === objId || (targetObj && selectedObjectId === targetObj.id)) {
        setSelectedObjectId(null);
        setSelectedLine(null);
        setActiveTargetField(null);
        setRefInsertion(null);
      }
    }
  };

  const handleExportSvg = () => {
    if (!compileResult.svgHtml) return;
    const blob = new Blob([compileResult.svgHtml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'diagram.svg';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPng = () => {
    if (!compileResult.svgHtml) return;
    const svgBlob = new Blob([compileResult.svgHtml], { type: 'image/svg+xml;charset=utf-8' });
    const URLObject = window.URL || window.webkitURL || window;
    const blobURL = URLObject.createObjectURL(svgBlob);
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.width * 2 || 800;
      canvas.height = image.height * 2 || 600;
      const context = canvas.getContext('2d');
      if (context) {
        context.fillStyle = isDarkMode ? '#090d16' : '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const pngUrl = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = pngUrl;
        downloadLink.download = 'diagram.png';
        downloadLink.click();
      }
    };
    image.src = blobURL;
  };

  const handleCopyCode = async () => {
    const success = await copyToClipboard(code);
    if (success) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleSelectAnchor = (refStr: string, anchorName?: string) => {
    if (!selectedLine && !selectedObjectId) return;
    if (!activeTargetField) return;

    const currentObj = selectedObjectId
      ? augmentedObjects.find(obj => obj.id === selectedObjectId)
      : augmentedObjects.find(obj => {
          const span = obj.rawStatement ? obj.rawStatement.split('\n').length : 1;
          return selectedLine !== null && selectedLine >= obj.lineNumber && selectedLine < obj.lineNumber + span;
        });

    if (!currentObj) return;

    const targetField = activeTargetField;
    const valueToInsert = (targetField === 'with' && anchorName) ? anchorName : refStr;

    if (targetField.startsWith('to_') || targetField.startsWith('until_')) {
      const isUntil = targetField.startsWith('until_');
      const segIndex = parseInt(targetField.split('_')[1], 10);
      const currentSegments: PathSegment[] = currentObj.properties.pathSegments
        ? currentObj.properties.pathSegments.map(s => ({ ...s }))
        : parsePathIntoSegments(currentObj.properties.path || currentObj.rawStatement || '').segments;

      if (currentSegments[segIndex]) {
        currentSegments[segIndex] = {
          ...currentSegments[segIndex],
          endMode: isUntil ? 'until' : 'to',
          to: isUntil ? undefined : valueToInsert,
          until: isUntil ? valueToInsert : undefined,
        };
      }
      const newPath = buildPathString({
        from: currentObj.properties.from,
        segments: currentSegments,
      });
      handleUpdateObject(currentObj, {
        path: newPath,
        pathSegments: currentSegments,
        to: isUntil ? undefined : (segIndex === 0 ? valueToInsert : currentObj.properties.to),
        until: isUntil ? (segIndex === 0 ? valueToInsert : currentObj.properties.until) : undefined,
      });
      setRefInsertion({ field: targetField, value: valueToInsert, timestamp: Date.now() });
      setActiveTargetField(null);
      return;
    }

    handleUpdateObject(currentObj, {
      [targetField]: valueToInsert,
      ...(targetField === 'with' ? { with: valueToInsert, withAnchor: valueToInsert } : {}),
      ...(targetField === 'to' ? { until: undefined } : {}),
      ...(targetField === 'until' ? { to: undefined } : {}),
    });
    setRefInsertion({ field: targetField, value: valueToInsert, timestamp: Date.now() });

    // Auto-advance target field for seamless 2-step workflow!
    if (targetField === 'with') {
      setActiveTargetField('at');
    } else if (targetField === 'from') {
      setActiveTargetField('to');
    } else if (targetField === 'at' || targetField === 'to' || targetField === 'until') {
      setActiveTargetField(null);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden transition-colors">
      {/* 1. Desktop IDE Menu Bar with i18n */}
      <MenuBar
        onNewDiagram={handleNewDiagram}
        onLoadTemplate={handleLoadTemplate}
        onExportSvg={handleExportSvg}
        onExportPng={handleExportPng}
        onCopyCode={handleCopyCode}
        onInsertSnippet={handleInsertSnippet}
        onClearAll={handleClearAll}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        onToggleEditor={() => setIsEditorVisible(!isEditorVisible)}
        onOpenHelp={() => setIsHelpOpen(true)}
        isCopied={isCopied}
        compileSuccess={compileResult.success}
        durationMs={compileResult.durationMs}
      />

      {/* 2. Middle Main Workspace */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        {/* Left Palette & Definitions Sidebar */}
        <PaletteSidebar
          onInsertSnippet={handleInsertSnippet}
          definitions={definitions}
          onSelectLine={(line) => handleSelectObject(line)}
          onDeleteLine={(line) => handleDeleteObject(line)}
        />

        {/* Center Interactive Canvas */}
        <CenterStage
          compileResult={compileResult}
          objects={augmentedObjects}
          selectedLine={selectedLine}
          selectedObjectId={selectedObjectId}
          activeTargetField={activeTargetField}
          onSelectLine={handleSelectObject}
          onSelectAnchor={handleSelectAnchor}
        />

        {/* Right Object Tree & Property Inspector */}
        <ObjectListSidebar
          objects={augmentedObjects}
          definitions={definitions}
          selectedLine={selectedLine}
          selectedObjectId={selectedObjectId}
          activeTargetField={activeTargetField}
          setActiveTargetField={setActiveTargetField}
          refInsertion={refInsertion}
          onSelectObject={handleSelectObject}
          onUpdateObject={handleUpdateObject}
          onDeleteObject={handleDeleteObject}
        />
      </div>

      {/* 3. Bottom Code Editor & Diagnostics Console */}
      {isEditorVisible && (
        <CodeEditorPanel
          code={code}
          onChangeCode={handleCodeChange}
          selectedLine={selectedLine}
          selectedObjectId={selectedObjectId}
          objects={augmentedObjects}
          definitions={definitions}
          onSelectLine={handleSelectObject}
          compileResult={compileResult}
          isExpanded={isEditorExpanded}
          onToggleExpand={() => setIsEditorExpanded(!isEditorExpanded)}
          onCommitHistory={commitCodeHistory}
          onUndo={handleUndo}
          onRedo={handleRedo}
        />
      )}

      {/* 4. Help & Syntax Modal */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {/* 5. Copy Toast Notification */}
      {isCopied && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 dark:bg-slate-800/95 text-white px-4 py-2.5 rounded-lg shadow-2xl border border-slate-700 flex items-center space-x-2 text-xs font-medium backdrop-blur-xs animate-in fade-in slide-in-from-bottom-2 duration-150 pointer-events-none">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{t.menu.copySource} ({t.common.copied})</span>
        </div>
      )}
    </div>
  );
};

export default App;
