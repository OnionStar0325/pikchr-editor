import React, { useRef, useState, useEffect, useCallback } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  Hand, 
  AlertTriangle,
  MousePointer,
  FileText,
  Moon,
  Grid,
  Crosshair
} from 'lucide-react';
import { CompileResult, PikchrObject, ActiveTargetField } from '../lib/types';
import { getObjectReference } from '../lib/pikchr';
import { useTranslation } from '../lib/i18n';
import { useTheme, CanvasBackground } from '../lib/theme';

interface CenterStageProps {
  compileResult: CompileResult;
  objects?: PikchrObject[];
  selectedLine: number | null;
  selectedObjectId?: string | null;
  activeTargetField?: ActiveTargetField;
  onSelectLine: (lineNumber: number | null, objId?: string) => void;
  onSelectAnchor?: (refString: string, anchorName?: string) => void;
}

export const CenterStage: React.FC<CenterStageProps> = ({
  compileResult,
  objects = [],
  selectedLine,
  selectedObjectId,
  activeTargetField,
  onSelectLine,
  onSelectAnchor,
}) => {
  const { t } = useTranslation();
  const { canvasBg, setCanvasBg, theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [panMode, setPanMode] = useState(false);

  // SVG 요소 선택 및 앵커 포인트 오버레이 인터랙션 관리
  useEffect(() => {
    if (!svgContainerRef.current) return;
    const container = svgContainerRef.current;
    const svgEl = container.querySelector('svg');
    if (!svgEl) return;

    const elements = container.querySelectorAll('[data-pikchr-target="true"]');
    elements.forEach((el) => {
      const line = el.getAttribute('data-line-number');
      const objId = el.getAttribute('data-obj-id');
      const isSelected = selectedObjectId
        ? objId === selectedObjectId
        : selectedLine !== null && line === String(selectedLine);

      if (isSelected) {
        el.classList.add('pikchr-selected');
      } else {
        el.classList.remove('pikchr-selected');
      }
    });

    const removeOverlay = () => {
      const existingOverlay = svgEl.querySelector('#pikchr-anchor-overlay');
      if (existingOverlay) {
        existingOverlay.remove();
      }
    };

    const renderAnchorOverlay = (targetEl: Element) => {
      removeOverlay();
      if (!selectedLine && !selectedObjectId) return;
      if (!activeTargetField) return;

      const objId = targetEl.getAttribute('data-obj-id');
      const lineStr = targetEl.getAttribute('data-line-number');
      const targetObj = objects.find(o => {
        if (objId) return o.id === objId;
        if (lineStr) {
          const l = parseInt(lineStr, 10);
          const span = o.rawStatement ? o.rawStatement.split('\n').length : 1;
          return l >= o.lineNumber && l < o.lineNumber + span;
        }
        return false;
      });
      if (!targetObj) return;

      // 텍스트 객체, move, direction 등 앵커 참조가 불가한 객체는 참조 포인트 오버레이를 표시하지 않음
      if (targetObj.type === 'text' || targetObj.type === 'move' || targetObj.type === 'direction') {
        return;
      }

      // 텍스트 요소(<text>) 자체는 참조 영역이 아니므로, 도형 내부 텍스트에 마우스가 올라간 경우 실제 도형 기하요소(path, circle, polygon 등)의 바운딩 박스를 기준으로 참조 포인트를 표시
      let shapeEl: Element = targetEl;
      if (targetEl.tagName.toLowerCase() === 'text') {
        const shapeCandidate = svgEl.querySelector(`:not(text)[data-obj-id="${objId}"], :not(text)[data-line-number="${lineStr}"]`);
        if (shapeCandidate) {
          shapeEl = shapeCandidate;
        } else {
          return;
        }
      }

      try {
        const gEl = shapeEl as SVGGraphicsElement;
        const bbox = gEl.getBBox();
        if (!bbox || (bbox.width <= 0 && bbox.height <= 0)) return;

        const currentObjIndex = objects.findIndex(o => 
          selectedObjectId
            ? o.id === selectedObjectId
            : (selectedLine !== null ? (selectedLine >= o.lineNumber && selectedLine < o.lineNumber + (o.rawStatement ? o.rawStatement.split('\n').length : 1)) : false)
        );

        const isConnector = ['arrow', 'line', 'spline', 'arc'].includes(targetObj.type);

        const anchors: { name: string; label: string; x: number; y: number }[] = [
          { name: '.c', label: 'center (.c)', x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 },
          { name: '.n', label: 'north (.n)', x: bbox.x + bbox.width / 2, y: bbox.y },
          { name: '.ne', label: 'northeast (.ne)', x: bbox.x + bbox.width, y: bbox.y },
          { name: '.e', label: 'east (.e)', x: bbox.x + bbox.width, y: bbox.y + bbox.height / 2 },
          { name: '.se', label: 'southeast (.se)', x: bbox.x + bbox.width, y: bbox.y + bbox.height },
          { name: '.s', label: 'south (.s)', x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height },
          { name: '.sw', label: 'southwest (.sw)', x: bbox.x, y: bbox.y + bbox.height },
          { name: '.w', label: 'west (.w)', x: bbox.x, y: bbox.y + bbox.height / 2 },
          { name: '.nw', label: 'northwest (.nw)', x: bbox.x, y: bbox.y },
        ];

        if (isConnector) {
          anchors.push(
            { name: '.start', label: 'start (.start)', x: bbox.x, y: bbox.y },
            { name: '.end', label: 'end (.end)', x: bbox.x + bbox.width, y: bbox.y + bbox.height }
          );
        }

        const overlayGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        overlayGroup.setAttribute('id', 'pikchr-anchor-overlay');
        overlayGroup.setAttribute('style', 'cursor: pointer;');

        // 바운딩 박스 가이드 라인
        const boxGuide = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        boxGuide.setAttribute('x', String(bbox.x - 2));
        boxGuide.setAttribute('y', String(bbox.y - 2));
        boxGuide.setAttribute('width', String(bbox.width + 4));
        boxGuide.setAttribute('height', String(bbox.height + 4));
        boxGuide.setAttribute('fill', 'none');
        boxGuide.setAttribute('stroke', '#3b82f6');
        boxGuide.setAttribute('stroke-width', '1');
        boxGuide.setAttribute('stroke-dasharray', '3,3');
        boxGuide.setAttribute('opacity', '0.6');
        boxGuide.setAttribute('pointer-events', 'none');
        overlayGroup.appendChild(boxGuide);

        anchors.forEach(a => {
          const refString = getObjectReference(objects, currentObjIndex, targetObj, a.name);

          const pointGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          pointGroup.setAttribute('class', 'pikchr-anchor-point');

          // 배경 투명 터치 영역 (클릭 용이성 증대)
          const hitCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          hitCircle.setAttribute('cx', String(a.x));
          hitCircle.setAttribute('cy', String(a.y));
          hitCircle.setAttribute('r', '9');
          hitCircle.setAttribute('fill', 'transparent');
          hitCircle.setAttribute('cursor', 'pointer');
          pointGroup.appendChild(hitCircle);

          // 시각적 앵커 점
          const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          dot.setAttribute('cx', String(a.x));
          dot.setAttribute('cy', String(a.y));
          dot.setAttribute('r', a.name === '.c' ? '4.5' : '3.5');
          dot.setAttribute('fill', a.name === '.c' ? '#10b981' : '#3b82f6');
          dot.setAttribute('stroke', '#ffffff');
          dot.setAttribute('stroke-width', '1.5');
          dot.setAttribute('style', 'transition: all 0.15s ease; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));');
          pointGroup.appendChild(dot);

          // 툴팁 타이틀
          const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
          title.textContent = `${refString} (${a.label})`;
          pointGroup.appendChild(title);

          pointGroup.addEventListener('mouseenter', () => {
            dot.setAttribute('r', '6');
            dot.setAttribute('fill', '#f59e0b');
            dot.setAttribute('stroke-width', '2');
          });

          pointGroup.addEventListener('mouseleave', () => {
            dot.setAttribute('r', a.name === '.c' ? '4.5' : '3.5');
            dot.setAttribute('fill', a.name === '.c' ? '#10b981' : '#3b82f6');
            dot.setAttribute('stroke-width', '1.5');
          });

          pointGroup.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (onSelectAnchor) {
              onSelectAnchor(refString, a.name);
            }
          });

          overlayGroup.appendChild(pointGroup);
        });

        svgEl.appendChild(overlayGroup);
      } catch (err) {
        // SVG getBBox 예외 안전 처리
      }
    };

    const handleMouseOver = (e: MouseEvent) => {
      if (!selectedLine && !selectedObjectId) return;
      if (!activeTargetField) return;
      const target = (e.target as Element).closest('[data-pikchr-target="true"]');
      if (target) {
        renderAnchorOverlay(target);
      }
    };

    const handleMouseLeaveContainer = (e: MouseEvent) => {
      const rel = e.relatedTarget as Element | null;
      if (!rel || !container.contains(rel)) {
        removeOverlay();
      }
    };

    const handleClick = (e: MouseEvent) => {
      // 앵커 클릭이 아닌 일반 요소 클릭
      const anchorNode = (e.target as Element).closest('.pikchr-anchor-point');
      if (anchorNode) return;

      const target = (e.target as Element).closest('[data-pikchr-target="true"]');
      if (target) {
        e.stopPropagation();
        const lineStr = target.getAttribute('data-line-number');
        const objId = target.getAttribute('data-obj-id') || undefined;
        if (lineStr) {
          const lineNum = parseInt(lineStr, 10);
          onSelectLine(lineNum, objId);
        }
      } else {
        onSelectLine(null);
        removeOverlay();
      }
    };

    container.addEventListener('mouseover', handleMouseOver);
    container.addEventListener('mouseleave', handleMouseLeaveContainer);
    container.addEventListener('click', handleClick);

    return () => {
      container.removeEventListener('mouseover', handleMouseOver);
      container.removeEventListener('mouseleave', handleMouseLeaveContainer);
      container.removeEventListener('click', handleClick);
      removeOverlay();
    };
  }, [compileResult.svgHtml, objects, selectedLine, selectedObjectId, activeTargetField, onSelectLine, onSelectAnchor]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.min(Math.max(prev * delta, 0.2), 4));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || panMode || e.altKey || (e.target as HTMLElement).tagName === 'DIV') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleResetView = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  const getPaperClass = () => {
    switch (canvasBg) {
      case 'paper-white':
        return 'canvas-paper-white border border-slate-300 dark:border-slate-700';
      case 'paper-dark':
        return 'canvas-paper-dark border border-slate-800';
      case 'transparent':
        return 'canvas-paper-transparent';
      default:
        return 'canvas-paper-white';
    }
  };

  return (
    <main
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className={`relative flex-1 bg-slate-100 dark:bg-slate-950 bg-grid-pattern overflow-hidden flex items-center justify-center select-none transition-colors ${
        panMode || isDragging ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
      }`}
    >
      {/* Canvas Viewport Toolbar (Left) */}
      <div className="absolute top-4 left-4 z-20 flex items-center bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-lg p-1 shadow-lg space-x-1 text-slate-700 dark:text-slate-300">
        <button
          onClick={() => setScale(prev => Math.min(prev * 1.2, 4))}
          title="Zoom In"
          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setScale(prev => Math.max(prev / 1.2, 0.2))}
          title="Zoom Out"
          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-1" />
        <button
          onClick={handleResetView}
          title={t.stage.resetView}
          className="px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white text-xs font-mono transition"
        >
          {Math.round(scale * 100)}%
        </button>
        <div className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-1" />
        <button
          onClick={() => setPanMode(!panMode)}
          title={t.stage.panToggle}
          className={`p-1.5 rounded transition ${
            panMode 
              ? 'bg-blue-600 text-white shadow-xs' 
              : 'hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Hand className="w-4 h-4" />
        </button>
      </div>

      {/* Canvas Paper Mode Toolbar (Right Top) */}
      <div className="absolute top-4 right-4 z-20 flex items-center bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-lg p-1 shadow-lg space-x-1 text-slate-700 dark:text-slate-300">
        <button
          onClick={() => setCanvasBg('paper-white')}
          title={t.stage.paperWhite}
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs transition ${
            canvasBg === 'paper-white'
              ? 'bg-blue-600 text-white font-medium shadow-xs'
              : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t.stage.paperWhite}</span>
        </button>
        <button
          onClick={() => setCanvasBg('paper-dark')}
          title={t.stage.paperDark}
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs transition ${
            canvasBg === 'paper-dark'
              ? 'bg-blue-600 text-white font-medium shadow-xs'
              : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
          }`}
        >
          <Moon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t.stage.paperDark}</span>
        </button>
        <button
          onClick={() => setCanvasBg('transparent')}
          title={t.stage.transparent}
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs transition ${
            canvasBg === 'transparent'
              ? 'bg-blue-600 text-white font-medium shadow-xs'
              : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
          }`}
        >
          <Grid className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t.stage.transparent}</span>
        </button>
      </div>

      {/* Center SVG Content */}
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transformOrigin: 'center center',
          transition: isDragging ? 'none' : 'transform 0.1s ease-out',
        }}
        className="pikchr-interactive-canvas p-12 flex items-center justify-center shrink-0"
      >
        {compileResult.success ? (
          <div
            ref={svgContainerRef}
            className={`p-8 rounded-2xl transition-all duration-300 inline-block shrink-0 ${getPaperClass()}`}
            dangerouslySetInnerHTML={{ __html: compileResult.svgHtml }}
          />
        ) : (
          <div className="p-8 bg-white/90 dark:bg-slate-900/90 border border-rose-300 dark:border-rose-500/30 rounded-2xl shadow-2xl backdrop-blur-md max-w-lg text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-rose-500 dark:text-rose-400" />
            </div>
            <h3 className="text-sm font-semibold text-rose-600 dark:text-rose-300">{t.stage.syntaxErrorTitle}</h3>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-mono bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-left whitespace-pre-wrap">
              {compileResult.error?.rawText || 'Syntax error'}
            </p>
          </div>
        )}
      </div>

      {/* Floating Info Badge */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center space-x-2 text-[11px] text-slate-600 dark:text-slate-400 bg-white/80 dark:bg-slate-900/80 backdrop-blur border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-full shadow-lg">
        <MousePointer className="w-3.5 h-3.5 text-blue-500" />
        <span>{t.stage.clickHint}</span>
      </div>

      {/* Active Target Field Picker Indicator */}
      {activeTargetField && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 flex items-center space-x-2 bg-blue-600 text-white backdrop-blur-md px-4 py-1.5 rounded-full shadow-xl text-xs font-medium border border-blue-400/40 animate-bounce">
          <Crosshair className="w-3.5 h-3.5 text-amber-300" />
          <span>{t.inspector.pointPickHint} <strong className="font-mono uppercase bg-blue-700/80 px-1.5 py-0.5 rounded text-[11px] ml-1">[{activeTargetField}]</strong></span>
        </div>
      )}
    </main>
  );
};
