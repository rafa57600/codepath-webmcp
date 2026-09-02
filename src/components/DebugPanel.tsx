import { useState } from 'react';
import { X, Terminal } from 'lucide-react';
import type { WebmcpStatus } from '../lib/webmcp-browser';

interface ToolMeta {
  name: string;
  description: string;
  schema: {
    type: string;
    properties: Record<string, unknown>;
    required: string[];
  };
}

export default function DebugPanel({
  tools,
  status,
  onClose,
}: {
  tools: ToolMeta[];
  status: WebmcpStatus;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 bg-slate-950 px-4 py-3">
          <div className="flex items-center gap-2">
            <Terminal size={18} className="text-indigo-300" />
            <span className="font-semibold text-white">
              WebMCP — {status.mode === 'browser-webmcp' ? 'Registered Tools' : 'Tool Inventory'}
            </span>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[calc(80vh-60px)] overflow-y-auto p-4">
          {status.mode === 'browser-webmcp' ? (
            <p className="mb-4 text-sm text-slate-400">
              <span className="font-semibold text-emerald-400">WebMCP available.</span> All{' '}
              {status.count} tools are registered on{' '}
              <code className="text-slate-300">document.modelContext</code> and callable by any
              WebMCP-compatible AI agent. Each tool reads or writes real application state — this
              is not mock data.
            </p>
          ) : (
            <p className="mb-4 text-sm text-slate-400">
              <span className="font-semibold text-amber-400">WebMCP unavailable in this browser.</span>{' '}
              These {tools.length} tool definitions exist and can be called in-page via{' '}
              <code className="text-slate-300">window.__webmcp</code> (dev/testing bridge), but they
              are <em>not</em> registered on <code className="text-slate-300">document.modelContext</code>{' '}
              here. Open in Chrome 149+ with{' '}
              <code className="text-slate-300">chrome://flags/#enable-webmcp-testing</code> to make
              them agent-discoverable.
            </p>
          )}
          <div className="space-y-3">
            {tools.map((t) => (
              <div key={t.name} className="rounded-lg border border-white/10 bg-slate-950 p-3">
                <code className="text-sm font-semibold text-emerald-300">{t.name}</code>
                <p className="mt-1 text-sm text-slate-300">{t.description}</p>
                {Object.keys(t.schema).length > 0 && (
                  <p className="mt-1 text-xs text-slate-500">
                    params: {Object.keys(t.schema).join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
