# minimax-cli

CLI for the [MiniMax AI Platform](https://platform.minimax.io) — generate text, images, video, speech, and music from the terminal.

Supports **Global** (`api.minimax.io`) and **CN** (`api.minimaxi.com`) with automatic region detection.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/MiniMax-AI-Dev/minimax-cli/main/install.sh | sh
```

Or via npm / bun:

```bash
npm install -g minimax-cli
```

## Quick Start

```bash
minimax auth login --api-key sk-xxxxx
minimax text chat --message "What is MiniMax?"
minimax image generate --prompt "A cat in a spacesuit"
minimax video generate --prompt "Ocean waves at sunset"
minimax speech synthesize --text "Hello!" --out hello.mp3
minimax music generate --prompt "Indie folk" --lyrics "La la la..."
minimax vision describe --image photo.jpg
minimax search query --q "MiniMax AI latest news"
```

## Commands

| Command | Description |
|---|---|
| `text chat` | Chat completion (MiniMax-M2.7) |
| `image generate` | Image generation (image-01) |
| `video generate` | Video generation (Hailuo-2.3) |
| `speech synthesize` | Text-to-speech (speech-2.8-hd) |
| `music generate` | Music generation (music-2.5) |
| `vision describe` | Image understanding (VLM) |
| `search query` | Web search |
| `quota show` | Usage quotas |
| `config show / set` | Configuration |
| `config export-schema` | Export tool schemas as JSON |
| `auth login/status/refresh/logout` | Authentication |
| `update` | Self-update |

Run `minimax <command> --help` for full options.

## Agent / CI Usage

See [skill/SKILL.md](skill/SKILL.md) for the complete agent integration guide, including all command signatures, tool schema export, and piping patterns.

```bash
minimax video generate --prompt "A robot." --async --quiet   # non-blocking
minimax text chat --message "Hi" --output json | jq .        # pipe-friendly
minimax config export-schema | jq .                          # tool schemas
```

## Output Philosophy

- `stdout` → data only (text, paths, JSON)
- `stderr` → spinners, warnings, help

## License

MIT
