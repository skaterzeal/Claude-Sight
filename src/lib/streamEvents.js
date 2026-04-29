/**
 * Interpreter for Claude Code CLI stream-json events.
 *
 * The CLI emits NDJSON lines; common shapes include:
 *   { type: 'system', subtype: 'init', session_id, model, cwd, tools, ... }
 *   { type: 'assistant', message: { content: [ { type: 'text', text }, { type: 'tool_use', name, input, id } ] } }
 *   { type: 'user',      message: { content: [ { type: 'tool_result', tool_use_id, content } ] } }
 *   { type: 'result',    subtype: 'success', result, session_id, ... }
 *
 * We collapse these into the renderer's message model.
 */

export function extractText(contentBlocks) {
  if (!Array.isArray(contentBlocks)) return '';
  return contentBlocks
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('');
}

export function extractToolUses(contentBlocks) {
  if (!Array.isArray(contentBlocks)) return [];
  return contentBlocks
    .filter((b) => b && b.type === 'tool_use')
    .map((b) => ({ id: b.id, name: b.name, input: b.input }));
}

export function extractToolResults(contentBlocks) {
  if (!Array.isArray(contentBlocks)) return [];
  return contentBlocks
    .filter((b) => b && b.type === 'tool_result')
    .map((b) => ({ id: b.tool_use_id, content: stringifyToolContent(b.content) }));
}

function stringifyToolContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => (c && c.type === 'text' ? c.text : typeof c === 'string' ? c : JSON.stringify(c)))
      .join('\n');
  }
  if (content == null) return '';
  return JSON.stringify(content, null, 2);
}
