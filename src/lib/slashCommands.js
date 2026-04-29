/**
 * Known Claude Code slash commands.
 * Used for autocomplete hints in the InputBar and to detect command intent.
 *
 * Commands beginning with `/` are forwarded as-is to `claude -p` — recent
 * Claude Code versions execute them in print mode.
 */

export const SLASH_COMMANDS = [
  { cmd: '/plugin marketplace add', args: '<git-or-url>',
    desc: 'Register a plugin marketplace (e.g. https://github.com/owner/repo).' },
  { cmd: '/plugin marketplace list', args: '',
    desc: 'List registered marketplaces.' },
  { cmd: '/plugin marketplace remove', args: '<name>',
    desc: 'Remove a registered marketplace.' },
  { cmd: '/plugin install', args: '<plugin-name>',
    desc: 'Install a plugin from a registered marketplace.' },
  { cmd: '/plugin list', args: '',
    desc: 'List installed plugins.' },
  { cmd: '/plugin uninstall', args: '<plugin-name>',
    desc: 'Uninstall a plugin.' },

  { cmd: '/mcp', args: '',
    desc: 'Manage MCP servers (list / add / remove).' },
  { cmd: '/agents', args: '',
    desc: 'Open the agents panel.' },
  { cmd: '/skills', args: '',
    desc: 'List available skills.' },
  { cmd: '/help', args: '',
    desc: 'Show built-in help.' },
  { cmd: '/clear', args: '',
    desc: 'Clear the conversation context.' },
  { cmd: '/compact', args: '',
    desc: 'Compact the context window.' },
  { cmd: '/login', args: '',
    desc: 'Authenticate with Claude.' },
  { cmd: '/logout', args: '',
    desc: 'Sign out of Claude.' },
  { cmd: '/model', args: '<model>',
    desc: 'Switch the model used for the session.' },
  { cmd: '/cost', args: '',
    desc: 'Show session cost / token usage.' }
];

export function isSlashCommand(text) {
  return typeof text === 'string' && text.trim().startsWith('/');
}

export function matchSlashCommands(input) {
  if (!isSlashCommand(input)) return [];
  const q = input.trim().toLowerCase();
  return SLASH_COMMANDS
    .filter((c) => c.cmd.toLowerCase().startsWith(q) || q.startsWith(c.cmd.toLowerCase()))
    .slice(0, 8);
}
