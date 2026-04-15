'use strict';

const fs   = require('fs');
const path = require('path');
const https = require('https');

// ── Colors ───────────────────────────────────────────────────────────────────
const C = {
  reset: '\x1b[0m', green: '\x1b[32m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', red: '\x1b[31m',   dim: '\x1b[2m',
};
const ok   = msg => console.log(`${C.green}✓${C.reset} ${msg}`);
const info = msg => console.log(`${C.cyan}ℹ${C.reset} ${msg}`);
const warn = msg => console.log(`${C.yellow}⚠${C.reset} ${msg}`);
const err  = msg => console.log(`${C.red}✗${C.reset} ${msg}`);

// ── File collection ───────────────────────────────────────────────────────────
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt',
  'coverage', '__pycache__', '.pytest_cache', 'venv', '.venv',
  'target', 'vendor', '.cache', 'tmp', '.turbo', 'docs',
]);
const MAX_FILE_BYTES  = 12 * 1024;   // 12 KB per file
const MAX_TOTAL_BYTES = 60 * 1024;   // 60 KB per document (~45k tokens, safe for gpt-4o)

function collectFiles(rootDir, patterns) {
  const results = [];
  let totalBytes = 0;

  const walk = (dir, depth) => {
    if (depth > 8 || totalBytes >= MAX_TOTAL_BYTES) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }

    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      const relPath  = path.relative(rootDir, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        walk(fullPath, depth + 1);
      } else if (entry.isFile() && patterns.some(p => matchGlob(relPath, p))) {
        try {
          const stat = fs.statSync(fullPath);
          if (stat.size > MAX_FILE_BYTES || totalBytes + stat.size > MAX_TOTAL_BYTES) continue;
          const content = fs.readFileSync(fullPath, 'utf8');
          results.push({ path: relPath, content });
          totalBytes += content.length;
        } catch { /* skip unreadable */ }
      }
    }
  };

  walk(rootDir, 0);
  return results;
}

function matchGlob(relPath, pattern) {
  if (relPath === pattern) return true;

  // Build regex from glob pattern
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // escape special regex chars (not *)
    .replace(/\*\*/g, '\x00')               // placeholder for **
    .replace(/\*/g, '[^/]*')                // * = within one segment
    .replace(/\x00/g, '.*');               // ** = across segments

  // Full path match (for patterns containing /)
  if (new RegExp(`^${regexStr}$`).test(relPath)) return true;

  // Filename-only match (for simple patterns with no /)
  if (!pattern.includes('/')) {
    return new RegExp(`^${regexStr}$`).test(path.basename(relPath));
  }

  // Patterns starting with **/ also match when the tail appears anywhere in the path
  if (pattern.startsWith('**/')) {
    const tail = pattern.slice(3)
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '\x00').replace(/\*/g, '[^/]*').replace(/\x00/g, '.*');
    return new RegExp(`(^|/)${tail}$`).test(relPath);
  }

  return false;
}

function formatFiles(files) {
  return files
    .map(f => `### ${f.path}\n\`\`\`\n${f.content.slice(0, 6000).trimEnd()}\n\`\`\``)
    .join('\n\n');
}

