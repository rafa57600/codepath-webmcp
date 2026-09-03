import { useState } from 'react';
import { X } from 'lucide-react';
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-kumo-hairline bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-kumo-hairline bg-kumo-tint/80 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-kumo-text-strong">
              WebMCP — {status.mode === 'browser-webmcp' ? 'Registered Tools' : 'Tool Inventory'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-kumo-text-subtle hover:bg-kumo-tint hover:text-kumo-text-default"
          >
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[calc(80vh-60px)] overflow-y-auto p-4">
          {status.mode === 'browser-webmcp' ? (
            <p className="mb-4 text-sm text-kumo-text-default">
              <span className="font-semibold text-kumoText-info">WebMCP available.</span> All{' '}
              {status.count} tools are registered on{' '}
              <code className="rounded bg-kumo-tint px-1 font-mono text-kumo-text-strong">document.modelContext</code>{' '}
              and callable by any WebMCP-compatible AI agent. Each tool reads or writes real
              application state — this is not mock data.
            </p>
          ) : (
            <p className="mb-4 text-sm text-kumo-text-default">
              <span className="font-semibold text-kumoText-warning">WebMCP unavailable in this browser.</span>{' '}
              These {tools.length} tool definitions exist and can be called in-page via{' '}
              <code className="rounded bg-kumo-tint px-1 font-mono text-kumo-text-strong">window.__webmcp</code>{' '}
              (dev/testing bridge), but they are <em>not</em> registered on{' '}
              <code className="rounded bg-kumo-tint px-1 font-mono text-kumo-text-strong">document.modelContext</code>{' '}
              here. Open in Chrome 149+ with{' '}
              <code className="rounded bg-kumo-tint px-1 font-mono text-kumo-text-strong">
                chrome://flags/#enable-webmcp-testing
              </code>{' '}
              to make them agent-discoverable.
            </p>
          )}
          <div className="space-y-3">
            {tools.map((t) => (
              <div key={t.name} className="rounded-xl border border-kumo-hairline bg-kumo-tint/50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <code className="font-mono text-sm font-semibold text-kumoText-info">{t.name}</code>
                  {t.schema && Object.keys(t.schema).length > 0 && (
                    <span className="badge badge-neutral">
                      params: {Object.keys(t.schema).join(', ')}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-kumo-text-default">{t.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
