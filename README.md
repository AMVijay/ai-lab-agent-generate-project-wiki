# ai-lab-agent-generate-project-wiki

A GitHub Copilot agent that automatically generates a comprehensive project wiki from your codebase.

## Purpose

This lab demonstrates how to build a VS Code Copilot agent that analyzes a software project and produces structured wiki documentation. Given a repository, the agent explores the codebase, understands its structure and conventions, and generates human-readable wiki pages covering:

- Project overview and architecture
- Directory structure and key modules
- Setup and installation instructions
- Development workflows and conventions
- API or component references

## How It Works

1. The agent is invoked inside VS Code via GitHub Copilot Chat.
2. It traverses the workspace, reading source files, configuration, and existing documentation.
3. It synthesizes the gathered context into wiki-style Markdown pages.
4. The generated pages are written to a `wiki/` directory at the root of the project.

## Getting Started

### Prerequisites

- VS Code with the [GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) and [GitHub Copilot Chat](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat) extensions installed.

### Usage

1. Open your project in VS Code.
2. Open GitHub Copilot Chat (`Ctrl+Alt+I`).
3. Select the agent mode (the `@` menu) and choose this agent.
4. Run the generation command and review the output in the `wiki/` folder.

## Contributing

Contributions are welcome. Please follow [Conventional Commits](https://www.conventionalcommits.org/) for all commit messages.

## License

See [LICENSE](LICENSE).

