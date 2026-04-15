#!/usr/bin/env node

'use strict';

// Route subcommands
const subcommand = process.argv[2];
if (subcommand === 'generate') {
  require('./generate').generate(process.argv.slice(3)).catch(e => {
    console.error(`\x1b[31m✗\x1b[0m ${e.message}`);
    process.exit(1);
  });
} else if (subcommand === '--help' || subcommand === '-h') {
  console.log(`
Usage:
  npx wiki-agents              Install agents into .github/agents/ (VS Code mode picker)
  npx wiki-agents generate     Generate docs/ wiki files via GitHub Models API

generate flags:
  --model=<name>    Model to use (default: gpt-4o)
  --docs=<list>     Comma-separated: architecture,security,cicd,testing (default: all)

Required env var for generate:
  GITHUB_TOKEN      Personal access token with models:read scope

  bash/zsh:    export GITHUB_TOKEN=ghp_yourtoken
  PowerShell:  $env:GITHUB_TOKEN = "ghp_yourtoken"
  cmd.exe:     set GITHUB_TOKEN=ghp_yourtoken
`);
} else {
  runInstall();
}

function runInstall() {

const fs = require('fs');
const path = require('path');

const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RED = '\x1b[31m';

const log = (color, symbol, msg) => console.log(`${color}${symbol}${RESET} ${msg}`);

const cwd = process.cwd();
const agentsSrc = path.join(__dirname, '../agents');
const agentsDest = path.join(cwd, '.github', 'agents');
const vscodeDir = path.join(cwd, '.vscode');
const settingsPath = path.join(vscodeDir, 'settings.json');

console.log(`\n${CYAN}wiki-agents installer${RESET}`);
console.log(`Installing into: ${cwd}\n`);

// 1. Create .github/agents/ if it doesn't exist
fs.mkdirSync(agentsDest, { recursive: true });

// 2. Copy all .agent.md files
const agentFiles = fs.readdirSync(agentsSrc).filter(f => f.endsWith('.agent.md'));

if (agentFiles.length === 0) {
  log(RED, '✗', 'No agent files found in package. Installation aborted.');
  process.exit(1);
}

agentFiles.forEach(file => {
  const srcFile = path.join(agentsSrc, file);
  const destFile = path.join(agentsDest, file);
  const existed = fs.existsSync(destFile);
  fs.copyFileSync(srcFile, destFile);
  log(GREEN, '✓', `${existed ? 'Updated' : 'Installed'} .github/agents/${file}`);
});

// 3. Patch .vscode/settings.json
fs.mkdirSync(vscodeDir, { recursive: true });

let settings = {};
if (fs.existsSync(settingsPath)) {
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch {
    log(YELLOW, '⚠', 'Could not parse existing .vscode/settings.json — creating a fresh one.');
    settings = {};
  }
}

if (settings['chat.agentFiles.enabled'] === true) {
  log(YELLOW, '⚠', '.vscode/settings.json already has chat.agentFiles.enabled — skipping.');
} else {
  settings['chat.agentFiles.enabled'] = true;
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  log(GREEN, '✓', 'Set chat.agentFiles.enabled = true in .vscode/settings.json');
}

console.log(`\n${GREEN}Done!${RESET} Reload the VS Code window to activate the agents.`);
console.log(`  ${CYAN}Ctrl+Shift+P${RESET} → ${CYAN}Developer: Reload Window${RESET}\n`);
console.log(`Available agents in the chat mode picker:`);
agentFiles
  .filter(f => !f.startsWith('wiki-architect') && !f.startsWith('wiki-security') && !f.startsWith('wiki-cicd') && !f.startsWith('wiki-test'))
  .forEach(f => log(GREEN, ' •', f.replace('.agent.md', '')));
console.log();

} // end runInstall()
