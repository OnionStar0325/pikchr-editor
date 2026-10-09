import React from 'react';
import { 
  Play, 
  Download, 
  Copy, 
  Check, 
  Code2, 
  Layout, 
  FileCode, 
  RotateCcw,
  Sparkles,
  HelpCircle,
  FolderOpen
} from 'lucide-react';
import { EXAMPLES } from '../lib/examples';

interface HeaderProps {
  onLoadTemplate: (code: string) => void;
  onExportSvg: () => void;
  onExportPng: () => void;
  onCopyCode: () => void;
  onReset: () => void;
  isCopied: boolean;
  compileSuccess: boolean;
  durationMs: number;
}

export const Header: React.FC<HeaderProps> = ({
  onLoadTemplate,
  onExportSvg,
  onExportPng,
  onCopyCode,
  onReset,
  isCopied,
  compileSuccess,
  durationMs,
}) => {
  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0 select-none">
      {/* Brand & Title */}
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Code2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="font-bold text-sm tracking-wide text-slate-100">Pikchr Editor</h1>
            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded">
              v1.0 Live
            </span>
          </div>
          <p className="text-[11px] text-slate-400">Interactive Diagram Designer & Code Generator</p>
        </div>
      </div>

      {/* Center Templates dropdown */}
      <div className="flex items-center space-x-2">
        <div className="relative group">
          <button className="flex items-center space-x-2 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700/60 transition shadow-sm">
            <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
            <span>예제 템플릿 불러오기</span>
          </button>
          <div className="absolute left-0 mt-1 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 hidden group-hover:block z-50">
            {EXAMPLES.map(ex => (
              <button
                key={ex.id}
                onClick={() => onLoadTemplate(ex.code)}
                className="w-full text-left px-3 py-2 hover:bg-slate-700/70 text-xs transition flex flex-col"
              >
                <span className="font-semibold text-slate-200">{ex.name}</span>
                <span className="text-[11px] text-slate-400 truncate">{ex.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs">
          <div className={`w-2 h-2 rounded-full ${compileSuccess ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
          <span className="text-slate-300 font-mono text-[11px]">
            {compileSuccess ? `WASM (${durationMs}ms)` : 'Syntax Error'}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center space-x-2">
        <button
          onClick={onReset}
          title="기본값으로 초기화"
          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          onClick={onCopyCode}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 transition"
        >
          {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{isCopied ? '복사됨' : '코드 복사'}</span>
        </button>

        <div className="relative group">
          <button className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white shadow-md shadow-blue-600/20 transition">
            <Download className="w-3.5 h-3.5" />
            <span>내보내기</span>
          </button>
          <div className="absolute right-0 mt-1 w-36 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 hidden group-hover:block z-50">
            <button
              onClick={onExportSvg}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-xs text-slate-200 flex items-center space-x-2"
            >
              <FileCode className="w-3.5 h-3.5 text-blue-400" />
              <span>SVG 다운로드</span>
            </button>
            <button
              onClick={onExportPng}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-xs text-slate-200 flex items-center space-x-2"
            >
              <Layout className="w-3.5 h-3.5 text-emerald-400" />
              <span>PNG 다운로드</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
