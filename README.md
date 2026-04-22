<p align="center">
  <strong>pimx — multi-provider media generation CLI</strong><br>
  Wraps MiniMax and PiAPI behind one binary. Generate text, images, video, speech, and music from any agent or terminal.
</p>

<p align="center">
  <a href="README_CN.md">中文文档</a> · <a href="https://platform.minimax.io">MiniMax Global</a> · <a href="https://platform.minimaxi.com">MiniMax CN</a> · <a href="https://piapi.ai">PiAPI</a>
</p>

> Internal fork of [MiniMax-AI/cli](https://github.com/MiniMax-AI/cli) that adds PiAPI as a second provider. All MiniMax functionality is preserved.

## Features

- **Text** — Multi-turn chat, streaming, system prompts, JSON output _(MiniMax)_
- **Image** — MiniMax `image-01` for fast bulk placeholders, PiAPI `nano-banana-pro` (Gemini 2.5 Flash) for prompt-adherence-heavy work and text-in-image, PiAPI `gpt-image-2-preview` (OpenAI-compatible, synchronous) for cheap iteration, and PiAPI `image remove-bg` for one-click background removal ($0.001/image)
- **Video** — Async video generation with progress tracking _(MiniMax)_
- **Speech** — TTS with 30+ voices, speed control, streaming playback _(MiniMax)_
- **Music** — Text-to-music with lyrics, instrumental mode, auto lyrics, and cover generation _(MiniMax)_
- **Vision** — Image understanding and description _(MiniMax)_
- **Search** — Web search _(MiniMax)_
- **Multi-provider** — One binary, two key sources: each team member can unlock MiniMax, PiAPI, or both by providing the corresponding key

## Install

```bash
git clone https://github.com/tobias-hui/cli ~/projects/saas/pi/cli
cd ~/projects/saas/pi/cli
bun install && bun run build
npm link  # exposes `pimx` on PATH
```

> Requires [Node.js](https://nodejs.org) 18+ and [bun](https://bun.sh) for development.

## Providers

Each provider unlocks a set of capabilities. Running `pimx auth status` shows which providers are configured and what models each unlocks.

### MiniMax (text / video / speech / music / vision / search + `image-01`)

```bash
pimx auth login                     # OAuth browser flow
pimx auth login --api-key sk-xxxxx  # API key
```

Requires a [MiniMax Token Plan](https://platform.minimax.io/subscribe/token-plan). Region auto-detected; override with `--region global|cn`.

### PiAPI (Nano Banana Pro — Gemini 2.5 Flash)

```bash
pimx auth login --provider piapi --api-key <key>
```

Requires a [PiAPI](https://piapi.ai) account. Unlocks:

| Model | Capability | Notes |
|---|---|---|
| `nano-banana-pro` | image (t2i + i2i, task-based) | 1K/2K $0.105, 4K $0.18 per image |
| `gpt-image-2-preview` | image (OpenAI-compatible, synchronous) | priced by quality tier |
| `Qubico/image-toolkit` (`background-remove`) | image background removal | $0.001 per image |

PiAPI tasks are async: submit → poll → download. Default behavior blocks until completion. Pass `--async` to return a `task_id` immediately.

## Quick Start

```bash
# Check what's configured
pimx auth status --output json

# MiniMax image (default when no --model)
pimx image generate --prompt "A cat in a spacesuit" --out-dir ./out/

# PiAPI nano-banana-pro
pimx image generate --model nano-banana-pro --prompt "hero banner with text 'Launch'" --aspect-ratio 16:9 --output hero.png

# MiniMax video
pimx video generate --prompt "Ocean waves at sunset" --download sunset.mp4

# MiniMax speech
pimx speech synthesize --text "Hello!" --out hello.mp3

# MiniMax music
pimx music generate --prompt "Upbeat pop" --lyrics "[verse] La da dee, sunny day" --out song.mp3
```

## Commands

### `pimx image` (minimax + piapi)

Routes by `--model`, or use `--provider minimax|piapi` to pin explicitly. Without flags, defaults to MiniMax `image-01`.

```bash
# MiniMax
pimx image generate --prompt "A cat" --n 3 --aspect-ratio 16:9
pimx image generate --prompt "Logo" --out-dir ./out/

# PiAPI nano-banana-pro
pimx image generate --model nano-banana-pro --prompt "photorealistic sunset" --aspect-ratio 16:9 --resolution 2K --out hero.png
pimx image generate --model nano-banana-pro --prompt "change background to forest" --image https://example.com/input.png --out out.png
pimx image generate --model nano-banana-pro --prompt "art deco poster" --async
# → {"provider":"piapi","model":"nano-banana-pro","task_id":"...","status":"pending"}

# PiAPI gpt-image-2-preview (OpenAI-compatible, synchronous)
pimx image generate --model gpt-image-2-preview --prompt "a cute sea otter" --size 1024x1024 --quality low --out otter.png
pimx image generate --model gpt-image-2-preview --prompt "poster" --quality high --output-format webp --n 3 --out-dir ./out/

# PiAPI background removal ($0.001/image)
pimx image remove-bg --image https://example.com/photo.jpg --out clean.png
pimx image remove-bg --image https://example.com/photo.jpg --rmbg-model BEN2 --out clean.png
```

### `pimx text` · `video` · `speech` · `music` · `vision` · `search` (minimax)

```bash
pimx text chat --message "Write a poem"
pimx video generate --prompt "Ocean waves at sunset" --download sunset.mp4
pimx video generate --prompt "A robot painting" --async
pimx speech synthesize --text "Hello!" --out hello.mp3
pimx speech voices
pimx music generate --prompt "Cinematic orchestral" --instrumental --out bgm.mp3
pimx music cover --prompt "Jazz, piano, warm female vocal" --audio-file original.mp3 --out cover.mp3
pimx vision describe --image https://example.com/img.jpg --prompt "What breed?"
pimx search query --q "latest news" --output json
```

### `pimx auth`

```bash
pimx auth login                                        # MiniMax OAuth
pimx auth login --api-key sk-xxxxx                     # MiniMax API key
pimx auth login --provider piapi --api-key <key>       # PiAPI
pimx auth status                                       # Shows both providers + unlocked models
pimx auth logout                                       # Clear everything
pimx auth logout --provider piapi                      # Clear one provider
```

Config lives at `~/.pimx/config.json`:

```json
{
  "providers": {
    "minimax": { "api_key": "sk-...", "region": "global" },
    "piapi":   { "api_key": "..." }
  }
}
```

Legacy flat `api_key` / `region` at the top level is still recognized for MiniMax (back-compat).

### `pimx config` · `pimx quota`

```bash
pimx quota show
pimx config show
pimx config set --key region --value cn
pimx config set --key default-text-model --value MiniMax-M2.7-highspeed
pimx config export-schema | jq .
```

### Environment variables

| Variable | Purpose |
|---|---|
| `MINIMAX_API_KEY` | MiniMax API key |
| `MINIMAX_REGION` | `global` or `cn` |
| `MINIMAX_BASE_URL` | Override MiniMax base URL |
| `PIAPI_API_KEY` | PiAPI API key |
| `PIAPI_BASE_URL` | Override PiAPI base URL |

## Upstream

Based on [MiniMax-AI/cli](https://github.com/MiniMax-AI/cli). Pull requests to the upstream project would not accept third-party providers, so this is maintained as a fork. To pull new MiniMax features, rebase on upstream `main`.

## License

[MIT](LICENSE)
