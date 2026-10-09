import React from 'react';
import { 
  ListTree, 
  Trash2, 
  Palette, 
  Tag, 
  Sliders, 
  Layers,
  Square,
  Circle,
  Database,
  Diamond,
  FileText,
  MoveRight,
  Compass,
  Type,
  Footprints,
  BoxSelect,
  Spline,
  ArrowLeftRight,
  Maximize2,
  Crosshair,
  MapPin,
  Plus
} from 'lucide-react';
import { PikchrObject, PikchrObjectProperties, PikchrDefinition, ActiveTargetField, PathSegment } from '../lib/types';
import { useTranslation } from '../lib/i18n';
import { parsePathIntoSegments, buildPathString, extractConnectorPath } from '../lib/pikchr';

interface ObjectListSidebarProps {
  objects: PikchrObject[];
  definitions?: PikchrDefinition[];
  selectedLine: number | null;
  selectedObjectId?: string | null;
  activeTargetField?: ActiveTargetField;
  setActiveTargetField?: (field: ActiveTargetField) => void;
  refInsertion?: { field: ActiveTargetField; value: string; timestamp: number } | null;
  onSelectObject: (lineNumber: number | null, objId?: string) => void;
  onUpdateObject: (
    object: PikchrObject,
    newProperties: Partial<PikchrObjectProperties>,
    newLabel?: string,
    newLabelName?: string
  ) => void;
  onDeleteObject: (lineNumber: number, objId?: string) => void;
}

const ANCHOR_CHIPS = ['.c', '.n', '.ne', '.e', '.se', '.s', '.sw', '.w', '.nw'];

interface PositionInputRowProps {
  label: string;
  field: string;
  value: string;
  placeholder?: string;
  activeTargetField?: ActiveTargetField;
  onCommit: (val: string) => void;
  onSetActiveField?: (field: ActiveTargetField) => void;
  refInsertion?: { field: ActiveTargetField; value: string; timestamp: number } | null;
  quickChips?: string[];
}

