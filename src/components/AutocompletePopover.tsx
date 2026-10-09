import React, { useEffect, useRef } from 'react';
import { 
  Square, 
  Sliders, 
  Crosshair, 
  Compass, 
  MoveRight, 
  Tag, 
  Sparkles, 
  FunctionSquare, 
  KeyRound,
  FileCode2
} from 'lucide-react';
import { CompletionItem, CompletionKind, CaretCoordinates } from '../lib/autocomplete/types';

interface AutocompletePopoverProps {
  isOpen: boolean;
  items: CompletionItem[];
  selectedIndex: number;
  position: CaretCoordinates;
  onSelect: (item: CompletionItem) => void;
  onClose: () => void;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

export const AutocompletePopover: React.FC<AutocompletePopoverProps> = ({
  isOpen,
  items,
  selectedIndex,
  position,
  onSelect,
  containerRef,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);

  // Auto-scroll selected item into view inside popover
  useEffect(() => {
    if (selectedItemRef.current && listRef.current) {
      selectedItemRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex]);

  if (!isOpen || items.length === 0) return null;

  const currentItem = items[selectedIndex] || items[0];

  const getKindBadge = (kind: CompletionKind) => {
    switch (kind) {
      case 'shape':
        return (
          <span className="flex items-center text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 p-1 rounded-xs">
            <Square className="w-3.5 h-3.5" />
          </span>
        );
      case 'property':
        return (
          <span className="flex items-center text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 p-1 rounded-xs">
            <Sliders className="w-3.5 h-3.5" />
          </span>
        );
      case 'anchor':
        return (
          <span className="flex items-center text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 p-1 rounded-xs">
            <Crosshair className="w-3.5 h-3.5" />
          </span>
        );
      case 'direction':
        return (
          <span className="flex items-center text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 p-1 rounded-xs">
            <Compass className="w-3.5 h-3.5" />
          </span>
        );
      case 'color':
        return (
          <span 
            className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-700 shrink-0 inline-block shadow-2xs"
            style={{ backgroundColor: currentItem?.insertText || '#888' }}
          />
        );
      case 'snippet':
        return (
          <span className="flex items-center text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 p-1 rounded-xs">
            <Sparkles className="w-3.5 h-3.5" />
          </span>
        );
      case 'symbol':
        return (
          <span className="flex items-center text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/60 p-1 rounded-xs">
            <Tag className="w-3.5 h-3.5" />
          </span>
        );
      case 'function':
        return (
          <span className="flex items-center text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 p-1 rounded-xs">
            <FunctionSquare className="w-3.5 h-3.5" />
          </span>
        );
      case 'keyword':
      default:
        return (
          <span className="flex items-center text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 p-1 rounded-xs">
            <KeyRound className="w-3.5 h-3.5" />
          </span>
        );
    }
  };

  // Adjust positioning within container bounds
  const containerWidth = containerRef?.current?.clientWidth || 800;
  const containerHeight = containerRef?.current?.clientHeight || 400;

  const popoverWidth = 420;
  const popoverMaxHeight = 220;

  let leftPos = Math.min(position.left, containerWidth - popoverWidth - 20);
  leftPos = Math.max(10, leftPos);

  let topPos = position.top + position.lineHeight + 6;
  // If popover overflows bottom, show above caret
  if (topPos + popoverMaxHeight > containerHeight && position.top > popoverMaxHeight) {
    topPos = Math.max(10, position.top - popoverMaxHeight - 6);
  }

  return (
    <div
      style={{
        top: `${topPos}px`,
        left: `${leftPos}px`,
      }}
      className="absolute z-50 flex shadow-xl rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden font-sans text-xs select-none animate-in fade-in zoom-in-95 duration-100 max-w-[460px] w-[440px]"
    >
      {/* 1. Left: Completion List */}
      <div 
        ref={listRef}
        className="w-[230px] max-h-[220px] overflow-y-auto p-1 divide-y divide-slate-100 dark:divide-slate-800/60 shrink-0 border-r border-slate-100 dark:border-slate-800"
      >
        {items.map((item, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <div
              key={`${item.kind}_${item.label}_${idx}`}
              ref={isSelected ? selectedItemRef : null}
              onClick={() => onSelect(item)}
              onMouseEnter={() => {}}
              className={`flex items-center space-x-2 px-2 py-1.5 rounded cursor-pointer transition text-left ${
                isSelected
                  ? 'bg-blue-600 text-white font-medium shadow-xs'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200'
              }`}
            >
              {/* Kind Icon */}
              <div className="shrink-0">
                {getKindBadge(item.kind)}
              </div>

              {/* Label & Detail */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={`font-mono text-xs truncate ${isSelected ? 'text-white font-semibold' : 'text-slate-900 dark:text-slate-100'}`}>
                    {item.label}
                  </span>
                  {item.kind === 'snippet' && (
                    <span className={`text-[9px] px-1 py-0.2 rounded font-sans uppercase tracking-wider ${
                      isSelected ? 'bg-blue-700 text-blue-100' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400'
                    }`}>
                      tpl
                    </span>
                  )}
                </div>
                {item.detail && (
                  <p className={`text-[10px] truncate ${isSelected ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'}`}>
                    {item.detail}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. Right: Documentation / Details Panel */}
      <div className="flex-1 p-3 bg-slate-50/70 dark:bg-slate-950/60 flex flex-col justify-between overflow-hidden text-slate-600 dark:text-slate-300">
        <div className="space-y-1.5 overflow-y-auto max-h-[170px] pr-1">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 pb-1 border-b border-slate-200 dark:border-slate-800">
            <FileCode2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="font-mono">{currentItem?.label}</span>
          </div>

          {currentItem?.detail && (
            <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
              {currentItem.detail}
            </p>
          )}

          {currentItem?.documentation && (
            <div className="text-[10.5px] leading-relaxed text-slate-500 dark:text-slate-400 whitespace-pre-wrap font-sans">
              {currentItem.documentation}
            </div>
          )}
        </div>

        {/* Footer Shortcut Hints */}
        <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 select-none">
          <span>↑↓ 탐색</span>
          <span>Enter/Tab 완성</span>
          <span>Esc 닫기</span>
        </div>
      </div>
    </div>
  );
};
