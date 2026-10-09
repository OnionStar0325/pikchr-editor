import React from 'react';
import { X, BookOpen, Code, Layers, Sparkles } from 'lucide-react';
import { useTranslation } from '../lib/i18n';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-slate-800 dark:text-slate-200 transition-colors">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-blue-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t.help.modalTitle}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* 1. Basic Shapes */}
          <div className="space-y-2">
            <h3 className="font-semibold text-blue-600 dark:text-blue-400 flex items-center space-x-1.5">
              <Layers className="w-4 h-4" />
              <span>{t.help.sectionShapes}</span>
            </h3>
            <div className="grid grid-cols-2 gap-2 font-mono text-[11px] bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
              <div><code>box "Text" fit</code> : Box</div>
              <div><code>circle "Node" rad 0.3in</code> : Circle</div>
              <div><code>cylinder "DB" fill 0xfce7f3</code> : Cylinder</div>
              <div><code>diamond "Valid?" fit</code> : Diamond</div>
              <div><code>oval "State" fit</code> : Oval</div>
              <div><code>file "Doc" fit</code> : File</div>
            </div>
          </div>

          {/* 2. Connectors & Layout */}
          <div className="space-y-2">
            <h3 className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center space-x-1.5">
              <Code className="w-4 h-4" />
              <span>{t.help.sectionConnectors}</span>
            </h3>
            <div className="font-mono text-[11px] bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
              <div><code>arrow right 0.5in</code> : Arrow right</div>
              <div><code>arrow down 0.5in "Label" above</code> : Arrow with label</div>
              <div><code>arrow from Box1.e to Box2.w</code> : Arrow between nodes</div>
              <div><code>line right 0.5in dashed</code> : Dashed line</div>
            </div>
          </div>

          {/* 3. Definitions & Macros */}
          <div className="space-y-2">
            <h3 className="font-semibold text-purple-600 dark:text-purple-400 flex items-center space-x-1.5">
              <Sparkles className="w-4 h-4" />
              <span>{t.help.sectionDefs}</span>
            </h3>
            <div className="font-mono text-[11px] bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
              <div><code>scale = 0.8</code> : Overall diagram scale</div>
              <div><code>$gap = 0.5in</code> : Custom variable</div>
              <div><code>define node &#123; box "Service" fit; arrow &#125;</code> : Macro definition</div>
            </div>
          </div>

          {/* 4. Tips */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-lg text-blue-900 dark:text-blue-300 space-y-1">
            <div className="font-semibold">{t.help.tipsTitle}</div>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-blue-800 dark:text-blue-200/90">
              <li>{t.help.tip1}</li>
              <li>{t.help.tip2}</li>
              <li>{t.help.tip3}</li>
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition"
          >
            {t.help.closeBtn}
          </button>
        </div>
      </div>
    </div>
  );
};