// ── GitHub Models API ─────────────────────────────────────────────────────────
function callAPI(token, model, systemPrompt, userPrompt) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
      temperature: 0.2,
      max_tokens: 4000,
    });

    const req = https.request({
      hostname: 'models.inference.ai.azure.com',
      path:     '/chat/completions',
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Authorization':  `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(payload),
      },
    }, res => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        if (res.statusCode === 401) {
          return reject(new Error('GITHUB_TOKEN is invalid or missing the "models:read" scope.'));
        }
        if (res.statusCode === 429) {
          return reject(new Error('Rate limited by GitHub Models API. Wait a moment and retry.'));
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}: ${raw.slice(0, 300)}`));
        }
        try {
          resolve(JSON.parse(raw).choices[0].message.content);
        } catch {
          reject(new Error(`Unexpected API response: ${raw.slice(0, 300)}`));
        }
      });
    });

    req.on('error', e => reject(new Error(`Network error: ${e.message}`)));
    req.write(payload);
    req.end();
  });
}

// ── Doc definitions ───────────────────────────────────────────────────────────
const DOCS = [
  {
    id: 'architecture',
    file: 'ARCHITECTURE.md',
    patterns: [
      'README.md', 'package.json', 'pyproject.toml', 'go.mod', 'pom.xml',
      'requirements.txt', 'Cargo.toml', '*.csproj',
      'Dockerfile', 'docker-compose.yml', 'docker-compose*.yml',
      'src/**/*.ts', 'src/**/*.js', 'src/**/*.py', 'src/**/*.go',
      'app/**/*.py', 'lib/**/*.js', 'cmd/**/*.go', 'internal/**/*.go',
    ],
    system: `You are a software architect. Analyze the provided codebase files and write a complete, production-quality ARCHITECTURE.md in Markdown. Sections: Overview, Tech Stack (table), Directory Structure (annotated tree), Key Components, Data Flow, External Integrations, Configuration. Use [undocumented] for anything not evidenced in the files. Return ONLY the Markdown document — no preamble.`,
  },
  {
    id: 'security',
    file: 'SECURITY.md',
    patterns: [
      'README.md', 'package.json', 'SECURITY.md',
      '**/.env.example', '**/.env.template', '**/config*.*',
      '**/auth*', '**/middleware*', '**/guard*', '**/permission*',
      '**/security*', '**/cors*', '**/helmet*', '**/jwt*',
      '.snyk', '.github/dependabot.yml', '.github/dependabot.yaml',
    ],
    system: `You are a security documentation specialist. Analyze the provided codebase files and write a complete, production-quality SECURITY.md in Markdown. Sections: Overview, Authentication & Authorization, Secrets Management, Input Validation, Dependency Management, Transport Security, Reporting a Vulnerability, Known Risks & Recommendations. Flag any hardcoded credentials as HIGH RISK. Use [undocumented] where information is unavailable. Return ONLY the Markdown document — no preamble.`,
  },
  {
    id: 'cicd',
    file: 'CI-CD.md',
    patterns: [
      '.github/workflows/*.yml', '.github/workflows/*.yaml',
      'Jenkinsfile', '.gitlab-ci.yml', '.circleci/config.yml',
      'azure-pipelines.yml', '.travis.yml', 'buildspec.yml',
      'cloudbuild.yaml', 'bitbucket-pipelines.yml',
      'Dockerfile', 'docker-compose.yml', '.dockerignore',
      'Makefile', 'terraform/**/*.tf', 'k8s/*.yml', 'k8s/*.yaml',
      'helm/**/*.yaml', 'package.json',
    ],
    system: `You are a CI/CD pipeline documenter. Analyze the provided pipeline and infrastructure files and write a complete, production-quality CI-CD.md in Markdown. Sections: Overview, Pipeline Platform, Pipeline Stages (name/trigger/purpose/commands for each), Build Process, Environment Strategy (table), Containerization, Release Process, Quality Gates. If no CI/CD config is found, state that explicitly. Use [undocumented] where information is unavailable. Return ONLY the Markdown document — no preamble.`,
  },
  {
    id: 'testing',
    file: 'TESTING-APPROACH.md',
    patterns: [
      'package.json', 'pyproject.toml', 'pom.xml', 'go.mod', 'Makefile',
      'jest.config.*', 'vitest.config.*', 'pytest.ini', '.nycrc*',
      'cypress.config.*', 'playwright.config.*', 'karma.conf.*',
      '**/*.test.ts', '**/*.spec.ts', '**/*.test.js', '**/*.spec.js',
      'tests/**', 'test/**', '__tests__/**', 'spec/**', '*_test.go',
    ],
    system: `You are a test strategy documenter. Analyze the provided test files and configuration and write a complete, production-quality TESTING-APPROACH.md in Markdown. Sections: Overview, Test Frameworks (table), Test Categories (Unit/Integration/E2E with examples), Test File Conventions, Running Tests (bash commands), Code Coverage, Mocking Strategy, Test Data & Fixtures. If no tests are found, state that clearly and recommend a starting point. Use [undocumented] where information is unavailable. Return ONLY the Markdown document — no preamble.`,
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────
async function generate(argv = []) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    err('GITHUB_TOKEN environment variable is not set.');
    console.log(`\n  bash/zsh:    ${C.cyan}export GITHUB_TOKEN=ghp_yourtoken${C.reset}`);
    console.log(`  PowerShell:  ${C.cyan}$env:GITHUB_TOKEN = "ghp_yourtoken"${C.reset}`);
    console.log(`  cmd.exe:     ${C.cyan}set GITHUB_TOKEN=ghp_yourtoken${C.reset}`);
    console.log(`  Scope:       ${C.dim}models:read${C.reset} (classic PAT) or GitHub Actions default token\n`);
    process.exit(1);
  }

  // Parse flags
  const modelArg = argv.find(a => a.startsWith('--model='));
  const model    = modelArg ? modelArg.split('=')[1] : 'gpt-4o';

  const docsArg   = argv.find(a => a.startsWith('--docs='));
  const requested = docsArg
    ? docsArg.split('=')[1].split(',').map(s => s.trim())
    : ['architecture', 'security', 'cicd', 'testing'];

  const docsToRun = DOCS.filter(d => requested.includes(d.id));
  if (docsToRun.length === 0) {
    err(`No matching docs for: ${requested.join(', ')}`);
    console.log(`  Valid: architecture, security, cicd, testing`);
    process.exit(1);
  }

  const cwd     = process.cwd();
  const docsDir = path.join(cwd, 'docs');
  fs.mkdirSync(docsDir, { recursive: true });

  console.log(`\n${C.cyan}wiki-agents generate${C.reset}`);
  console.log(`Project: ${C.dim}${cwd}${C.reset}`);
  console.log(`Model:   ${C.dim}${model}${C.reset}`);
  console.log(`Docs:    ${C.dim}${docsToRun.map(d => d.id).join(', ')}${C.reset}\n`);

  for (const doc of docsToRun) {
    info(`[${doc.id}] Collecting files...`);
    const files = collectFiles(cwd, doc.patterns);

    if (files.length === 0) {
      warn(`[${doc.id}] No matching files found — generating stub document.`);
    } else {
      console.log(`  ${C.dim}${files.length} file(s) collected${C.reset}`);
    }

    const userPrompt = files.length > 0
      ? `Here are the relevant project files:\n\n${formatFiles(files)}\n\nNow write the ${doc.file}.`
      : `No source files were found. Write ${doc.file} with placeholder sections noting the codebase could not be analyzed.`;

    info(`[${doc.id}] Calling GitHub Models API (${model})...`);
    let content;
    try {
      content = await callAPI(token, model, doc.system, userPrompt);
    } catch (e) {
      err(`[${doc.id}] Failed: ${e.message}`);
      continue;
    }

    const outPath = path.join(docsDir, doc.file);
    fs.writeFileSync(outPath, content.trimEnd() + '\n');
    ok(`[${doc.id}] Written → docs/${doc.file}`);
  }

  console.log(`\n${C.green}Done!${C.reset} Your wiki is in ${C.cyan}docs/${C.reset}\n`);
}

module.exports = { generate };
