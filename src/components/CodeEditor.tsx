import { useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

/**
 * Light, clean editor theme matching CodePath's design system. Defined in-place
 * (no new dependency) so the code editor feels premium but stays on the app's
 * own styling stack. Syntax colours are a calm, readable light palette.
 */
const codePathLight = EditorView.theme(
  {
    '&': {
      color: '#1e293b',
      backgroundColor: '#fbfdff',
      height: '100%',
    },
    '.cm-content': {
      caretColor: '#059669',
      lineHeight: '1.6',
      padding: '10px 0',
    },
    '&.cm-focused': { outline: 'none' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#059669' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
      backgroundColor: '#d1fae5 !important',
    },
    '.cm-activeLine': { backgroundColor: '#f0fdfa' },
    '.cm-activeLineGutter': { backgroundColor: '#eef2f7' },
    '.cm-gutters': {
      backgroundColor: '#f8fafc',
      color: '#94a3b8',
      border: 'none',
      borderRight: '1px solid #eef2f7',
    },
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 8px 0 12px', minWidth: '36px' },
  },
  { dark: false }
);

const codePathHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: '#0d9488' },
  { tag: [tags.name, tags.deleted, tags.character, tags.propertyName], color: '#1e293b' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: '#4f46e5' },
  { tag: [tags.string, tags.inserted, tags.special(tags.string)], color: '#047857' },
  { tag: [tags.number, tags.bool, tags.null], color: '#b45309' },
  { tag: [tags.comment, tags.quote], color: '#94a3b8', fontStyle: 'italic' },
  { tag: [tags.operator, tags.punctuation], color: '#475569' },
]);

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  readonly?: boolean;
  onFocus?: () => void;
}

export default function CodeEditor({ value, onChange, readonly, onFocus }: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valueRef = useRef(value);
  valueRef.current = value;
  const onFocusRef = useRef(onFocus);
  onFocusRef.current = onFocus;

  useEffect(() => {
    if (!containerRef.current) return;
    if (viewRef.current) return;

    const view = new EditorView({
      doc: valueRef.current,
      extensions: [
        basicSetup,
        javascript(),
        codePathLight,
        syntaxHighlighting(codePathHighlight),
        EditorView.editable.of(!readonly),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
          if (update.focusChanged && update.view.hasFocus) {
            onFocusRef.current?.();
          }
        }),
      ],
      parent: containerRef.current,
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value into editor only when it differs (e.g. Reset).
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      const dispatch = view.state.update({ changes: { from: 0, to: current.length, insert: value } });
      view.dispatch(dispatch);
    }
  }, [value]);

  return <div ref={containerRef} className="min-h-[120px] w-full text-left" />;
}
