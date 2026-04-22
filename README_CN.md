<p align="center">
  <strong>pimx — 多 Provider 媒体生成 CLI</strong><br>
  一个 binary 同时接入 MiniMax 和 PiAPI，在任意 Agent 或终端中生成文字、图像、视频、语音和音乐。
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="https://platform.minimax.io">MiniMax 国际版</a> · <a href="https://platform.minimaxi.com">MiniMax 国内版</a> · <a href="https://piapi.ai">PiAPI</a>
</p>

> 基于 [MiniMax-AI/cli](https://github.com/MiniMax-AI/cli) 的内部 fork，新增 PiAPI 作为第二个 provider。MiniMax 原生能力完整保留。

## 功能特性

- **文本对话** — 多轮对话、流式输出、系统提示词、JSON 格式输出 _(MiniMax)_
- **图像生成 / 编辑** — MiniMax `image-01` 适合快速批量占位图；PiAPI `nano-banana-pro`（Gemini 2.5 Flash）适合对 prompt 遵循度高、图中含文字的场景；PiAPI `gpt-image-2-preview`（OpenAI 兼容、同步）适合便宜快速迭代；PiAPI `image remove-bg` 一键去背景（$0.001/张）
- **视频生成** — 异步生成，进度追踪 _(MiniMax)_
- **语音合成** — 30+ 音色、语速调节、流式播放 _(MiniMax)_
- **音乐生成** — 文生音乐、自定义歌词、纯音乐、自动生词、Cover 生成 _(MiniMax)_
- **图像理解** — 图片描述与识别 _(MiniMax)_
- **网络搜索** — MiniMax 搜索引擎
- **多 Provider** — 一个 binary 两套 key，团队成员配置任一 key 即可解锁对应能力

## 安装

```bash
git clone https://github.com/tobias-hui/cli ~/projects/saas/pi/cli
cd ~/projects/saas/pi/cli
bun install && bun run build
npm link  # 暴露 `pimx` 到 PATH
```

> 需要 [Node.js](https://nodejs.org) 18+ 和 [bun](https://bun.sh)（开发时）

## Provider 配置

每个 provider 解锁一组能力。`pimx auth status` 会展示当前配置了哪些 provider、各自解锁了哪些 model。

### MiniMax（text / video / speech / music / vision / search + `image-01`）

```bash
pimx auth login                     # OAuth 浏览器授权
pimx auth login --api-key sk-xxxxx  # API Key
```

需要 [MiniMax Token 套餐](https://platform.minimax.io/subscribe/token-plan)。Region 自动探测，也可用 `--region global|cn` 覆盖。

### PiAPI（Nano Banana Pro — Gemini 2.5 Flash）

```bash
pimx auth login --provider piapi --api-key <key>
```

需要 [PiAPI](https://piapi.ai) 账号。解锁的 model：

| Model | 能力 | 说明 |
|---|---|---|
| `nano-banana-pro` | 图像（t2i + i2i，task 异步） | 1K/2K $0.105，4K $0.18 / 张 |
| `gpt-image-2-preview` | 图像（OpenAI 兼容，同步返回） | 按 quality 分档计费 |
| `Qubico/image-toolkit`（`background-remove`） | 图像去背景 | $0.001 / 张 |

PiAPI 是异步任务：submit → poll → download。默认阻塞直到完成；加 `--async` 立即返回 `task_id`。

## 快速开始

```bash
# 查看当前配置
pimx auth status --output json

# MiniMax 图片（不传 --model 时默认）
pimx image generate --prompt "一只穿宇航服的猫" --out-dir ./out/

# PiAPI nano-banana-pro
pimx image generate --model nano-banana-pro --prompt "带'开卖'字样的 hero banner" --aspect-ratio 16:9 --output hero.png

# MiniMax 视频
pimx video generate --prompt "海浪拍打礁石" --download sunset.mp4

# MiniMax 语音
pimx speech synthesize --text "你好！" --out hello.mp3

# MiniMax 音乐
pimx music generate --prompt "欢快的流行乐" --lyrics "[主歌] 啦啦啦，阳光照" --out song.mp3
```

## 命令参考

### `pimx image`（minimax + piapi）

按 `--model` 自动路由，也可用 `--provider minimax|piapi` 显式指定。不传则默认走 MiniMax `image-01`。

```bash
# MiniMax
pimx image generate --prompt "科技感 Logo" --n 3 --aspect-ratio 16:9
pimx image generate --prompt "山水画" --out-dir ./output/

# PiAPI nano-banana-pro
pimx image generate --model nano-banana-pro --prompt "写实黄昏" --aspect-ratio 16:9 --resolution 2K --out hero.png
pimx image generate --model nano-banana-pro --prompt "换成森林背景" --image https://example.com/input.png --out out.png
pimx image generate --model nano-banana-pro --prompt "装饰艺术海报" --async
# → {"provider":"piapi","model":"nano-banana-pro","task_id":"...","status":"pending"}

# PiAPI gpt-image-2-preview（OpenAI 兼容，同步）
pimx image generate --model gpt-image-2-preview --prompt "一只小海獭" --size 1024x1024 --quality low --out otter.png
pimx image generate --model gpt-image-2-preview --prompt "海报" --quality high --output-format webp --n 3 --out-dir ./out/

# PiAPI 去背景（$0.001/张）
pimx image remove-bg --image https://example.com/photo.jpg --out clean.png
pimx image remove-bg --image https://example.com/photo.jpg --rmbg-model BEN2 --out clean.png
```

### `pimx text` · `video` · `speech` · `music` · `vision` · `search`（minimax）

```bash
pimx text chat --message "写一首诗"
pimx video generate --prompt "海浪拍打礁石" --download sunset.mp4
pimx video generate --prompt "机器人作画" --async
pimx speech synthesize --text "你好！" --out hello.mp3
pimx speech voices
pimx music generate --prompt "史诗管弦乐" --instrumental --out bgm.mp3
pimx music cover --prompt "爵士钢琴，慵懒女声" --audio-file original.mp3 --out cover.mp3
pimx vision describe --image https://example.com/img.jpg --prompt "这是什么品种的狗？"
pimx search query --q "最新动态" --output json
```

### `pimx auth`

```bash
pimx auth login                                        # MiniMax OAuth
pimx auth login --api-key sk-xxxxx                     # MiniMax API Key
pimx auth login --provider piapi --api-key <key>       # PiAPI
pimx auth status                                       # 同时展示两个 provider 及解锁的 model
pimx auth logout                                       # 清理全部
pimx auth logout --provider piapi                      # 只清单个 provider
```

配置文件位于 `~/.pimx/config.json`：

```json
{
  "providers": {
    "minimax": { "api_key": "sk-...", "region": "global" },
    "piapi":   { "api_key": "..." }
  }
}
```

顶层扁平的 `api_key` / `region` 仍然识别（MiniMax 向后兼容）。

### `pimx config` · `pimx quota`

```bash
pimx quota show
pimx config show
pimx config set --key region --value cn
pimx config set --key default-text-model --value MiniMax-M2.7-highspeed
pimx config export-schema | jq .
```

### 环境变量

| 变量 | 说明 |
|---|---|
| `MINIMAX_API_KEY` | MiniMax API Key |
| `MINIMAX_REGION` | `global` 或 `cn` |
| `MINIMAX_BASE_URL` | 覆盖 MiniMax base URL |
| `PIAPI_API_KEY` | PiAPI API Key |
| `PIAPI_BASE_URL` | 覆盖 PiAPI base URL |

## 上游

基于 [MiniMax-AI/cli](https://github.com/MiniMax-AI/cli)。上游不会接受第三方 provider 的 PR，所以以 fork 方式长期维护。跟进上游新功能时在 `main` 上 rebase。

## 许可证

[MIT](LICENSE)
