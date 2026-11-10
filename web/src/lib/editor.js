import { findReferences, parseReference } from '@shared/references.js';

export const REF_CLASS = 'verse-ref';

export function isInside(root, node) {
  return Boolean(root && node && (root === node || root.contains(node)));
}

export function selectionInside(root) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return false;
  return isInside(root, sel.anchorNode);
}

export function caretRect() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0).cloneRange();
  let rect = range.getBoundingClientRect();
  if ((!rect || (!rect.width && !rect.height)) && range.startContainer) {
    const node = range.startContainer;
    const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    rect = el?.getBoundingClientRect?.() || null;
  }
  return rect;
}

export function textBeforeCaret(root, max = 320) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return '';
  const range = sel.getRangeAt(0);
  if (!isInside(root, range.startContainer)) return '';
  const clone = document.createRange();
  clone.selectNodeContents(root);
  try {
    clone.setEnd(range.startContainer, range.startOffset);
  } catch {
    return '';
  }
  return clone.toString().slice(-max);
}

/** Offset (em caracteres) do cursor dentro do editor. */
export function caretOffset(root) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return 0;
  const range = sel.getRangeAt(0);
  if (!isInside(root, range.startContainer)) return 0;
  const clone = document.createRange();
  clone.selectNodeContents(root);
  clone.setEnd(range.startContainer, range.startOffset);
  return clone.toString().length;
}

export function setCaretOffset(root, offset) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let node = walker.nextNode();
  let last = null;
  while (node) {
    const len = node.nodeValue.length;
    if (remaining <= len) {
      const range = document.createRange();
      const refSpan = node.parentElement?.closest?.(`.${REF_CLASS}`);
      if (refSpan) {
        range.setStartAfter(refSpan);
      } else {
        range.setStart(node, Math.max(0, remaining));
      }
      range.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      return true;
    }
    remaining -= len;
    last = node;
    node = walker.nextNode();
  }
  if (last) {
    const range = document.createRange();
    range.setStart(last, last.nodeValue.length);
    range.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    return true;
  }
  return false;
}

/**
 * Envolve referências bíblicas em <span class="verse-ref">.
 * Não mexe no texto, então o cursor é preservado pelo offset.
 */
export function decorateReferences(root) {
  if (!root) return false;
  const offset = selectionInside(root) ? caretOffset(root) : null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (parent && parent.closest(`.${REF_CLASS}`)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const targets = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const matches = findReferences(node.nodeValue);
    if (matches.length) targets.push({ node, matches });
  }
  if (!targets.length) return false;

  for (const { node, matches } of targets) {
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const match of matches) {
      if (match.start < cursor) continue;
      if (match.start > cursor) fragment.appendChild(document.createTextNode(node.nodeValue.slice(cursor, match.start)));
      const span = document.createElement('span');
      span.className = REF_CLASS;
      span.dataset.ref = match.ref.canonical;
      span.setAttribute('contenteditable', 'false');
      span.setAttribute('spellcheck', 'false');
      span.textContent = node.nodeValue.slice(match.start, match.end);
      fragment.appendChild(span);
      cursor = match.end;
    }
    if (cursor < node.nodeValue.length) fragment.appendChild(document.createTextNode(node.nodeValue.slice(cursor)));
    node.parentNode.replaceChild(fragment, node);
  }

  if (offset != null) {
    try {
      setCaretOffset(root, offset);
    } catch {
      /* cursor fora do editor */
    }
  }
  return true;
}

/** Desfaz spans cujo texto não corresponde mais à referência original. */
export function normalizeRefSpans(root) {
  if (!root) return;
  const spans = [...root.querySelectorAll(`.${REF_CLASS}`)];
  for (const span of spans) {
    const ref = parseReference(span.textContent || '');
    if (!ref || !span.dataset.ref) {
      const text = document.createTextNode(span.textContent || '');
      span.parentNode.replaceChild(text, span);
      continue;
    }
    span.dataset.ref = ref.canonical;
    span.title = ref.canonical;
  }
}

/** Serializa o HTML sem os spans visuais de referência (não devem ser salvos). */
export function serializeEditorHtml(root) {
  if (!root) return '';
  const clone = root.cloneNode(true);
  for (const span of clone.querySelectorAll(`.${REF_CLASS}`)) {
    span.replaceWith(document.createTextNode(span.textContent || ''));
  }
  return clone.innerHTML;
}

/** Substitui N caracteres antes do cursor (usado no autocompletar). */
export function replaceBeforeCaret(length, text) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !sel.isCollapsed) return false;
  const range = sel.getRangeAt(0);
  const node = range.startContainer;
  const offset = range.startOffset;
  if (node.nodeType !== Node.TEXT_NODE || offset < length) return false;
  const before = node.nodeValue.slice(0, offset - length);
  const after = node.nodeValue.slice(offset);
  node.nodeValue = `${before}${text}${after}`;
  const caret = before.length + text.length;
  const next = document.createRange();
  next.setStart(node, caret);
  next.collapse(true);
  sel.removeAllRanges();
  sel.addRange(next);
  return true;
}

export function insertTextAtCaret(text) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return false;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStart(node, node.nodeValue.length);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
  return true;
}

export function insertHtmlAtCaret(html) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return false;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const template = document.createElement('template');
  template.innerHTML = html;
  const fragment = template.content;
  const last = fragment.lastChild;
  range.insertNode(fragment);
  if (last) {
    const next = document.createRange();
    next.setStartAfter(last);
    next.collapse(true);
    sel.removeAllRanges();
    sel.addRange(next);
  }
  return true;
}

export function focusEnd(el) {
  if (!el) return;
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

export function exec(command, value = null) {
  try {
    document.execCommand('styleWithCSS', false, true);
  } catch {
    /* alguns navegadores ignoram */
  }
  try {
    return document.execCommand(command, false, value);
  } catch {
    return false;
  }
}

export function selectionState(command) {
  try {
    return document.queryCommandState(command);
  } catch {
    return false;
  }
}

export function isEditorEmpty(el) {
  if (!el) return true;
  const text = el.textContent.replace(/\u200b/g, '').trim();
  return !text && !el.querySelector('img, hr, ul, ol, blockquote');
}

export function saveNativeRange() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  return sel.getRangeAt(0).cloneRange();
}

export function restoreNativeRange(range) {
  if (!range) return false;
  const sel = window.getSelection();
  try {
    sel.removeAllRanges();
    sel.addRange(range);
    return true;
  } catch {
    return false;
  }
}
