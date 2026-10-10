import React, { useState } from 'react';
import { 
  Square, 
  Circle, 
  Database, 
  Diamond, 
  FileText, 
  MoveRight, 
  MoveDown, 
  MoveLeft, 
  MoveUp, 
  GitCommit, 
  Type, 
  Layers, 
  Component, 
  Plus, 
  Sparkles, 
  Search, 
  Sliders, 
  Code2, 
  Variable, 
  Trash2, 
  Compass, 
  Footprints, 
  BoxSelect, 
  Spline,
  Navigation,
  CornerDownRight
} from 'lucide-react';
import { PaletteItem, PikchrDefinition } from '../lib/types';
import { useTranslation } from '../lib/i18n';

interface PaletteSidebarProps {
  onInsertSnippet: (snippet: string) => void;
  definitions: PikchrDefinition[];
  onSelectLine: (lineNumber: number) => void;
  onDeleteLine: (lineNumber: number) => void;
  width?: number;
}

export const PaletteSidebar: React.FC<PaletteSidebarProps> = ({
  onInsertSnippet,
  definitions,
  onSelectLine,
  onDeleteLine,
  width,
}) => {
  const { t } = useTranslation();
  const [mainTab, setMainTab] = useState<'palette' | 'definitions'>('palette');
  const [activeTab, setActiveTab] = useState<'all' | 'objects' | 'directions' | 'snippets'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [newDefType, setNewDefType] = useState<'var' | 'macro'>('var');
  const [newDefName, setNewDefName] = useState('');
  const [newDefVal, setNewDefVal] = useState('');

  const PALETTE_ITEMS: PaletteItem[] = [
    // --- 1. Objects (grammar_kr.md object-class) ---
    {
      id: 'box',
      title: t.palette.boxTitle,
      type: 'box',
      category: 'objects',
      icon: 'square',
      snippet: 'box "Box"',
      description: t.palette.boxDesc,
    },
    {
      id: 'circle',
      title: t.palette.circleTitle,
      type: 'circle',
      category: 'objects',
      icon: 'circle',
      snippet: 'circle "Circle"',
      description: t.palette.circleDesc,
    },
    {
      id: 'cylinder',
      title: t.palette.cylinderTitle,
      type: 'cylinder',
      category: 'objects',
      icon: 'database',
      snippet: 'cylinder "Cylinder"',
      description: t.palette.cylinderDesc,
    },
    {
      id: 'diamond',
      title: t.palette.diamondTitle,
      type: 'diamond',
      category: 'objects',
      icon: 'diamond',
      snippet: 'diamond "Diamond"',
      description: t.palette.diamondDesc,
    },
    {
      id: 'oval',
      title: t.palette.ovalTitle,
      type: 'oval',
      category: 'objects',
      icon: 'circle',
      snippet: 'oval "Oval"',
      description: t.palette.ovalDesc,
    },
    {
      id: 'ellipse',
      title: t.palette.ellipseTitle,
      type: 'ellipse',
      category: 'objects',
      icon: 'circle',
      snippet: 'ellipse "Ellipse"',
      description: t.palette.ellipseDesc,
    },
    {
      id: 'file',
      title: t.palette.fileTitle,
      type: 'file',
      category: 'objects',
      icon: 'file-text',
      snippet: 'file "File"',
      description: t.palette.fileDesc,
    },
    {
      id: 'arrow',
      title: t.palette.arrowTitle,
      type: 'arrow',
      category: 'objects',
      icon: 'move-right',
      snippet: 'arrow',
      description: t.palette.arrowDesc,
    },
    {
      id: 'line',
      title: t.palette.lineTitle,
      type: 'line',
      category: 'objects',
      icon: 'move-right',
      snippet: 'line',
      description: t.palette.lineDesc,
    },
    {
      id: 'arc',
      title: t.palette.arcTitle,
      type: 'arc',
      category: 'objects',
      icon: 'compass',
      snippet: 'arc',
      description: t.palette.arcDesc,
    },
    {
      id: 'spline',
      title: t.palette.splineTitle,
      type: 'spline',
      category: 'objects',
      icon: 'spline',
      snippet: 'spline',
      description: t.palette.splineDesc,
    },
    {
      id: 'dot',
      title: t.palette.dotTitle,
      type: 'dot',
      category: 'objects',
      icon: 'git-commit',
      snippet: 'dot',
      description: t.palette.dotDesc,
    },
    {
      id: 'text',
      title: t.palette.textTitle,
      type: 'text',
      category: 'objects',
      icon: 'type',
      snippet: 'text "Text"',
      description: t.palette.textDesc,
    },
    {
      id: 'move',
      title: t.palette.moveTitle,
      type: 'move',
      category: 'objects',
      icon: 'footprints',
      snippet: 'move',
      description: t.palette.moveDesc,
    },
    {
      id: 'block',
      title: t.palette.blockTitle,
      type: 'block',
      category: 'objects',
      icon: 'box-select',
      snippet: '[\n  box "Sub 1"\n  arrow\n  box "Sub 2"\n]',
      description: t.palette.blockDesc,
    },

    // --- 2. Directions (grammar_kr.md direction statements & compass) ---
    {
      id: 'dir-right',
      title: t.palette.dirRightTitle,
      type: 'direction',
      category: 'directions',
      icon: 'move-right',
      snippet: 'right',
      description: t.palette.dirRightDesc,
    },
    {
      id: 'dir-down',
      title: t.palette.dirDownTitle,
      type: 'direction',
      category: 'directions',
      icon: 'move-down',
      snippet: 'down',
      description: t.palette.dirDownDesc,
    },
    {
      id: 'dir-left',
      title: t.palette.dirLeftTitle,
      type: 'direction',
      category: 'directions',
      icon: 'move-left',
      snippet: 'left',
      description: t.palette.dirLeftDesc,
    },
    {
      id: 'dir-up',
      title: t.palette.dirUpTitle,
      type: 'direction',
      category: 'directions',
      icon: 'move-up',
      snippet: 'up',
      description: t.palette.dirUpDesc,
    },
    {
      id: 'dir-then',
      title: t.palette.dirThenTitle,
      type: 'direction',
      category: 'directions',
      icon: 'corner-down-right',
      snippet: 'arrow go right then down',
      description: t.palette.dirThenDesc,
    },

    // --- 3. Snippets ---
    {
      id: 'snippet-pipeline',
      title: t.palette.pipelineSnippetTitle,
      type: 'box',
      category: 'snippets',
      icon: 'layers',
      snippet: `box "Step 1" fill 0xe0f2fe fit
arrow right 0.4in
box "Step 2" fill 0xfef08a fit
arrow right 0.4in
box "Step 3" fill 0xdcfce7 fit`,
      description: t.palette.pipelineSnippetDesc,
    },
    {
      id: 'snippet-branch',
      title: t.palette.branchSnippetTitle,
      type: 'diamond',
      category: 'snippets',
      icon: 'component',
      snippet: `diamond "Valid?" fill 0xfef3c7 fit
arrow right 0.5in "Yes" above
box "Success" fill 0xdcfce7 fit
arrow down 0.5in from 1st diamond.s "No" ljust
box "Error" fill 0xfee2e2 fit`,
      description: t.palette.branchSnippetDesc,
    },
  ];

  const DEFINITION_PRESETS = [
    {
      id: 'def-scale',
      title: t.definitions.presetScaleTitle,
      code: 'scale = 0.8',
      category: 'global',
      description: t.definitions.presetScaleDesc,
    },
    {
      id: 'def-box-defaults',
      title: t.definitions.presetBoxTitle,
      code: 'boxwid = 1.2in; boxht = 0.6in; boxrad = 0.08in',
      category: 'global',
      description: t.definitions.presetBoxDesc,
    },
    {
      id: 'def-line-defaults',
      title: t.definitions.presetLineTitle,
      code: 'linewid = 0.5in; arrowht = 0.12in; arrowwid = 0.08in',
      category: 'global',
      description: t.definitions.presetLineDesc,
    },
    {
      id: 'def-macro-service',
      title: t.definitions.presetMacroServiceTitle,
      code: 'define service {\n  box "Microservice" fill 0xe0f2fe fit\n  arrow down 0.4in\n}',
      category: 'macro',
      description: t.definitions.presetMacroServiceDesc,
    },
    {
      id: 'def-macro-db',
      title: t.definitions.presetMacroDbTitle,
      code: 'define db_cluster {\n  cylinder "Replica DB" fill 0xfce7f3 fit\n}',
      category: 'macro',
      description: t.definitions.presetMacroDbDesc,
    },
    {
      id: 'def-custom-var',
      title: t.definitions.presetVarTitle,
      code: '$gap = 0.5in',
      category: 'variable',
      description: t.definitions.presetVarDesc,
    },
  ];

  const handleAddCustomDef = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDefName.trim()) return;

    if (newDefType === 'var') {
      const varName = newDefName.startsWith('$') || newDefName.startsWith('@') ? newDefName : `$${newDefName}`;
      onInsertSnippet(`${varName} = ${newDefVal || '0.5in'}`);
    } else {
      onInsertSnippet(`define ${newDefName.trim()} {\n  ${newDefVal || 'box "Custom" fill 0xe0f2fe fit'}\n}`);
    }
    setNewDefName('');
    setNewDefVal('');
  };

  const filteredItems = PALETTE_ITEMS.filter(item => {
    const matchesTab = activeTab === 'all' || item.category === activeTab;
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'square': return <Square className="w-4 h-4 text-sky-400" />;
      case 'circle': return <Circle className="w-4 h-4 text-emerald-400" />;
      case 'database': return <Database className="w-4 h-4 text-pink-400" />;
      case 'diamond': return <Diamond className="w-4 h-4 text-amber-400" />;
      case 'file-text': return <FileText className="w-4 h-4 text-slate-300" />;
      case 'move-right': return <MoveRight className="w-4 h-4 text-indigo-400" />;
      case 'move-down': return <MoveDown className="w-4 h-4 text-indigo-400" />;
      case 'move-left': return <MoveLeft className="w-4 h-4 text-indigo-400" />;
      case 'move-up': return <MoveUp className="w-4 h-4 text-indigo-400" />;
      case 'compass': return <Compass className="w-4 h-4 text-teal-400" />;
      case 'navigation': return <Navigation className="w-4 h-4 text-rose-400" />;
      case 'corner-down-right': return <CornerDownRight className="w-4 h-4 text-amber-400" />;
      case 'spline': return <Spline className="w-4 h-4 text-violet-400" />;
      case 'footprints': return <Footprints className="w-4 h-4 text-slate-400" />;
      case 'box-select': return <BoxSelect className="w-4 h-4 text-yellow-400" />;
      case 'type': return <Type className="w-4 h-4 text-purple-400" />;
      case 'git-commit': return <GitCommit className="w-4 h-4 text-orange-400" />;
      case 'layers': return <Layers className="w-4 h-4 text-cyan-400" />;
      case 'component': return <Component className="w-4 h-4 text-teal-400" />;
      default: return <Square className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <aside
      style={width ? { width: `${width}px` } : undefined}
      className={`${width ? '' : 'w-72'} bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 select-none overflow-hidden text-slate-700 dark:text-slate-200 transition-colors`}
    >
      {/* 1. Main Navigation Switcher */}
      <div className="p-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80">
        <div className="grid grid-cols-2 gap-1 bg-slate-200/70 dark:bg-slate-900 p-1 rounded-lg border border-slate-300/60 dark:border-slate-800">
          <button
            onClick={() => setMainTab('palette')}
            className={`flex items-center justify-center space-x-1.5 py-1.5 rounded-md text-xs font-semibold transition ${
              mainTab === 'palette'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t.palette.tabPalette}</span>
          </button>
          <button
            onClick={() => setMainTab('definitions')}
            className={`flex items-center justify-center space-x-1.5 py-1.5 rounded-md text-xs font-semibold transition ${
              mainTab === 'definitions'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>{t.palette.tabDefinitions} ({definitions.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: PALETTE */}
      {mainTab === 'palette' && (
        <>
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder={t.palette.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            {/* Category Filter Tabs: all | objects | directions | snippets */}
            <div className="flex bg-slate-100 dark:bg-slate-950 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800">
              {(['all', 'objects', 'directions', 'snippets'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-1 text-[10.5px] font-medium rounded capitalize transition ${
                    activeTab === tab
                      ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {tab === 'all' ? t.palette.all : tab === 'objects' ? t.palette.objects : tab === 'directions' ? t.palette.directions.split(' ')[0] : t.palette.snippets}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {filteredItems.map(item => (
              <div
                key={item.id}
                onClick={() => onInsertSnippet(item.snippet)}
                className="group relative p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer transition flex items-start space-x-3"
              >
                <div className="p-2 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 group-hover:border-slate-300 dark:group-hover:border-slate-700 group-hover:scale-105 transition shrink-0 shadow-2xs">
                  {getIcon(item.icon)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                      {item.title}
                    </span>
                    <button
                      title={t.common.add}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-blue-600 text-slate-500 hover:text-white transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{item.description}</p>
                  <div className="mt-1.5 px-2 py-1 bg-white dark:bg-slate-900/90 rounded border border-slate-200 dark:border-slate-800/60 font-mono text-[10px] text-slate-600 dark:text-slate-400 truncate">
                    {item.snippet.split('\n')[0]}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* TAB 2: DEFINITIONS */}
      {mainTab === 'definitions' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {/* 1. Active Definitions */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                <Variable className="w-3.5 h-3.5 text-blue-500" />
                <span>{t.definitions.activeDefs} ({definitions.length})</span>
              </span>

              {definitions.length === 0 ? (
                <div className="p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-lg text-center text-xs text-slate-400">
                  {t.definitions.noDefs}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {definitions.map((def) => (
                    <div
                      key={`${def.id}-${def.lineNumber}`}
                      onClick={() => onSelectLine(def.lineNumber)}
                      className="p-2 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-lg cursor-pointer group flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-1.5">
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold ${
                            def.type === 'macro'
                              ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {def.type}
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{def.name}</span>
                          <span className="text-[10px] text-slate-400">L{def.lineNumber}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate mt-0.5">{def.rawStatement}</p>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteLine(def.lineNumber);
                        }}
                        title={t.common.delete}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-500 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Definition Presets */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-500" />
                <span>{t.definitions.presets}</span>
              </span>

              <div className="space-y-1.5">
                {DEFINITION_PRESETS.map(preset => (
                  <div
                    key={preset.id}
                    onClick={() => onInsertSnippet(preset.code)}
                    className="group p-2 bg-slate-50 dark:bg-slate-950/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 rounded-lg cursor-pointer transition flex items-center justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                          {preset.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{preset.description}</p>
                    </div>
                    <button
                      title={t.common.add}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-blue-600 text-slate-500 hover:text-white transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. New Definition Form */}
            <form onSubmit={handleAddCustomDef} className="p-3 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                  <Plus className="w-3.5 h-3.5 text-blue-500" />
                  <span>{t.definitions.newDef}</span>
                </span>
                <div className="flex bg-white dark:bg-slate-900 rounded p-0.5 border border-slate-200 dark:border-slate-800 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setNewDefType('var')}
                    className={`px-2 py-0.5 rounded transition ${newDefType === 'var' ? 'bg-blue-600 text-white' : 'text-slate-500 dark:text-slate-400'}`}
                  >
                    {t.definitions.typeVar}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewDefType('macro')}
                    className={`px-2 py-0.5 rounded transition ${newDefType === 'macro' ? 'bg-blue-600 text-white' : 'text-slate-500 dark:text-slate-400'}`}
                  >
                    {t.definitions.typeMacro}
                  </button>
                </div>
              </div>

              <input
                type="text"
                placeholder={newDefType === 'var' ? t.definitions.namePlaceholderVar : t.definitions.namePlaceholderMacro}
                value={newDefName}
                onChange={(e) => setNewDefName(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 font-mono focus:outline-none focus:border-blue-500"
              />

              <input
                type="text"
                placeholder={newDefType === 'var' ? t.definitions.valPlaceholderVar : t.definitions.valPlaceholderMacro}
                value={newDefVal}
                onChange={(e) => setNewDefVal(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 font-mono focus:outline-none focus:border-blue-500"
              />

              <button
                type="submit"
                className="w-full py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition flex items-center justify-center space-x-1 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.definitions.addDefBtn}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
};
