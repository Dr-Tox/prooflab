import type { TextEdit } from "./model";
export interface Caret {
  anchor: number;
  focus: number;
}
function position(root: HTMLElement, node: Node | null, offset: number) {
  if (!node || !root.contains(node)) return undefined;
  const r = document.createRange();
  r.selectNodeContents(root);
  try {
    r.setEnd(node, offset);
    return r.toString().length;
  } catch {
    return undefined;
  }
}
export function captureCaret(root: HTMLElement): Caret | undefined {
  const s = getSelection();
  if (!s) return;
  const anchor = position(root, s.anchorNode, s.anchorOffset),
    focus = position(root, s.focusNode, s.focusOffset);
  if (anchor !== undefined && focus !== undefined) return { anchor, focus };
}
function point(
  root: HTMLElement,
  offset: number,
  forward = false,
): [Node, number] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const length = n.textContent?.length ?? 0;
    // At a boundary, an edit start belongs to the following text node.
    // Otherwise replacing a whole bold/italic word starts outside its wrapper.
    if (offset < length || (!forward && offset === length)) return [n, offset];
    offset -= length;
  }
  return [root, root.childNodes.length];
}
export function restoreCaret(root: HTMLElement, caret?: Caret) {
  root.focus();
  if (!caret) return;
  const a = point(root, caret.anchor),
    f = point(root, caret.focus);
  getSelection()?.setBaseAndExtent(a[0], a[1], f[0], f[1]);
}
export function applyDomTransaction(root: HTMLElement, edits: TextEdit[]) {
  const before = root.innerHTML,
    caret = captureCaret(root);
  // Validate everything against one immutable snapshot before touching the DOM.
  const source = root.textContent ?? "";
  let boundary = source.length;
  const sorted = [...edits].sort((a, b) => b.start - a.start);
  for (const e of sorted) {
    if (e.end > boundary || source.slice(e.start, e.end) !== e.original)
      throw Error("Stale editor transaction.");
    boundary = e.start;
  }
  try {
    for (const e of sorted) {
      const [a, ao] = point(root, e.start, true),
        [b, bo] = point(root, e.end);
      const r = document.createRange();
      r.setStart(a, ao);
      r.setEnd(b, bo);
      r.deleteContents();
      r.insertNode(document.createTextNode(e.replacement));
    }
  } catch (error) {
    root.innerHTML = before;
    restoreCaret(root, caret);
    throw error;
  }
  const mapped = (offset: number) => {
    let result = offset;
    for (const e of [...edits].sort((a, b) => a.start - b.start)) {
      if (offset >= e.end) result += e.replacement.length - (e.end - e.start);
      else if (offset > e.start)
        result += e.replacement.length - (offset - e.start);
    }
    return result;
  };
  if (caret)
    restoreCaret(root, {
      anchor: mapped(caret.anchor),
      focus: mapped(caret.focus),
    });
}
