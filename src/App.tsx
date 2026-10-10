import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Check, FileCode2, Eye } from 'lucide-react';
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

const copyToClipboard = async (text: string): Promise<boolean> => {
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

  // --- Resizable Panels & Splitters ---
  const [leftWidth, setLeftWidth] = useState<number>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('pikchr_w_left') : null;
    return saved ? Math.max(180, Math.min(600, parseInt(saved, 10))) : 280;
  });
  const [rightWidth, setRightWidth] = useState<number>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('pikchr_w_right') : null;
    return saved ? Math.max(220, Math.min(650, parseInt(saved, 10))) : 320;
  });
  const [bottomHeight, setBottomHeight] = useState<number>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('pikchr_h_bottom') : null;
    return saved ? Math.max(120, Math.min(700, parseInt(saved, 10))) : 210;
  });

  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);
  const [isDraggingBottom, setIsDraggingBottom] = useState(false);

  // --- Mobile Responsive UI ---
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });
  const [mobileTab, setMobileTab] = useState<'canvas' | 'editor'>('canvas');

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    localStorage.setItem('pikchr_w_left', String(leftWidth));
  }, [leftWidth]);

  useEffect(() => {
    localStorage.setItem('pikchr_w_right', String(rightWidth));
  }, [rightWidth]);

  useEffect(() => {
    localStorage.setItem('pikchr_h_bottom', String(bottomHeight));
  }, [bottomHeight]);

  useEffect(() => {
    if (!isDraggingLeft && !isDraggingRight && !isDraggingBottom) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingLeft) {
        const newWidth = Math.max(180, Math.min(600, e.clientX));
        setLeftWidth(newWidth);
      } else if (isDraggingRight) {
        const newWidth = Math.max(220, Math.min(650, window.innerWidth - e.clientX));
        setRightWidth(newWidth);
      } else if (isDraggingBottom) {
        const maxHeight = Math.max(200, window.innerHeight - 140);
        const newHeight = Math.max(100, Math.min(maxHeight, window.innerHeight - e.clientY));
        setBottomHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingLeft(false);
      setIsDraggingRight(false);
      setIsDraggingBottom(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingLeft, isDraggingRight, isDraggingBottom]);

  const [activeTargetField, setActiveTargetField] = useState<ActiveTargetField>(null);
  const [refInsertion, setRefInsertion] = useState<{ field: ActiveTargetField; value: string; timestamp: number } | null>(null);
  const [pendingProperties, setPendingProperties] = useState<Record<string, Partial<PikchrObjectProperties>>>({});

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
      runCompile(targetCode, isDarkMode);
      setActiveTargetField(null);
      setRefInsertion(null);
      setPendingProperties({});
      setTimeout(() => {
        isUndoRedoRef.current = false;
      }, 50);
    }
  }, [history, historyIndex, isDarkMode, runCompile]);

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
      runCompile(targetCode, isDarkMode);
      setActiveTargetField(null);
      setRefInsertion(null);
      setPendingProperties({});
      setTimeout(() => {
        isUndoRedoRef.current = false;
      }, 50);
    }
  }, [history, historyIndex, isDarkMode, runCompile]);

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

  // 테마/캔버스 배경 변경 시 또는 초기 마운트 시 컴파일 수행
  const codeRef = useRef(code);
  codeRef.current = code;

  useEffect(() => {
    runCompile(codeRef.current, isDarkMode);
  }, [isDarkMode, runCompile]);

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

  const handleCodeChange = (newCode: string, isStatementComplete = false) => {
    setCode(newCode);
    if (isStatementComplete) {
      runCompile(newCode, isDarkMode);
    }
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
      runCompile(nextCode, isDarkMode);
      return nextCode;
    });
  };

  const handleNewDiagram = () => {
    const newCode = `scale = 0.8\nbox "Start Node" fill 0xe0f2fe fit\narrow right 0.5in\nbox "End Node" fill 0xdcfce7 fit\n`;
    setCode(newCode);
    pushHistoryEntry(newCode);
    runCompile(newCode, isDarkMode);
    setSelectedLine(null);
    setSelectedObjectId(null);
    setActiveTargetField(null);
    setRefInsertion(null);
    setPendingProperties({});
  };

  const handleClearAll = () => {
    setCode('');
    pushHistoryEntry('');
    runCompile('', isDarkMode);
    setSelectedLine(null);
    setSelectedObjectId(null);
    setActiveTargetField(null);
    setRefInsertion(null);
    setPendingProperties({});
  };

  const handleLoadTemplate = (templateCode: string) => {
    setCode(templateCode);
    pushHistoryEntry(templateCode);
    runCompile(templateCode, isDarkMode);
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
    const latestObjs = parseObjectsFromSource(code);
    let latestObj = latestObjs.find(o => o.id === targetObj.id);
    if (!latestObj && targetObj.labelName) {
      latestObj = latestObjs.find(o => o.labelName === targetObj.labelName);
    }
    if (!latestObj) {
      const prevIdx = objects.findIndex(o => o.id === targetObj.id);
      if (prevIdx >= 0 && prevIdx < latestObjs.length && latestObjs[prevIdx].type === targetObj.type) {
        latestObj = latestObjs[prevIdx];
      }
    }
    if (!latestObj) {
      latestObj = latestObjs.find(o => o.lineNumber === targetObj.lineNumber && o.type === targetObj.type);
    }
    if (!latestObj) {
      latestObj = targetObj;
    }

    const currentPending = pendingProperties[latestObj.id] || pendingProperties[targetObj.id] || {};
    const mergedProps = { ...latestObj.properties, ...currentPending, ...newProps };
    const label = newLabel !== undefined ? newLabel : (latestObj.label || targetObj.label || '');

    const type = latestObj.type || targetObj.type;
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
    let activeLabelName = newLabelName !== undefined ? newLabelName.trim() : (latestObj.labelName || targetObj.labelName || '');
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
        return singleLine;
      }

      const rawLines = rawStmt.split('\n');
      if (rawLines.length <= 1) return singleLine;

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
          if (i === 0) {
            prefixLines.push((activeLabel ? activeLabel : '') + content + ' \\');
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
        const lastIndent = lastIndentMatch ? lastIndentMatch[1] : '    ';
        return [...prefixLines, lastIndent + remainingSingle].join('\n');
      }

      return singleLine;
    };

    const isConnectorType = ['arrow', 'line', 'spline', 'move'].includes(type);
    let activeSegments: PathSegment[] | undefined = undefined;
    if (newProps.pathSegments !== undefined && newProps.pathSegments.length > 0) {
      activeSegments = newProps.pathSegments;
    } else if (newProps.path !== undefined) {
      const parsedPath = parsePathIntoSegments(newProps.path);
      if (parsedPath.segments.length > 0) activeSegments = parsedPath.segments;
    } else if (latestObj.properties.pathSegments && latestObj.properties.pathSegments.length > 0) {
      activeSegments = latestObj.properties.pathSegments;
    }

    let finalStatement = updatedStatement;

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

      const rawLines = latestObj.rawStatement ? latestObj.rawStatement.split('\n') : [];
      let subIndent = '    ';
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
          multiLines.push(lineContent + ' \\');
        } else if (i === segStrings.length - 1) {
          const lineContent = `then ${segStr}${suffix ? ' ' + suffix.trim() : ''}`.trim();
          multiLines.push(subIndent + lineContent);
        } else {
          const lineContent = `then ${segStr}`.trim();
          multiLines.push(subIndent + lineContent + ' \\');
        }
      }
      finalStatement = multiLines.join('\n');
    } else if (latestObj.rawStatement && latestObj.rawStatement.includes('\n')) {
      finalStatement = formatMultiLineStatement(latestObj.rawStatement, updatedStatement);
    }

    let newCode: string;
    if (latestObj.startChar !== undefined && latestObj.endChar !== undefined) {
      newCode = code.substring(0, latestObj.startChar) + finalStatement + code.substring(latestObj.endChar);
    } else {
      const lines = code.split('\n');
      const targetIndex = latestObj.lineNumber - 1;
      const originalLine = lines[targetIndex] || '';
      const indentMatch = originalLine.match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1] : '';
      const lineSpan = latestObj.rawStatement ? latestObj.rawStatement.split('\n').length : 1;
      lines.splice(targetIndex, lineSpan, ...finalStatement.split('\n').map((l, i) => i === 0 ? indent + l : l));
      newCode = lines.join('\n');
    }

    if (newLabelName !== undefined) {
      setSelectedObjectId(targetObj.id);
    }

    setCode(newCode);
    pushHistoryEntry(newCode);
    runCompile(newCode, isDarkMode);
  };

  const handleDeleteObject = (lineNumber: number, objId?: string) => {
    const latestObjs = parseObjectsFromSource(code);
    let targetObj = latestObjs.find(o => objId ? o.id === objId : o.lineNumber === lineNumber);
    if (!targetObj && objId) {
      const prevIdx = objects.findIndex(o => o.id === objId);
      if (prevIdx >= 0 && prevIdx < latestObjs.length) {
        targetObj = latestObjs[prevIdx];
      }
    }
    if (!targetObj) {
      targetObj = objects.find(o => objId ? o.id === objId : o.lineNumber === lineNumber);
    }

    if (!targetObj) return;

    let newCode: string;
    if (targetObj.startChar !== undefined && targetObj.endChar !== undefined) {
      let delStart = targetObj.startChar;
      let delEnd = targetObj.endChar;

      // 세미콜론(;) 구분 라인인 경우 뒤쪽 세미콜론 및 공백 함께 제거
      let nextIdx = delEnd;
      while (nextIdx < code.length && (code[nextIdx] === ' ' || code[nextIdx] === '\t')) {
        nextIdx++;
      }
      if (nextIdx < code.length && code[nextIdx] === ';') {
        delEnd = nextIdx + 1;
        while (delEnd < code.length && (code[delEnd] === ' ' || code[delEnd] === '\t')) {
          delEnd++;
        }
      } else {
        // 뒤쪽에 세미콜론이 없으면 앞쪽 세미콜론 탐색
        let prevIdx = delStart - 1;
        while (prevIdx >= 0 && (code[prevIdx] === ' ' || code[prevIdx] === '\t')) {
          prevIdx--;
        }
        if (prevIdx >= 0 && code[prevIdx] === ';') {
          delStart = prevIdx;
        } else {
          // 라인 전체를 차지하는 문장인 경우 앞쪽 들여쓰기 및 뒤쪽 개행문자 포함 제거
          while (delStart > 0 && code[delStart - 1] !== '\n') {
            delStart--;
          }
          if (delEnd < code.length && code[delEnd] === '\r') delEnd++;
          if (delEnd < code.length && code[delEnd] === '\n') delEnd++;
        }
      }

      newCode = code.substring(0, delStart) + code.substring(delEnd);
    } else {
      const lines = code.split('\n');
      const targetIndex = targetObj.lineNumber - 1;
      const lineSpan = targetObj.rawStatement ? targetObj.rawStatement.split('\n').length : 1;
      lines.splice(targetIndex, lineSpan);
      newCode = lines.join('\n');
    }

    setCode(newCode);
    pushHistoryEntry(newCode);
    runCompile(newCode, isDarkMode);
    if (selectedObjectId === objId || (targetObj && selectedObjectId === targetObj.id)) {
      setSelectedObjectId(null);
      setSelectedLine(null);
      setActiveTargetField(null);
      setRefInsertion(null);
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

      {/* Mobile View Switcher Bar */}
      {isMobile && (
        <div className="h-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 flex items-center justify-between shrink-0 select-none z-20">
          <div className="flex w-full p-1 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 space-x-1">
            <button
              onClick={() => setMobileTab('editor')}
              className={`flex-1 py-1 px-3 rounded-md text-xs font-semibold flex items-center justify-center space-x-1.5 transition ${
                mobileTab === 'editor'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>{t.common.codeView}</span>
            </button>
            <button
              onClick={() => setMobileTab('canvas')}
              className={`flex-1 py-1 px-3 rounded-md text-xs font-semibold flex items-center justify-center space-x-1.5 transition ${
                mobileTab === 'canvas'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{t.common.renderView}</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Workspace: Mobile View vs Desktop Multi-panel */}
      {isMobile ? (
        <div className="flex-1 flex overflow-hidden min-h-0 relative">
          {mobileTab === 'canvas' ? (
            <CenterStage
              compileResult={compileResult}
              objects={augmentedObjects}
              selectedLine={selectedLine}
              selectedObjectId={selectedObjectId}
              activeTargetField={activeTargetField}
              onSelectLine={handleSelectObject}
              onSelectAnchor={handleSelectAnchor}
            />
          ) : (
            <CodeEditorPanel
              code={code}
              onChangeCode={handleCodeChange}
              selectedLine={selectedLine}
              selectedObjectId={selectedObjectId}
              objects={augmentedObjects}
              definitions={definitions}
              onSelectLine={handleSelectObject}
              compileResult={compileResult}
              isExpanded={false}
              onToggleExpand={() => {}}
              onCommitHistory={commitCodeHistory}
              onUndo={handleUndo}
              onRedo={handleRedo}
              isMobileFull={true}
            />
          )}

          {/* Floating Switch Pill Button for quick 1-tap switching */}
          <button
            onClick={() => setMobileTab(prev => (prev === 'canvas' ? 'editor' : 'canvas'))}
            className="fixed bottom-5 right-5 z-40 bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2.5 rounded-full shadow-xl flex items-center space-x-2 text-xs font-semibold active:scale-95 transition"
            title={mobileTab === 'canvas' ? t.common.switchToCode : t.common.switchToRender}
          >
            {mobileTab === 'canvas' ? (
              <>
                <FileCode2 className="w-4 h-4" />
                <span>{t.common.codeView}</span>
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" />
                <span>{t.common.renderView}</span>
              </>
            )}
          </button>
        </div>
      ) : (
        <>
          {/* Desktop Middle Main Workspace */}
          <div className="flex-1 flex overflow-hidden min-h-0 relative">
            {/* Left Palette & Definitions Sidebar */}
            <PaletteSidebar
              width={leftWidth}
              onInsertSnippet={handleInsertSnippet}
              definitions={definitions}
              onSelectLine={(line) => handleSelectObject(line)}
              onDeleteLine={(line) => handleDeleteObject(line)}
            />

            {/* Left Resizer Splitter */}
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                setIsDraggingLeft(true);
              }}
              onDoubleClick={() => setLeftWidth(280)}
              title="드래그하여 너비 조절 (더블 클릭 시 기본값)"
              className={`w-1 cursor-col-resize hover:w-1.5 transition-[width,background-color] hover:bg-blue-500 active:bg-blue-600 bg-slate-200 dark:bg-slate-800 z-10 shrink-0 select-none ${
                isDraggingLeft ? 'bg-blue-500 w-1.5' : ''
              }`}
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

            {/* Right Resizer Splitter */}
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                setIsDraggingRight(true);
              }}
              onDoubleClick={() => setRightWidth(320)}
              title="드래그하여 너비 조절 (더블 클릭 시 기본값)"
              className={`w-1 cursor-col-resize hover:w-1.5 transition-[width,background-color] hover:bg-blue-500 active:bg-blue-600 bg-slate-200 dark:bg-slate-800 z-10 shrink-0 select-none ${
                isDraggingRight ? 'bg-blue-500 w-1.5' : ''
              }`}
            />

            {/* Right Object Tree & Property Inspector */}
            <ObjectListSidebar
              width={rightWidth}
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

          {/* Desktop Bottom Splitter & Code Editor */}
          {isEditorVisible && (
            <>
              {/* Bottom Resizer Splitter */}
              <div
                onMouseDown={(e) => {
                  e.preventDefault();
                  setIsDraggingBottom(true);
                }}
                onDoubleClick={() => setBottomHeight(210)}
                title="드래그하여 높이 조절 (더블 클릭 시 기본값)"
                className={`h-1 cursor-row-resize hover:h-1.5 transition-[height,background-color] hover:bg-blue-500 active:bg-blue-600 bg-slate-200 dark:bg-slate-800 z-10 shrink-0 select-none ${
                  isDraggingBottom ? 'bg-blue-500 h-1.5' : ''
                }`}
              />
              <CodeEditorPanel
                code={code}
                onChangeCode={handleCodeChange}
                selectedLine={selectedLine}
                selectedObjectId={selectedObjectId}
                objects={augmentedObjects}
                definitions={definitions}
                onSelectLine={handleSelectObject}
                compileResult={compileResult}
                height={bottomHeight}
                isExpanded={isEditorExpanded}
                onToggleExpand={() => setIsEditorExpanded(!isEditorExpanded)}
                onCommitHistory={commitCodeHistory}
                onUndo={handleUndo}
                onRedo={handleRedo}
              />
            </>
          )}
        </>
      )}

      {/* Dragging Overlay (prevents pointer swallow and iframe drag issues) */}
      {(isDraggingLeft || isDraggingRight || isDraggingBottom) && (
        <div
          className={`fixed inset-0 z-50 select-none ${
            isDraggingLeft || isDraggingRight ? 'cursor-col-resize' : 'cursor-row-resize'
          }`}
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
