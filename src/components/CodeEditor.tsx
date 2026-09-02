import { useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  readonly?: boolean;
}

export default function CodeEditor({ value, onChange, readonly }: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    if (!containerRef.current) return;
    if (viewRef.current) return;

    const view = new EditorView({
      doc: valueRef.current,
      extensions: [
        basicSetup,
        javascript(),
        oneDark,
        EditorView.editable.of(!readonly),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
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
