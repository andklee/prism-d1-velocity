import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '../../../..');

function run(cmd: string) {
  try {
    execSync(cmd, { encoding: 'utf8', stdio: 'inherit', cwd: ROOT_DIR });
    return true;
  } catch {
    return false;
  }
}

const CLAUDE_SESSION_HOOK_SCRIPT = `#!/usr/bin/env bash
INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')

# Inject into conversation context so the model can see it
jq -n --arg ctx "CLAUDE_CODE_SESSION_ID=$SESSION_ID" \\
    '{ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: $ctx } }'

# Inject into shell environment so Bash tool calls can use it
# Guard: each session gets its own env file — skip if already written (resume/continue)
if [ -n "$CLAUDE_ENV_FILE" ] && ! grep -q "CLAUDE_CODE_SESSION_ID" "$CLAUDE_ENV_FILE" 2>/dev/null; then
    echo "export CLAUDE_CODE_SESSION_ID=\\"$SESSION_ID\\"" > "$CLAUDE_ENV_FILE"
fi
`;

export default {
  description: 'Install git hooks and Claude Code session hook for AI metrics instrumentation',
  action() {
    const hooksDir = resolve(ROOT_DIR, '.git/hooks');
    const assetsDir = resolve(ROOT_DIR, 'sample-app/assets/module-04');

    if (!existsSync(resolve(ROOT_DIR, '.git'))) {
      console.error('Error: .git directory not found. Are you in a git repository?');
      process.exit(1);
    }

    if (!existsSync(assetsDir)) {
      console.error(`Error: assets directory not found at ${assetsDir}`);
      process.exit(1);
    }

    // --- Git hooks ---

    // Copy and enable prepare-commit-msg hook
    console.log('Installing prepare-commit-msg hook...');
    if (!run(`cp ${assetsDir}/prepare-commit-msg ${hooksDir}/prepare-commit-msg`)) {
      console.error('Failed to copy prepare-commit-msg hook.');
      process.exit(1);
    }
    if (!run(`chmod +x ${hooksDir}/prepare-commit-msg`)) {
      console.error('Failed to make prepare-commit-msg executable.');
      process.exit(1);
    }

    // Copy and enable post-commit hook
    console.log('Installing post-commit hook...');
    if (!run(`cp ${assetsDir}/post-commit ${hooksDir}/post-commit`)) {
      console.error('Failed to copy post-commit hook.');
      process.exit(1);
    }
    if (!run(`chmod +x ${hooksDir}/post-commit`)) {
      console.error('Failed to make post-commit executable.');
      process.exit(1);
    }

    console.log('Git hooks installed successfully.\n');

    // --- Claude Code session ID hook ---

    installClaudeSessionHook();
  },
};

function installClaudeSessionHook() {
  const home = homedir();

  // Use ~/.local/bin — works on both macOS and Linux, commonly on PATH
  const binDir = resolve(home, '.local/bin');
  const hookScriptPath = resolve(binDir, 'claude-session-id-hook');

  // Ensure ~/.local/bin exists
  if (!existsSync(binDir)) {
    console.log(`Creating ${binDir}...`);
    mkdirSync(binDir, { recursive: true });
  }

  // Write the hook script
  console.log(`Installing claude-session-id-hook to ${hookScriptPath}...`);
  writeFileSync(hookScriptPath, CLAUDE_SESSION_HOOK_SCRIPT, { mode: 0o755 });

  // Check if ~/.local/bin is on PATH
  const pathDirs = (process.env.PATH || '').split(':');
  if (!pathDirs.includes(binDir)) {
    console.log(`\n  ⚠️  ${binDir} is not in your PATH.`);
    console.log(`  Add this to your shell profile (~/.bashrc, ~/.zshrc, etc.):`);
    console.log(`    export PATH="$HOME/.local/bin:$PATH"\n`);
  }

  // Register in ~/.claude/settings.json (merge, don't overwrite)
  const claudeDir = resolve(home, '.claude');
  const settingsPath = resolve(claudeDir, 'settings.json');

  if (!existsSync(claudeDir)) {
    mkdirSync(claudeDir, { recursive: true });
  }

  let settings: any = {};
  if (existsSync(settingsPath)) {
    try {
      settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
    } catch {
      console.warn(`Warning: Could not parse ${settingsPath}. Creating backup and writing fresh config.`);
      const backup = `${settingsPath}.bak.${Date.now()}`;
      writeFileSync(backup, readFileSync(settingsPath));
      console.warn(`  Backup saved to ${backup}`);
      settings = {};
    }
  }

  // Merge hooks — preserve existing hooks, only add/update SessionStart
  if (!settings.hooks) {
    settings.hooks = {};
  }

  const sessionStartHook = {
    matcher: '',
    hooks: [
      {
        type: 'command',
        command: 'claude-session-id-hook',
        timeout: 5000,
      },
    ],
  };

  if (!settings.hooks.SessionStart) {
    settings.hooks.SessionStart = [sessionStartHook];
  } else {
    // Check if our hook is already registered
    const alreadyRegistered = settings.hooks.SessionStart.some((entry: any) =>
      entry.hooks?.some((h: any) => h.command === 'claude-session-id-hook')
    );
    if (!alreadyRegistered) {
      settings.hooks.SessionStart.push(sessionStartHook);
    } else {
      console.log('Claude session hook already registered in settings.json.');
    }
  }

  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  console.log(`Claude Code settings updated at ${settingsPath}`);
  console.log('\nClaude Code session hook installed successfully.');
}
