// Partition by position, never by matching text: identical lines can belong to
// different branches. Completed ancestors protect their entire subtree.
const segments = (text) => typeof Intl.Segmenter === "function"
  ? Array.from(new Intl.Segmenter("en", { granularity: "grapheme" }).segment(text), s => s.segment)
  : Array.from(text);
const listPattern = /^([ \t]*)(?:[-*+]|\d+[.)])\s+/;
const taskPattern = /^([ \t]*)([-*+]|\d+[.)])(\s+)\[(.*?)\](?:\s|$)/;
const indent = line => (line.match(/^[ \t]*/)[0].replace(/\t/g, "    ")).length;

export function partitionTodos({ lines, withChildren = true, doneStatusMarkers = "xX-", removeEmptyTodos = false }) {
  const done = segments(doneStatusMarkers ?? "xX-");
  const root = { children: [], indent: -1 };
  const stack = [root];
  let fence = null;
  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    const inCode = !!fence || !!fenceMatch;
    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1];
      else if (fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length) fence = null;
    }
    const depth = indent(line);
    if (line.trim()) while (stack.length > 1 && depth <= stack[stack.length - 1].indent) stack.pop();
    const match = !inCode && line.match(taskPattern);
    const marker = match?.[4];
    const valid = marker !== undefined && segments(marker).length === 1 && !/[\u202e\u200b\u200c\u200d]/.test(marker);
    const node = { line, indent: depth, children: [], task: valid, done: valid && done.includes(marker), match };
    stack[stack.length - 1].children.push(node);
    if (!inCode && listPattern.test(line)) stack.push(node);
  }
  function visit(node, moving = false) {
    if (node.done) return { source: flatten(node), destination: [] };
    const empty = node.task && !node.line.slice(node.match[0].length).trim();
    const move = node.task ? !(removeEmptyTodos && empty) : moving && withChildren;
    const children = node.children.map(child => visit(child, move));
    const sourceChildren = children.flatMap(child => child.source);
    const destinationChildren = children.flatMap(child => child.destination);
    let source = [node.line, ...sourceChildren];
    let destination = [];
    if (move || destinationChildren.some(line => line.trim())) {
      const context = node.task && !move ? node.line.replace(/\[(.*?)\]\s*/, "") : node.line;
      destination = [context, ...destinationChildren];
    }
    if (move) {
      source = sourceChildren.some(line => line.trim())
        ? [node.task ? node.line.replace(/\[(.*?)\]\s*/, "") : node.line, ...sourceChildren]
        : sourceChildren;
    }
    return { source, destination };
  }
  function flatten(node) { return [node.line, ...node.children.flatMap(flatten)]; }
  const result = root.children.map(node => visit(node));
  return { remaining: result.flatMap(node => node.source), todos: result.flatMap(node => node.destination) };
}