const PositionInputRow: React.FC<PositionInputRowProps> = ({
  label,
  field,
  value,
  placeholder,
  activeTargetField,
  onCommit,
  onSetActiveField,
  refInsertion,
  quickChips,
}) => {
  const [localVal, setLocalVal] = React.useState(value);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const isTargetActive = activeTargetField === field;
  const isMountedRef = React.useRef(true);
  const prevValueRef = React.useRef(value);

  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    prevValueRef.current = value;
    setLocalVal(value);
  }, [value]);

  React.useEffect(() => {
    if (refInsertion && refInsertion.field === field) {
      setLocalVal(refInsertion.value);
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  }, [refInsertion, field]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onCommit(localVal);
    } else if (e.key === 'Escape') {
      setLocalVal(value);
      if (isTargetActive && onSetActiveField) {
        onSetActiveField(null);
      }
      e.currentTarget.blur();
    }
  };

  const handleBlur = () => {
    if (isMountedRef.current && localVal.trim() !== (prevValueRef.current || '').trim()) {
      onCommit(localVal);
    }
  };

  const togglePicking = () => {
    if (onSetActiveField) {
      onSetActiveField(isTargetActive ? null : field);
    }
    if (!isTargetActive && inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 flex items-center space-x-1">
          {field === 'with' ? <Compass className="w-3 h-3 text-slate-400" /> : <MapPin className="w-3 h-3 text-slate-400" />}
          <span>{label}</span>
        </label>
        {isTargetActive && (
          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium animate-pulse">
            포인트 선택 중
          </span>
        )}
      </div>
      <div className="flex items-center space-x-1">
        <input
          ref={inputRef}
          type="text"
          value={localVal}
          onChange={(e) => setLocalVal(e.target.value)}
          onFocus={() => onSetActiveField && onSetActiveField(field)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={`flex-1 bg-slate-50 dark:bg-slate-900 border rounded px-2.5 py-1.5 text-xs font-mono transition focus:outline-none ${
            isTargetActive
              ? 'border-blue-500 ring-1 ring-blue-500/40 text-blue-600 dark:text-blue-300 font-semibold'
              : 'border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:border-blue-500'
          }`}
        />
        <button
          type="button"
          onClick={togglePicking}
          title={isTargetActive ? '선택 해제' : '캔버스 포인트 선택'}
          className={`p-1.5 rounded border transition flex items-center justify-center shrink-0 ${
            isTargetActive
              ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
              : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
          }`}
        >
          <Crosshair className="w-3.5 h-3.5" />
        </button>
      </div>
      {quickChips && quickChips.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {quickChips.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => {
                setLocalVal(chip);
                onCommit(chip);
              }}
              className={`px-1.5 py-0.5 text-[10px] font-mono rounded border transition ${
                localVal === chip
                  ? 'bg-blue-600 text-white border-blue-600 font-semibold shadow-2xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {chip}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

interface CommitInputProps {
  value: string;
  onCommit: (val: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>, localVal: string) => void;
  placeholder?: string;
  className?: string;
  type?: string;
  title?: string;
  autoFocus?: boolean;
}

const CommitInput: React.FC<CommitInputProps> = ({
  value: initialValue,
  onCommit,
  onKeyDown,
  placeholder,
  className,
  type = 'text',
  title,
  autoFocus,
}) => {
  const [localVal, setLocalVal] = React.useState(initialValue);
  const isMountedRef = React.useRef(true);
  const prevValueRef = React.useRef(initialValue);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    prevValueRef.current = initialValue;
    setLocalVal(initialValue);
  }, [initialValue]);

  React.useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [autoFocus]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onCommit(localVal);
    } else if (e.key === 'Escape') {
      setLocalVal(initialValue);
      e.currentTarget.blur();
    }
    if (onKeyDown) {
      onKeyDown(e, localVal);
    }
  };

  const handleBlur = () => {
    if (isMountedRef.current && localVal.trim() !== (prevValueRef.current || '').trim()) {
      onCommit(localVal);
    }
  };

  return (
    <input
      ref={inputRef}
      type={type}
      value={localVal}
      onChange={(e) => setLocalVal(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
      title={title}
    />
  );
};

interface ConnectorPathEditorProps {
  selectedObject: PikchrObject;
  activeTargetField?: ActiveTargetField;
  setActiveTargetField?: (field: ActiveTargetField) => void;
  refInsertion?: { field: ActiveTargetField; value: string; timestamp: number } | null;
  onUpdateObject: (
    targetObj: PikchrObject,
    newProps: Partial<PikchrObjectProperties>,
    newLabel?: string,
    newLabelName?: string
  ) => void;
  getDefValue: (name: string) => string | undefined;
}

const ConnectorPathEditor: React.FC<ConnectorPathEditorProps> = ({
  selectedObject,
  activeTargetField,
  setActiveTargetField,
  refInsertion,
  onUpdateObject,
  getDefValue,
}) => {
  const { t } = useTranslation();
  const [showRawPath, setShowRawPath] = React.useState(false);

  // 세그먼트별 사용자가 선택한 활성 모드('length' | 'to' | 'until')를 추적
  const [segmentModes, setSegmentModes] = React.useState<Record<number, 'length' | 'to' | 'until'>>({});
  // 새로 추가된 세그먼트의 거리(length) 입력 필드로 포커스 이동을 위한 상태
  const [focusSegmentIdx, setFocusSegmentIdx] = React.useState<number | null>(null);

  // 선택된 객체가 바뀔 때 모드 캐시 초기화
  React.useEffect(() => {
    setSegmentModes({});
    setFocusSegmentIdx(null);
  }, [selectedObject.id]);

  const rawPath = selectedObject.properties.path || extractConnectorPath(selectedObject.rawStatement || '', selectedObject.type);
  const parsed = React.useMemo(() => {
    return parsePathIntoSegments(rawPath);
  }, [rawPath]);

  const fromVal = selectedObject.properties.from !== undefined ? selectedObject.properties.from : parsed.from;
  const segments: PathSegment[] = selectedObject.properties.pathSegments && selectedObject.properties.pathSegments.length > 0
    ? selectedObject.properties.pathSegments
    : (parsed.segments.length > 0
        ? parsed.segments
        : [{
            direction: (selectedObject.properties.direction || 'right'),
            length: selectedObject.properties.length || '',
            endMode: selectedObject.properties.to ? 'to' : (selectedObject.properties.until ? 'until' : 'none'),
            to: selectedObject.properties.to || '',
            until: selectedObject.properties.until || ''
          }]);

  const handleUpdateFrom = (newFrom: string) => {
    const nextPath = buildPathString({
      from: newFrom,
      segments,
    });
    onUpdateObject(selectedObject, {
      from: newFrom,
      path: nextPath,
      pathSegments: segments,
    });
  };

  const handleUpdateSegment = (idx: number, updates: Partial<PathSegment>) => {
    const nextSegments = segments.map((s, i) => {
      if (i !== idx) return s;
      const updated = { ...s, ...updates };
      if (updates.endMode === 'to' || (updates.to !== undefined && updates.until === undefined)) {
        updated.endMode = 'to';
        updated.until = undefined;
      } else if (updates.endMode === 'until' || (updates.until !== undefined && updates.to === undefined)) {
        updated.endMode = 'until';
        updated.to = undefined;
      } else if (updates.endMode === 'none') {
        updated.endMode = 'none';
        updated.to = undefined;
        updated.until = undefined;
      }
      return updated;
    });

    const nextPath = buildPathString({
      from: fromVal,
      segments: nextSegments,
    });

    const primarySeg = nextSegments[0] || {};
    onUpdateObject(selectedObject, {
      path: nextPath,
      pathSegments: nextSegments,
      direction: primarySeg.direction as any,
      length: primarySeg.length,
      to: primarySeg.endMode === 'to' ? primarySeg.to : undefined,
      until: primarySeg.endMode === 'until' ? primarySeg.until : undefined,
    });
  };

  const handleAddSegment = () => {
    const lastDir = segments.length > 0 ? segments[segments.length - 1].direction : 'right';
    const newIdx = segments.length;
    setSegmentModes(prev => ({ ...prev, [newIdx]: 'length' }));
    setFocusSegmentIdx(newIdx);
    const nextSegments: PathSegment[] = [
      ...segments,
      {
        direction: (lastDir === 'right' ? 'down' : (lastDir === 'down' ? 'right' : 'right')) as any,
        length: '0.5in',
        endMode: 'none',
        to: '',
        until: ''
      }
    ];
    const nextPath = buildPathString({
      from: fromVal,
      segments: nextSegments,
    });
    onUpdateObject(selectedObject, {
      path: nextPath,
      pathSegments: nextSegments,
    });
  };

  const handleRemoveSegment = (idx: number) => {
    if (segments.length <= 1) return;
    setSegmentModes(prev => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
    const nextSegments = segments.filter((_, i) => i !== idx);
    const nextPath = buildPathString({
      from: fromVal,
      segments: nextSegments,
    });
    const primarySeg = nextSegments[0] || {};
    onUpdateObject(selectedObject, {
      path: nextPath,
      pathSegments: nextSegments,
      direction: primarySeg.direction as any,
      length: primarySeg.length,
      to: primarySeg.endMode === 'to' ? primarySeg.to : undefined,
      until: primarySeg.endMode === 'until' ? primarySeg.until : undefined,
    });
  };

  const handleCommitRawPath = (newRawPath: string) => {
    const reParsed = parsePathIntoSegments(newRawPath);
    onUpdateObject(selectedObject, {
      path: newRawPath,
      from: reParsed.from,
      pathSegments: reParsed.segments,
      to: reParsed.segments[0]?.to,
      until: reParsed.segments[0]?.until,
      direction: reParsed.segments[0]?.direction as any,
      length: reParsed.segments[0]?.length,
    });
  };

  return (
    <div className="space-y-2.5">
      {/* 1. Start Point (From) */}
      <div className="space-y-1">
        <PositionInputRow
          label={t.inspector.startPoint}
          field="from"
          value={fromVal || ''}
          placeholder="e.g. 1st box.e"
          activeTargetField={activeTargetField}
          onCommit={handleUpdateFrom}
          onSetActiveField={setActiveTargetField}
          refInsertion={refInsertion}
        />
      </div>

      {/* 2. Path Segments List Header */}
      <div className="flex items-center justify-between pt-1">
        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
          <MoveRight className="w-3.5 h-3.5 text-blue-500" />
          <span>{t.inspector.pathSegments} ({segments.length})</span>
        </label>
        <button
          type="button"
          onClick={() => setShowRawPath(!showRawPath)}
          className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-mono"
        >
          {showRawPath ? 'UI 모드로 보기' : t.inspector.rawPath}
        </button>
      </div>

      {/* Raw Path Direct Editor */}
      {showRawPath && (
        <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
          <span className="text-[10px] font-medium text-slate-500">{t.inspector.rawPath}</span>
          <CommitInput
            value={rawPath}
            onCommit={handleCommitRawPath}
            placeholder="e.g. right 1.5cm then down 1cm"
            className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>
      )}

      {/* 3. Segment Cards */}
      <div className="space-y-2">
        {segments.map((seg, idx) => {
          const activePickerMode =
            activeTargetField === `to_${idx}`
              ? 'to'
              : activeTargetField === `until_${idx}`
              ? 'until'
              : undefined;

          const currentMode: 'length' | 'to' | 'until' =
            activePickerMode !== undefined
              ? activePickerMode
              : segmentModes[idx] !== undefined
              ? segmentModes[idx]
              : (seg.endMode === 'to' || (seg.to && !seg.until)
                  ? 'to'
                  : (seg.endMode === 'until' || seg.until ? 'until' : 'length'));

          const setMode = (mode: 'length' | 'to' | 'until') => {
            setSegmentModes(prev => ({ ...prev, [idx]: mode }));
            if (mode === 'length') {
              handleUpdateSegment(idx, { endMode: 'none', to: undefined, until: undefined, length: seg.length || '0.5in' });
              if (activeTargetField === `to_${idx}` || activeTargetField === `until_${idx}`) {
                setActiveTargetField?.(null);
              }
            } else if (mode === 'to') {
              handleUpdateSegment(idx, { endMode: 'to', until: undefined, length: undefined });
              if (setActiveTargetField) setActiveTargetField(`to_${idx}`);
            } else if (mode === 'until') {
              handleUpdateSegment(idx, { endMode: 'until', to: undefined, length: undefined });
              if (setActiveTargetField) setActiveTargetField(`until_${idx}`);
            }
          };

          return (
            <div
              key={`seg-${idx}`}
              className="p-2.5 rounded-lg bg-white dark:bg-slate-950/70 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-2"
            >
              {/* Card Header: Segment Number & Delete */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-mono">
                    {idx === 0 ? `${t.inspector.segment} 1` : `then ${t.inspector.segment} ${idx + 1}`}
                  </span>
                </div>
                {segments.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveSegment(idx)}
                    title={t.inspector.removeSegment}
                    className="p-1 text-slate-400 hover:text-rose-500 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Direction & Target Mode Selection */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 dark:text-slate-400">{t.inspector.direction}</label>
                  <select
                    value={seg.direction || ''}
                    onChange={(e) => handleUpdateSegment(idx, { direction: e.target.value as any })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">None (방향 없음)</option>
                    <option value="right">Right (오른쪽)</option>
                    <option value="down">Down (아래)</option>
                    <option value="left">Left (왼쪽)</option>
                    <option value="up">Up (위)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 dark:text-slate-400">{t.inspector.segmentMode}</label>
                  <div className="grid grid-cols-3 gap-0.5 p-0.5 bg-slate-100 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setMode('length')}
                      className={`py-0.5 rounded font-medium transition ${currentMode === 'length' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-2xs font-semibold' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                      {t.inspector.modeLength}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('to')}
                      className={`py-0.5 rounded font-medium transition ${currentMode === 'to' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-2xs font-semibold' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                      To
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('until')}
                      className={`py-0.5 rounded font-medium transition ${currentMode === 'until' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-2xs font-semibold' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                      Until
                    </button>
                  </div>
                </div>
              </div>

              {/* Mode-Specific Input: Length vs To vs Until */}
              {currentMode === 'length' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 dark:text-slate-400">{t.inspector.length}</label>
                  <CommitInput
                    value={seg.length || ''}
                    autoFocus={focusSegmentIdx === idx}
                    onCommit={(val) => {
                      handleUpdateSegment(idx, { length: val });
                      if (focusSegmentIdx === idx) setFocusSegmentIdx(null);
                    }}
                    placeholder={getDefValue('linewid') ? `default (${getDefValue('linewid')})` : 'e.g. 1.5cm, 0.5in'}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              )}

              {currentMode === 'to' && (
                <div className="space-y-1">
                  <PositionInputRow
                    label={t.inspector.modeTo}
                    field={`to_${idx}`}
                    value={seg.to || ''}
                    placeholder="e.g. 2nd box.w, Server.e"
                    activeTargetField={activeTargetField}
                    onCommit={(val) => handleUpdateSegment(idx, { to: val, endMode: 'to', until: undefined, length: undefined })}
                    onSetActiveField={setActiveTargetField}
                    refInsertion={refInsertion}
                  />
                </div>
              )}

              {currentMode === 'until' && (
                <div className="space-y-1">
                  <PositionInputRow
                    label={t.inspector.modeUntil}
                    field={`until_${idx}`}
                    value={seg.until || ''}
                    placeholder="e.g. even with 1st box.s"
                    activeTargetField={activeTargetField}
                    onCommit={(val) => handleUpdateSegment(idx, { until: val, endMode: 'until', to: undefined, length: undefined })}
                    onSetActiveField={setActiveTargetField}
                    refInsertion={refInsertion}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 4. Add Segment Button */}
      <button
        type="button"
        onClick={handleAddSegment}
        className="w-full py-1.5 px-3 rounded-lg border border-dashed border-blue-400 dark:border-blue-500/40 bg-blue-50/50 dark:bg-blue-900/15 text-blue-600 dark:text-blue-300 hover:bg-blue-100/70 dark:hover:bg-blue-900/30 text-xs font-semibold flex items-center justify-center space-x-1.5 transition"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>{t.inspector.addSegment}</span>
      </button>
    </div>
  );
};

export const ObjectListSidebar: React.FC<ObjectListSidebarProps> = ({
  objects,
  definitions = [],
  selectedLine,
  selectedObjectId,
  activeTargetField,
  setActiveTargetField,
  refInsertion,
  onSelectObject,
  onUpdateObject,
  onDeleteObject,
}) => {
  const { t } = useTranslation();
  const selectedObject = selectedObjectId
    ? objects.find(obj => obj.id === selectedObjectId)
    : objects.find(obj => {
        const span = obj.rawStatement ? obj.rawStatement.split('\n').length : 1;
        return selectedLine !== null && selectedLine >= obj.lineNumber && selectedLine < obj.lineNumber + span;
      });

  const [arcTargetMode, setArcTargetMode] = React.useState<'to' | 'until' | null>(null);
  const selectedItemRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    setArcTargetMode(null);
  }, [selectedObject?.id]);

  React.useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedObjectId, selectedLine]);

  // Definitions(정의 영역)로부터 전역 프로퍼티 및 변수 기본값 조회
  const getDefValue = (name: string): string | undefined => {
    if (!definitions || definitions.length === 0) return undefined;
    const target = name.toLowerCase();
    const found = [...definitions].reverse().find(d => d.name.toLowerCase() === target);
    return found ? found.value : undefined;
  };

  // Pikchr LABEL 문법 검증: 대문자(A-Z)로 시작하고 영문자/숫자/밑줄만 허용
  const isValidPikchrLabel = (str?: string): boolean => {
    if (!str) return false;
    return /^[A-Z][a-zA-Z0-9_]*$/.test(str.trim());
  };

  const rawLabel = (selectedObject?.label || '').trim();
  const isSuggestable = !!selectedObject && !selectedObject.labelName && isValidPikchrLabel(rawLabel);
  const suggestedLabel = isSuggestable ? rawLabel : '';

  const getShapeIcon = (type: string) => {
    switch (type) {
      case 'box': return <Square className="w-3.5 h-3.5 text-sky-400" />;
      case 'circle': return <Circle className="w-3.5 h-3.5 text-emerald-400" />;
      case 'cylinder': return <Database className="w-3.5 h-3.5 text-pink-400" />;
      case 'diamond': return <Diamond className="w-3.5 h-3.5 text-amber-400" />;
      case 'oval': return <Circle className="w-3.5 h-3.5 text-purple-400" />;
      case 'ellipse': return <Circle className="w-3.5 h-3.5 text-indigo-400" />;
      case 'file': return <FileText className="w-3.5 h-3.5 text-slate-300" />;
      case 'arrow': return <MoveRight className="w-3.5 h-3.5 text-indigo-400" />;
      case 'line': return <MoveRight className="w-3.5 h-3.5 text-cyan-400" />;
      case 'arc': return <Compass className="w-3.5 h-3.5 text-teal-400" />;
      case 'spline': return <Spline className="w-3.5 h-3.5 text-violet-400" />;
      case 'dot': return <Tag className="w-3.5 h-3.5 text-orange-400" />;
      case 'text': return <Type className="w-3.5 h-3.5 text-purple-400" />;
      case 'direction': return <Compass className="w-3.5 h-3.5 text-amber-400" />;
      case 'move': return <Footprints className="w-3.5 h-3.5 text-slate-400" />;
      case 'block': return <BoxSelect className="w-3.5 h-3.5 text-yellow-400" />;
      default: return <Layers className="w-3.5 h-3.5 text-blue-400" />;
    }
  };

  const isDirection = selectedObject?.type === 'direction';
  const isConnectorOrPath = ['arrow', 'line', 'spline'].includes(selectedObject?.type || '');
  const isArc = selectedObject?.type === 'arc';
  const isText = selectedObject?.type === 'text';
  const isMove = selectedObject?.type === 'move';
  const isCircleOrDot = ['circle', 'dot'].includes(selectedObject?.type || '');
  const isCylinder = selectedObject?.type === 'cylinder';
  const isBoxLike = ['box', 'diamond', 'oval', 'ellipse', 'file', 'block'].includes(selectedObject?.type || '');

  return (
    <aside className="w-84 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shrink-0 select-none overflow-hidden text-slate-700 dark:text-slate-200 transition-colors">
      {/* 1. Object List Header */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
        <div className="flex items-center space-x-2">
          <ListTree className="w-4 h-4 text-blue-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-300">
            {t.inspector.statementsTitle} ({objects.length})
          </span>
        </div>
        <span className="px-1.5 py-0.5 text-[11px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 rounded-full font-mono">
          {objects.length} {t.common.items}
        </span>
      </div>

      {/* 2. Object Tree View */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 max-h-[38vh]">
        {objects.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 space-y-1">
            <Layers className="w-6 h-6 mx-auto text-slate-400" />
            <p>{t.inspector.noSelection}</p>
          </div>
        ) : (
          objects.map((obj) => {
            const isSelected = selectedObjectId
              ? obj.id === selectedObjectId
              : selectedLine === obj.lineNumber;
            return (
              <div
                key={`${obj.id}-${obj.lineNumber}`}
                ref={isSelected ? selectedItemRef : undefined}
                onClick={() => onSelectObject(obj.lineNumber, obj.id)}
                className={`group px-3 py-2 rounded-lg border cursor-pointer transition flex items-center justify-between ${
                  isSelected
                    ? 'bg-blue-50 dark:bg-blue-600/15 border-blue-400 dark:border-blue-500/50 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200/80 dark:border-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="p-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                    {getShapeIcon(obj.type)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center space-x-1.5">
                      <span className={`text-xs font-semibold truncate ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-800 dark:text-slate-200'}`}>
                        {obj.name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">L{obj.lineNumber}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono">{obj.rawStatement.trim()}</p>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteObject(obj.lineNumber, obj.id);
                  }}
                  title={t.common.delete}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-500 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* 3. Object-Specific Property Inspector Panel */}
      <div className="border-t border-slate-200 dark:border-slate-800 p-3 bg-slate-50/50 dark:bg-slate-950/60 flex flex-col flex-1 overflow-y-auto">
        <div className="flex items-center space-x-2 mb-2.5">
          <Sliders className="w-4 h-4 text-blue-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-300">{t.inspector.title}</span>
        </div>

        {selectedObject ? (
          <div key={selectedObject.id || `line-${selectedObject.lineNumber}`} className="space-y-3 text-xs">
            {/* Header info badge */}
            <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-2xs">
              <div className="flex items-center space-x-2">
                {getShapeIcon(selectedObject.type)}
                <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">{selectedObject.type}</span>
              </div>
              <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400">{t.inspector.line} {selectedObject.lineNumber}</span>
            </div>

            {/* Top-Level: Object Label (Identifier) Input (Direction does not support label) */}
            {!isDirection && (
              <div className="space-y-1.5 p-2.5 rounded-lg bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 shadow-2xs">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                    <Tag className="w-3 h-3 text-blue-500" />
                    <span>{t.inspector.labelName}</span>
                  </label>
                  {isSuggestable && (
                    <button
                      type="button"
                      onClick={() => onUpdateObject(selectedObject, {}, undefined, suggestedLabel)}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-300 border border-blue-500/30 hover:bg-blue-500/20 transition flex items-center space-x-1"
                      title="입력 텍스트를 레이블로 적용"
                    >
                      <span>제안: {suggestedLabel}</span>
                    </button>
                  )}
                </div>

                <div className="relative">
                  <CommitInput
                    value={selectedObject.labelName || ''}
                    onCommit={(val) => onUpdateObject(selectedObject, {}, undefined, val)}
                    onKeyDown={(e, localVal) => {
                      // 빈 상태에서 Tab 또는 Enter 시 제안된 레이블 자동 채우기
                      if ((e.key === 'Tab' || e.key === 'Enter') && !localVal && suggestedLabel) {
                        e.preventDefault();
                        onUpdateObject(selectedObject, {}, undefined, suggestedLabel);
                      }
                    }}
                    placeholder={suggestedLabel ? suggestedLabel : t.inspector.labelNamePlaceholder}
                    className={`w-full bg-slate-50 dark:bg-slate-900 border rounded px-2.5 py-1.5 text-xs font-mono transition focus:outline-none ${
                      selectedObject.labelName
                        ? 'text-blue-600 dark:text-blue-300 border-blue-500/60 font-semibold'
                        : isSuggestable
                        ? 'text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700 placeholder:text-blue-600/40 dark:placeholder:text-blue-300/40 placeholder:font-medium'
                        : 'text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800 placeholder:text-slate-400'
                    }`}
                  />
                </div>
                <p className="text-[10px] text-slate-400">{t.inspector.labelNameHint}</p>
              </div>
            )}

            {/* --- CASE A: TEXT OBJECT --- */}
            {isText && (
              <>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 flex items-center space-x-1">
                    <Tag className="w-3 h-3 text-slate-400" />
                    <span>{t.inspector.labelText}</span>
                  </label>
                  <CommitInput
                    value={selectedObject.label || ''}
                    onCommit={(val) => onUpdateObject(selectedObject, {}, val)}
                    placeholder="Text content"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>

                {/* Relative Positioning: With & At */}
                <div className="space-y-2">
                  <PositionInputRow
                    label={t.inspector.with}
                    field="with"
                    value={selectedObject.properties.with || selectedObject.properties.withAnchor || ''}
                    placeholder="e.g. .sw or .c"
                    activeTargetField={activeTargetField}
                    onCommit={(val) => onUpdateObject(selectedObject, { with: val, withAnchor: val })}
                    onSetActiveField={setActiveTargetField}
                    refInsertion={refInsertion}
                    quickChips={ANCHOR_CHIPS}
                  />
                  <PositionInputRow
                    label={t.inspector.at}
                    field="at"
                    value={selectedObject.properties.at || ''}
                    placeholder="e.g. Box1.e + (0.1, 0)"
                    activeTargetField={activeTargetField}
                    onCommit={(val) => onUpdateObject(selectedObject, { at: val })}
                    onSetActiveField={setActiveTargetField}
                    refInsertion={refInsertion}
                  />
                </div>

                {/* Size & Style */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{t.inspector.textSize}</label>
                    <select
                      value={selectedObject.properties.textSize || 'normal'}
                      onChange={(e) => onUpdateObject(selectedObject, { textSize: e.target.value as any })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value="normal">Normal</option>
                      <option value="big">Big (큼)</option>
                      <option value="small">Small (작음)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{t.inspector.textStyle}</label>
                    <select
                      value={selectedObject.properties.textStyle || ''}
                      onChange={(e) => onUpdateObject(selectedObject, { textStyle: (e.target.value || undefined) as any })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value="">Normal</option>
                      <option value="bold">Bold (굵게)</option>
                      <option value="italic">Italic (기울임)</option>
                      <option value="mono">Monospace (고정폭)</option>
                    </select>
                  </div>
                </div>

                {/* Position & Alignment */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{t.inspector.textPosition}</label>
                    <select
                      value={selectedObject.properties.textPosition || 'center'}
                      onChange={(e) => onUpdateObject(selectedObject, { textPosition: e.target.value as any })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value="center">Center (중앙)</option>
                      <option value="above">Above (위)</option>
                      <option value="below">Below (아래)</option>
                      <option value="aligned">Aligned (정렬)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{t.inspector.textAlign}</label>
                    <select
                      value={selectedObject.properties.textAlign || 'center'}
                      onChange={(e) => onUpdateObject(selectedObject, { textAlign: e.target.value as any })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value="center">Center (중앙)</option>
                      <option value="ljust">Ljust (왼쪽)</option>
                      <option value="rjust">Rjust (오른쪽)</option>
                    </select>
                  </div>
                </div>

                {/* Color */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 flex items-center space-x-1">
                    <Palette className="w-3 h-3 text-slate-400" />
                    <span>{t.inspector.color}</span>
                  </label>
                  <CommitInput
                    value={selectedObject.properties.color || ''}
                    onCommit={(val) => onUpdateObject(selectedObject, { color: val })}
                    placeholder={getDefValue('color') ? `default (${getDefValue('color')})` : 'black / #3b82f6'}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </>
            )}

            {/* --- CASE B: ARROW / LINE / SPLINE --- */}
            {isConnectorOrPath && (
              <>
                {/* Label Text */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{t.inspector.labelText}</label>
                  <CommitInput
                    value={selectedObject.label || ''}
                    onCommit={(val) => onUpdateObject(selectedObject, {}, val)}
                    placeholder="e.g. Request"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Text Position & Alignment */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{t.inspector.textPosition}</label>
                    <select
                      value={selectedObject.properties.textPosition || 'center'}
                      onChange={(e) => onUpdateObject(selectedObject, { textPosition: e.target.value as any })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value="center">Center (기본/중앙)</option>
                      <option value="above">Above (위)</option>
                      <option value="below">Below (아래)</option>
                      <option value="aligned">Aligned (정렬)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{t.inspector.textAlign}</label>
                    <select
                      value={selectedObject.properties.textAlign || 'center'}
                      onChange={(e) => onUpdateObject(selectedObject, { textAlign: e.target.value as any })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value="center">Center (중앙)</option>
                      <option value="ljust">Ljust (왼쪽)</option>
                      <option value="rjust">Rjust (오른쪽)</option>
                    </select>
                  </div>
                </div>

                {/* Arrowhead & Color */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{t.inspector.arrowHead}</label>
                    <select
                      value={selectedObject.properties.arrowHead || (selectedObject.type === 'arrow' ? '->' : 'none')}
                      onChange={(e) => onUpdateObject(selectedObject, { arrowHead: e.target.value as any })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value="->">-&gt; (오른쪽/끝)</option>
                      <option value="<-">&lt;- (왼쪽/시작)</option>
                      <option value="<->">&lt;-&gt; (양방향)</option>
                      <option value="none">None (선만)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{t.inspector.color}</label>
                    <CommitInput
                      value={selectedObject.properties.color || ''}
                      onCommit={(val) => onUpdateObject(selectedObject, { color: val })}
                      placeholder={getDefValue('color') ? `default (${getDefValue('color')})` : 'default (black)'}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>

                {/* Multi-segment Connector Path Editor */}
                <ConnectorPathEditor
                  selectedObject={selectedObject}
                  activeTargetField={activeTargetField}
                  setActiveTargetField={setActiveTargetField}
                  refInsertion={refInsertion}
                  onUpdateObject={onUpdateObject}
                  getDefValue={getDefValue}
                />

                {/* Toggles: Thick, Dashed, Chop */}
                <div className="pt-1 grid grid-cols-3 gap-1 text-slate-700 dark:text-slate-300 text-[11px]">
                  <label className="flex items-center space-x-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedObject.properties.thickness === 'thick'}
                      onChange={(e) => onUpdateObject(selectedObject, { thickness: e.target.checked ? 'thick' : undefined })}
                      className="rounded bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-blue-600 focus:ring-0"
                    />
                    <span>{t.inspector.thick}</span>
                  </label>
                  <label className="flex items-center space-x-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedObject.properties.dash === 'dashed'}
                      onChange={(e) => onUpdateObject(selectedObject, { dash: e.target.checked ? 'dashed' : undefined })}
                      className="rounded bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-blue-600 focus:ring-0"
                    />
                    <span>Dashed</span>
                  </label>
                  <label className="flex items-center space-x-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!selectedObject.properties.chop}
                      onChange={(e) => onUpdateObject(selectedObject, { chop: e.target.checked })}
                      className="rounded bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-blue-600 focus:ring-0"
                    />
                    <span>{t.inspector.chop}</span>
                  </label>
                </div>
              </>
            )}

            {/* --- CASE C: ARC OBJECT --- */}
            {isArc && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{t.inspector.arcDir}</label>
                    <select
                      value={selectedObject.properties.arcDir || 'cw'}
                      onChange={(e) => onUpdateObject(selectedObject, { arcDir: e.target.value as any })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value="cw">CW (시계방향)</option>
                      <option value="ccw">CCW (반시계방향)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{t.inspector.arrowHead}</label>
                    <select
                      value={selectedObject.properties.arrowHead || 'none'}
                      onChange={(e) => onUpdateObject(selectedObject, { arrowHead: e.target.value as any })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value="none">None (선만)</option>
                      <option value="->">-&gt; (화살표)</option>
                      <option value="<-">&lt;- (역방향)</option>
                      <option value="<->">&lt;-&gt; (양방향)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{t.inspector.radius}</label>
                    <CommitInput
                      value={selectedObject.properties.radius || ''}
                      onCommit={(val) => onUpdateObject(selectedObject, { radius: val })}
                      placeholder={getDefValue('linerad') ? `default (${getDefValue('linerad')})` : (getDefValue('lineht') ? `default (${getDefValue('lineht')})` : 'default (0.5in)')}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{t.inspector.color}</label>
                    <CommitInput
                      value={selectedObject.properties.color || ''}
                      onCommit={(val) => onUpdateObject(selectedObject, { color: val })}
                      placeholder={getDefValue('color') ? `default (${getDefValue('color')})` : 'default (black)'}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>

                {/* Endpoints & Positioning: From, and To / Until mutually exclusive */}
                <div className="space-y-2">
                  <PositionInputRow
                    label={t.inspector.from}
                    field="from"
                    value={selectedObject.properties.from || ''}
                    placeholder="Box1.ne"
                    activeTargetField={activeTargetField}
                    onCommit={(val) => onUpdateObject(selectedObject, { from: val })}
                    onSetActiveField={setActiveTargetField}
                    refInsertion={refInsertion}
                  />

                  <div className="space-y-1">
                    {(() => {
                      const isArcUntil =
                        activeTargetField === 'until'
                          ? true
                          : activeTargetField === 'to'
                          ? false
                          : arcTargetMode !== null
                          ? arcTargetMode === 'until'
                          : !!(selectedObject.properties.until && !selectedObject.properties.to);

                      return (
                        <>
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                              {isArcUntil ? 'Until' : 'To'}
                            </label>
                            <div className="flex items-center space-x-1 text-[10px]">
                              <button
                                type="button"
                                onClick={() => {
                                  setArcTargetMode('to');
                                  if (selectedObject.properties.until) {
                                    onUpdateObject(selectedObject, { until: undefined });
                                  }
                                  if (setActiveTargetField) setActiveTargetField('to');
                                }}
                                className={`px-1.5 py-0.5 rounded font-medium transition ${!isArcUntil ? 'bg-blue-600 text-white font-semibold' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                              >
                                To
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setArcTargetMode('until');
                                  if (selectedObject.properties.to) {
                                    onUpdateObject(selectedObject, { to: undefined });
                                  }
                                  if (setActiveTargetField) setActiveTargetField('until');
                                }}
                                className={`px-1.5 py-0.5 rounded font-medium transition ${isArcUntil ? 'bg-blue-600 text-white font-semibold' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                              >
                                Until
                              </button>
                            </div>
                          </div>
                          {isArcUntil ? (
                            <PositionInputRow
                              label={t.inspector.until}
                              field="until"
                              value={selectedObject.properties.until || ''}
                              placeholder="e.g. even with 1st box.s"
                              activeTargetField={activeTargetField}
                              onCommit={(val) => onUpdateObject(selectedObject, { until: val, to: undefined })}
                              onSetActiveField={setActiveTargetField}
                              refInsertion={refInsertion}
                            />
                          ) : (
                            <PositionInputRow
                              label={t.inspector.to}
                              field="to"
                              value={selectedObject.properties.to || ''}
                              placeholder="Box1.se"
                              activeTargetField={activeTargetField}
                              onCommit={(val) => onUpdateObject(selectedObject, { to: val, until: undefined })}
                              onSetActiveField={setActiveTargetField}
                              refInsertion={refInsertion}
                            />
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </>
            )}

            {/* --- CASE D: CIRCLE / DOT OBJECT --- */}
            {isCircleOrDot && (
              <>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{t.inspector.labelText}</label>
                  <CommitInput
                    value={selectedObject.label || ''}
                    onCommit={(val) => onUpdateObject(selectedObject, {}, val)}
                    placeholder={t.inspector.labelPlaceholder}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Relative Positioning: With & At */}
                <div className="space-y-2">
                  <PositionInputRow
                    label={t.inspector.with}
                    field="with"
                    value={selectedObject.properties.with || selectedObject.properties.withAnchor || ''}
                    placeholder="e.g. .sw or .c"
                    activeTargetField={activeTargetField}
                    onCommit={(val) => onUpdateObject(selectedObject, { with: val, withAnchor: val })}
                    onSetActiveField={setActiveTargetField}
                    refInsertion={refInsertion}
                    quickChips={ANCHOR_CHIPS}
                  />
                  <PositionInputRow
                    label={t.inspector.at}
                    field="at"
                    value={selectedObject.properties.at || ''}
                    placeholder="e.g. 1st box.e + 0.5in"
                    activeTargetField={activeTargetField}
                    onCommit={(val) => onUpdateObject(selectedObject, { at: val })}
                    onSetActiveField={setActiveTargetField}
                    refInsertion={refInsertion}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{t.inspector.textPosition}</label>
                    <select
                      value={selectedObject.properties.textPosition || 'center'}
                      onChange={(e) => onUpdateObject(selectedObject, { textPosition: e.target.value as any })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value="center">Center (중앙)</option>
                      <option value="above">Above (위)</option>
                      <option value="below">Below (아래)</option>
                      <option value="aligned">Aligned (정렬)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{t.inspector.textAlign}</label>
                    <select
                      value={selectedObject.properties.textAlign || 'center'}
                      onChange={(e) => onUpdateObject(selectedObject, { textAlign: e.target.value as any })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value="center">Center (중앙)</option>
                      <option value="ljust">Ljust (왼쪽)</option>
                      <option value="rjust">Rjust (오른쪽)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{t.inspector.radius}</label>
                    <CommitInput
                      value={selectedObject.properties.radius || ''}
                      onCommit={(val) => onUpdateObject(selectedObject, { radius: val })}
                      placeholder={
                        selectedObject.type === 'dot'
                          ? (getDefValue('dotrad') ? `default (${getDefValue('dotrad')})` : 'default (0.05in)')
                          : (getDefValue('circlerad') || getDefValue('circlrad') ? `default (${getDefValue('circlerad') || getDefValue('circlrad')})` : 'default (0.375in)')
                      }
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{t.inspector.diameter}</label>
                    <CommitInput
                      value={selectedObject.properties.diameter || ''}
                      onCommit={(val) => onUpdateObject(selectedObject, { diameter: val })}
                      placeholder={getDefValue('circlerad') || getDefValue('circlrad') ? `default (${getDefValue('circlerad') || getDefValue('circlrad')} diam)` : 'default (0.75in)'}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{t.inspector.fill}</label>
                    <CommitInput
                      value={selectedObject.properties.fill || ''}
                      onCommit={(val) => onUpdateObject(selectedObject, { fill: val })}
                      placeholder={getDefValue('fill') ? `default (${getDefValue('fill')})` : 'none (투명)'}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{t.inspector.color}</label>
                    <CommitInput
                      value={selectedObject.properties.color || ''}
                      onCommit={(val) => onUpdateObject(selectedObject, { color: val })}
                      placeholder={getDefValue('color') ? `default (${getDefValue('color')})` : 'default (black)'}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>

                <div className="pt-1 flex items-center space-x-3 text-slate-700 dark:text-slate-300 text-[11px]">
                  <label className="flex items-center space-x-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedObject.properties.thickness === 'thick'}
                      onChange={(e) => onUpdateObject(selectedObject, { thickness: e.target.checked ? 'thick' : undefined })}
                      className="rounded bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-blue-600 focus:ring-0"
                    />
                    <span>{t.inspector.thick}</span>
                  </label>
                  <label className="flex items-center space-x-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedObject.properties.dash === 'dashed'}
                      onChange={(e) => onUpdateObject(selectedObject, { dash: e.target.checked ? 'dashed' : undefined })}
                      className="rounded bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-blue-600 focus:ring-0"
                    />
                    <span>Dashed</span>
                  </label>
                </div>
              </>
            )}

            {/* --- CASE E: CYLINDER OBJECT --- */}
            {isCylinder && (
              <>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{t.inspector.labelText}</label>
                  <CommitInput
                    value={selectedObject.label || ''}
                    onCommit={(val) => onUpdateObject(selectedObject, {}, val)}
                    placeholder="Database"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Relative Positioning: With & At */}
                <div className="space-y-2">
                  <PositionInputRow
                    label={t.inspector.with}
                    field="with"
                    value={selectedObject.properties.with || selectedObject.properties.withAnchor || ''}
                    placeholder="e.g. .sw or .c"
                    activeTargetField={activeTargetField}
                    onCommit={(val) => onUpdateObject(selectedObject, { with: val, withAnchor: val })}
                    onSetActiveField={setActiveTargetField}
                    refInsertion={refInsertion}
                    quickChips={ANCHOR_CHIPS}
                  />
                  <PositionInputRow
                    label={t.inspector.at}
                    field="at"
                    value={selectedObject.properties.at || ''}
                    placeholder="e.g. Server.s + 0.3in"
                    activeTargetField={activeTargetField}
                    onCommit={(val) => onUpdateObject(selectedObject, { at: val })}
                    onSetActiveField={setActiveTargetField}
                    refInsertion={refInsertion}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{t.inspector.textPosition}</label>
                    <select
                      value={selectedObject.properties.textPosition || 'center'}
                      onChange={(e) => onUpdateObject(selectedObject, { textPosition: e.target.value as any })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value="center">Center (중앙)</option>
                      <option value="above">Above (위)</option>
                      <option value="below">Below (아래)</option>
                      <option value="aligned">Aligned (정렬)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{t.inspector.textAlign}</label>
                    <select
                      value={selectedObject.properties.textAlign || 'center'}
                      onChange={(e) => onUpdateObject(selectedObject, { textAlign: e.target.value as any })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value="center">Center (중앙)</option>
                      <option value="ljust">Ljust (왼쪽)</option>
                      <option value="rjust">Rjust (오른쪽)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{t.inspector.width}</label>
                    <CommitInput
                      value={selectedObject.properties.width || ''}
                      onCommit={(val) => onUpdateObject(selectedObject, { width: val })}
                      placeholder={getDefValue('cylwid') || getDefValue('cylinderwid') ? `default (${getDefValue('cylwid') || getDefValue('cylinderwid')})` : 'default (0.75in)'}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{t.inspector.height}</label>
                    <CommitInput
                      value={selectedObject.properties.height || ''}
                      onCommit={(val) => onUpdateObject(selectedObject, { height: val })}
                      placeholder={getDefValue('cylht') || getDefValue('cylinderht') ? `default (${getDefValue('cylht') || getDefValue('cylinderht')})` : 'default (0.5in)'}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{t.inspector.radius}</label>
                    <CommitInput
                      value={selectedObject.properties.radius || ''}
                      onCommit={(val) => onUpdateObject(selectedObject, { radius: val })}
                      placeholder="default (0.1in)"
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{t.inspector.fill}</label>
                    <CommitInput
                      value={selectedObject.properties.fill || ''}
                      onCommit={(val) => onUpdateObject(selectedObject, { fill: val })}
                      placeholder={getDefValue('fill') ? `default (${getDefValue('fill')})` : 'none (투명)'}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{t.inspector.color}</label>
                    <CommitInput
                      value={selectedObject.properties.color || ''}
                      onCommit={(val) => onUpdateObject(selectedObject, { color: val })}
                      placeholder={getDefValue('color') ? `default (${getDefValue('color')})` : 'default (black)'}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>

                <div className="pt-1 flex items-center space-x-3 text-slate-700 dark:text-slate-300 text-[11px]">
                  <label className="flex items-center space-x-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!selectedObject.properties.fit}
                      onChange={(e) => onUpdateObject(selectedObject, { fit: e.target.checked })}
                      className="rounded bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-blue-600 focus:ring-0"
                    />
                    <span>{t.inspector.fit}</span>
                  </label>
                  <label className="flex items-center space-x-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedObject.properties.thickness === 'thick'}
                      onChange={(e) => onUpdateObject(selectedObject, { thickness: e.target.checked ? 'thick' : undefined })}
                      className="rounded bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-blue-600 focus:ring-0"
                    />
                    <span>{t.inspector.thick}</span>
                  </label>
                </div>
              </>
            )}

            {/* --- CASE F: BOX / DIAMOND / OVAL / ELLIPSE / FILE / BLOCK --- */}
            {isBoxLike && (
              <>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{t.inspector.labelText}</label>
                  <CommitInput
                    value={selectedObject.label || ''}
                    onCommit={(val) => onUpdateObject(selectedObject, {}, val)}
                    placeholder={t.inspector.labelPlaceholder}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Relative Positioning: With & At */}
                <div className="space-y-2">
                  <PositionInputRow
                    label={t.inspector.with}
                    field="with"
                    value={selectedObject.properties.with || selectedObject.properties.withAnchor || ''}
                    placeholder="e.g. .sw or .c"
                    activeTargetField={activeTargetField}
                    onCommit={(val) => onUpdateObject(selectedObject, { with: val, withAnchor: val })}
                    onSetActiveField={setActiveTargetField}
                    refInsertion={refInsertion}
                    quickChips={ANCHOR_CHIPS}
                  />
                  <PositionInputRow
                    label={t.inspector.at}
                    field="at"
                    value={selectedObject.properties.at || ''}
                    placeholder="e.g. 1st box.e + 0.2in"
                    activeTargetField={activeTargetField}
                    onCommit={(val) => onUpdateObject(selectedObject, { at: val })}
                    onSetActiveField={setActiveTargetField}
                    refInsertion={refInsertion}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{t.inspector.textPosition}</label>
                    <select
                      value={selectedObject.properties.textPosition || 'center'}
                      onChange={(e) => onUpdateObject(selectedObject, { textPosition: e.target.value as any })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value="center">Center (중앙)</option>
                      <option value="above">Above (위)</option>
                      <option value="below">Below (아래)</option>
                      <option value="aligned">Aligned (정렬)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{t.inspector.textAlign}</label>
                    <select
                      value={selectedObject.properties.textAlign || 'center'}
                      onChange={(e) => onUpdateObject(selectedObject, { textAlign: e.target.value as any })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value="center">Center (중앙)</option>
                      <option value="ljust">Ljust (왼쪽)</option>
                      <option value="rjust">Rjust (오른쪽)</option>
                    </select>
                  </div>
                </div>

                {/* Width & Height */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{t.inspector.width}</label>
                    <CommitInput
                      value={selectedObject.properties.width || ''}
                      onCommit={(val) => onUpdateObject(selectedObject, { width: val })}
                      placeholder={
                        selectedObject.type === 'file'
                          ? (getDefValue('filewid') ? `default (${getDefValue('filewid')})` : 'default (0.75in)')
                          : ['oval', 'ellipse'].includes(selectedObject.type)
                          ? (getDefValue('ovalwid') ? `default (${getDefValue('ovalwid')})` : 'default (0.75in)')
                          : (getDefValue('boxwid') ? `default (${getDefValue('boxwid')})` : 'default (0.75in)')
                      }
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{t.inspector.height}</label>
                    <CommitInput
                      value={selectedObject.properties.height || ''}
                      onCommit={(val) => onUpdateObject(selectedObject, { height: val })}
                      placeholder={
                        selectedObject.type === 'file'
                          ? (getDefValue('fileht') ? `default (${getDefValue('fileht')})` : 'default (0.5in)')
                          : ['oval', 'ellipse'].includes(selectedObject.type)
                          ? (getDefValue('ovalht') ? `default (${getDefValue('ovalht')})` : 'default (0.5in)')
                          : (getDefValue('boxht') ? `default (${getDefValue('boxht')})` : 'default (0.5in)')
                      }
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>

                {/* Fill & Color */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{t.inspector.fill}</label>
                    <CommitInput
                      value={selectedObject.properties.fill || ''}
                      onCommit={(val) => onUpdateObject(selectedObject, { fill: val })}
                      placeholder={getDefValue('fill') ? `default (${getDefValue('fill')})` : 'none (투명)'}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{t.inspector.color}</label>
                    <CommitInput
                      value={selectedObject.properties.color || ''}
                      onCommit={(val) => onUpdateObject(selectedObject, { color: val })}
                      placeholder={getDefValue('color') ? `default (${getDefValue('color')})` : 'default (black)'}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>

                {/* Box / File Corner Radius */}
                {selectedObject.type === 'box' && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{t.inspector.radius}</label>
                    <CommitInput
                      value={selectedObject.properties.radius || ''}
                      onCommit={(val) => onUpdateObject(selectedObject, { radius: val })}
                      placeholder={getDefValue('boxrad') ? `default (${getDefValue('boxrad')})` : 'default (0) / e.g. 0.08in'}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                )}
                {selectedObject.type === 'file' && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{t.inspector.radius}</label>
                    <CommitInput
                      value={selectedObject.properties.radius || ''}
                      onCommit={(val) => onUpdateObject(selectedObject, { radius: val })}
                      placeholder={getDefValue('filerand') ? `default (${getDefValue('filerand')})` : 'default (0.1in)'}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                )}

                {/* Toggles: Fit, Thick, Dashed, Invis */}
                <div className="pt-1 grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300 text-[11px]">
                  <label className="flex items-center space-x-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!selectedObject.properties.fit}
                      onChange={(e) => onUpdateObject(selectedObject, { fit: e.target.checked })}
                      className="rounded bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-blue-600 focus:ring-0"
                    />
                    <span>{t.inspector.fit}</span>
                  </label>
                  <label className="flex items-center space-x-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedObject.properties.thickness === 'thick'}
                      onChange={(e) => onUpdateObject(selectedObject, { thickness: e.target.checked ? 'thick' : undefined })}
                      className="rounded bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-blue-600 focus:ring-0"
                    />
                    <span>{t.inspector.thick}</span>
                  </label>
                  <label className="flex items-center space-x-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedObject.properties.dash === 'dashed'}
                      onChange={(e) => onUpdateObject(selectedObject, { dash: e.target.checked ? 'dashed' : undefined })}
                      className="rounded bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-blue-600 focus:ring-0"
                    />
                    <span>Dashed</span>
                  </label>
                  <label className="flex items-center space-x-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!selectedObject.properties.invis}
                      onChange={(e) => onUpdateObject(selectedObject, { invis: e.target.checked })}
                      className="rounded bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-blue-600 focus:ring-0"
                    />
                    <span>{t.inspector.invisible}</span>
                  </label>
                </div>
              </>
            )}

            {/* --- CASE G: MOVE OBJECT --- */}
            {isMove && (
              <>
                <ConnectorPathEditor
                  selectedObject={selectedObject}
                  activeTargetField={activeTargetField}
                  setActiveTargetField={setActiveTargetField}
                  refInsertion={refInsertion}
                  onUpdateObject={onUpdateObject}
                  getDefValue={getDefValue}
                />
              </>
            )}

            {/* --- CASE H: DIRECTION STATEMENT --- */}
            {isDirection && (
              <>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{t.inspector.direction}</label>
                  <select
                    value={selectedObject.properties.direction || (selectedObject.rawStatement.trim().split(/\s+/)[0].toLowerCase() as any) || 'right'}
                    onChange={(e) => onUpdateObject(selectedObject, { direction: e.target.value as any })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="right">Right (오른쪽)</option>
                    <option value="down">Down (아래)</option>
                    <option value="left">Left (왼쪽)</option>
                    <option value="up">Up (위)</option>
                  </select>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="py-10 text-center text-xs text-slate-400 space-y-1">
            <Sliders className="w-6 h-6 mx-auto text-slate-400" />
            <p>{t.inspector.noSelection}</p>
            <p className="text-[11px]">{t.inspector.noSelectionSub}</p>
          </div>
        )}
      </div>
    </aside>
  );
};
