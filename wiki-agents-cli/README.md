# wiki-agents

Generate a project wiki from your codebase — two ways:

| Mode | How |
|------|-----|
| **VS Code agent** | Installs GitHub Copilot agents into the mode picker |
| **CLI generate** | Writes `docs/` files directly via GitHub Models API |

---

## Install

No installation needed — use with `npx`:

```bash
npx wiki-agents              # install VS Code agents
npx wiki-agents generate     # generate docs/ from the CLI
```

Or install globally:

```bash
npm install -g wiki-agents
wiki-agents
wiki-agents generate
```

---

## Mode 1 — VS Code agent (no token required)

Installs five `.agent.md` files into `.github/agents/` and enables them in `.vscode/settings.json`.

```bash
# Run from your project root
npx wiki-agents
```

Then in VS Code:

1. Reload window — `Ctrl+Shift+P` → `Developer: Reload Window`
2. Open Copilot Chat — `Ctrl+Alt+I`
3. Click the mode dropdown → select **Wiki Generator**
4. Type `Generate all wiki docs`

The agent writes four files to `docs/`:

| File | Contents |
|------|----------|
| `ARCHITECTURE.md` | Tech stack, directory structure, components, data flow |
| `SECURITY.md` | Auth, secrets, input validation, transport security |
| `CI-CD.md` | Pipeline stages, environments, release process |
| `TESTING-APPROACH.md` | Frameworks, test types, coverage, run commands |

---

## Mode 2 — CLI generate (requires `GITHUB_TOKEN`)

Analyzes your codebase and writes `docs/` files directly — no VS Code needed. Works in CI/CD.

### Set your token

| Shell | Command |
|-------|---------|
| bash / zsh | `export GITHUB_TOKEN=ghp_yourtoken` |
| PowerShell | `$env:GITHUB_TOKEN = "ghp_yourtoken"` |
| cmd.exe | `set GITHUB_TOKEN=ghp_yourtoken` |

Get a token at [github.com/settings/tokens](https://github.com/settings/tokens) — classic PAT, `read:user` scope is sufficient for GitHub Models access.

### Run

```bash
# Generate all four docs (default model: gpt-4o)
npx wiki-agents generate

# Choose a specific model
npx wiki-agents generate --model=gpt-4o

# Generate only specific docs
npx wiki-agents generate --docs=architecture,security

# Combine flags
npx wiki-agents generate --model=Meta-Llama-3.1-405B-Instruct --docs=cicd,testing
```

### Available `--docs` values

| Value | Output file |
|-------|-------------|
| `architecture` | `docs/ARCHITECTURE.md` |
| `security` | `docs/SECURITY.md` |
| `cicd` | `docs/CI-CD.md` |
| `testing` | `docs/TESTING-APPROACH.md` |

### Available models (GitHub Models catalog)

| Model ID | Best for |
|----------|----------|
| `gpt-4o` *(default)* | Best quality, large codebases |
| `gpt-4o-mini` | Small projects (8k token limit) |
| `Meta-Llama-3.1-405B-Instruct` | Alternative high-quality generation |
| `Meta-Llama-3.1-8B-Instruct` | Fast, lighter analysis |

List all models available to your token:

```bash
curl -s -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://models.inference.ai.azure.com/models | \
  node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); JSON.parse(d).forEach(m=>console.log(m.id))"
```

### Use in CI/CD (GitHub Actions)

```yaml
- name: Generate wiki docs
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: npx wiki-agents generate
```

---

## Help

```bash
npx wiki-agents --help
```

---

## License

MIT
