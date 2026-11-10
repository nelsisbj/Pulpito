import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { decorateReferences, insertTextAtCaret, isEditorEmpty, normalizeRefSpans, selectionInside, serializeEditorHtml } from '../lib/editor.js';

const RichText = forwardRef(function RichText(
  {
    value,
    onChange,
    placeholder,
    sectionId,
    onFocusEditor,
    onActivity,
    onRefHover,
    onRefLeave,
    onRefClick,
    onKeyDown,
  },
  ref,
) {
  const elRef = useRef(null);
  const decorateTimer = useRef(null);
  const [empty, setEmpty] = useState(!value);

  useImperativeHandle(ref, () => ({
    getEl: () => elRef.current,
    decorate: () => {
      if (!elRef.current) return;
      if (decorateReferences(elRef.current)) onChange(elRef.current.innerHTML);
    },
  }));

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    if (el.innerHTML !== (value || '')) el.innerHTML = value || '';
    setEmpty(isEditorEmpty(el));
    try {
      decorateReferences(el);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      clearTimeout(decorateTimer.current);
    },
    [],
  );

  const runDecorate = () => {
    const el = elRef.current;
    if (!el || !selectionInside(el)) return;
    try {
      const changed = decorateReferences(el);
      if (changed) onChange(serializeEditorHtml(el));
      setEmpty(isEditorEmpty(el));
    } catch {
      /* nunca deixa a decoração quebrar a digitação */
    }
  };

  const scheduleDecorate = () => {
    clearTimeout(decorateTimer.current);
    decorateTimer.current = setTimeout(runDecorate, 1400);
  };

  const handleInput = () => {
    const el = elRef.current;
    if (!el) return;
    onChange(serializeEditorHtml(el));
    setEmpty(isEditorEmpty(el));
    onActivity?.(el, sectionId);
    scheduleDecorate();
  };

  const handleBlur = () => {
    const el = elRef.current;
    if (!el) return;
    normalizeRefSpans(el);
    runDecorate();
    onChange(serializeEditorHtml(el));
  };

  return (
    <div
      ref={elRef}
      className={`editor-input ${empty ? 'is-empty' : ''}`}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      data-placeholder={placeholder}
      role="textbox"
      aria-multiline="true"
      aria-label={placeholder}
      onInput={handleInput}
      onFocus={() => onFocusEditor?.(sectionId, elRef.current)}
      onBlur={handleBlur}
      onPaste={(event) => {
        event.preventDefault();
        const text = event.clipboardData.getData('text/plain');
        insertTextAtCaret(text);
        handleInput();
      }}
      onKeyDown={(event) => onKeyDown?.(event, elRef.current, sectionId)}
      onMouseOver={(event) => {
        const span = event.target.closest?.('.verse-ref');
        if (!span || !elRef.current?.contains(span)) return;
        if (span.contains(event.relatedTarget)) return;
        onRefHover?.(span.dataset.ref, span.getBoundingClientRect(), span);
      }}
      onMouseOut={(event) => {
        const span = event.target.closest?.('.verse-ref');
        if (!span) return;
        if (span.contains(event.relatedTarget)) return;
        onRefLeave?.();
      }}
      onClick={(event) => {
        const span = event.target.closest?.('.verse-ref');
        if (span && elRef.current?.contains(span)) {
          event.preventDefault();
          onRefClick?.(span.dataset.ref);
        }
      }}
    />
  );
});

export default RichText;
