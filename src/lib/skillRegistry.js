/**
 * Curated skill/MCP cards shown in the right sidebar.
 * Clicking a card sends its `prompt` to Claude via the chat stream.
 *
 * Keep this list short and generic so it stays useful in any project.
 * `claude mcp list` output (from main.js) is merged in at runtime for real MCPs.
 */

export const BUILTIN_SKILLS = [
  {
    id: 'explain-project',
    title: 'Explain project',
    subtitle: 'Overview of the codebase',
    icon: 'Map',
    tone: 'cyan',
    prompt: 'Give me a concise overview of this project: what it does, the main entry points, and the overall architecture.'
  },
  {
    id: 'find-todos',
    title: 'Find TODOs',
    subtitle: 'Scan for TODO/FIXME',
    icon: 'ListTodo',
    tone: 'amber',
    prompt: 'Scan the codebase for TODO, FIXME, and HACK comments. Group them by file and summarise the themes.'
  },
  {
    id: 'run-tests',
    title: 'Run tests',
    subtitle: 'Detect test runner and run',
    icon: 'FlaskConical',
    tone: 'cyan',
    prompt: 'Detect which test runner this project uses and run the full test suite. Report pass/fail and the first few failures.'
  },
  {
    id: 'review-diff',
    title: 'Review diff',
    subtitle: 'Review staged changes',
    icon: 'GitPullRequest',
    tone: 'amber',
    prompt: 'Run `git diff --staged`. Review the staged changes as a code reviewer: flag bugs, regressions, and anything surprising.'
  },
  {
    id: 'dependency-audit',
    title: 'Audit deps',
    subtitle: 'Outdated / risky packages',
    icon: 'ShieldAlert',
    tone: 'coral',
    prompt: 'Audit this project\'s dependencies. Identify outdated or potentially risky packages and suggest upgrades.'
  },
  {
    id: 'generate-readme',
    title: 'Draft README',
    subtitle: 'Generate a README.md',
    icon: 'BookOpen',
    tone: 'cyan',
    prompt: 'Draft a README.md for this project: description, install steps, usage, and contribution notes. Write it to README.md if none exists.'
  }
];

/**
 * Parse the raw output of `claude mcp list` into card objects.
 * The CLI format can vary across versions; we keep the parser very forgiving.
 */
export function parseMcpList(raw) {
  if (!raw || typeof raw !== 'string') return [];
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  const servers = [];
  for (const line of lines) {
    // Accept formats like "name: command" or "• name — description"
    const colon = line.match(/^(.+?)\s*:\s*(.+)$/);
    if (colon) {
      const name = colon[1].replace(/^[•*-]\s*/, '').trim();
      if (name && !/^(name|server)s?$/i.test(name)) {
        servers.push({
          id: `mcp:${name}`,
          title: name,
          subtitle: colon[2].length > 48 ? colon[2].slice(0, 45) + '…' : colon[2],
          icon: 'Plug',
          tone: 'cyan',
          prompt: `Use the \`${name}\` MCP server and show me what it can do in this project.`,
          isMcp: true
        });
      }
    }
  }
  return servers;
}
