# 游戏企划生成器 / Game Plan Generator

> 输入一句游戏点子，AI 自动生成完整企划书、任务清单与开发计划。  
> Enter a game idea, and AI instantly generates a full design doc, task list & dev plan.  
> ゲームのアイデアを入力するだけで、AI が企画書・タスク一覧・開発計画を自動生成します。

---

## 🚀 快速开始 / Quick Start / クイックスタート

**需要 / Required:** 
```
Node.js 18+
pnpm 8+
An API key from your selected AI provider
```

### 1. 克隆并安装 / Clone & Install

```bash
git clone https://github.com/Anzellia/game-plan-generator.git
```
```
pnpm install
```

### 2. 启动 / Start

在终端运行 / Run in terminal:

```bash
pnpm run dev
```

浏览器打开 → **http://localhost:5173**

在输入页选择 AI 厂商和模型，并输入对应厂商的 API Key。密钥按厂商分别保存在**当前浏览器的 localStorage** 中；切换厂商时会载入该厂商保存的密钥，也可以在界面中清除。生成时，密钥会通过本站服务端转发给所选厂商，但不会保存在服务端或仓库。请勿在共用设备上保存密钥。

Select an AI provider and model on the input screen, then enter that provider's API key. Keys are saved **per provider in this browser's localStorage** and can be cleared in the UI. During generation the key passes through this app's server to the selected provider; it is not persisted on the server or committed to the repository. Avoid saving keys on shared devices.

模型名称和 ID 按界面列出；是否可用取决于厂商是否提供该 ID，以及你的账户是否有访问权限。无法访问时，界面会显示相应错误，不会自动切换到其他模型。

---

## ✨ 功能 / Features / 機能

| 中文 | English | 日本語 |
|------|---------|--------|
| AI 生成完整游戏企划书 | AI-generated full game design doc | AI による完全なゲーム企画書生成 |
| 任务清单（优先级 + 预估工时）| Task list with priority & hour estimates | 優先度と工数付きタスクリスト |
| 技术难点分析与解决方案 | Technical challenge analysis & solutions | 技術的課題の分析と解決策 |
| 七天开发计划 | 7-day development plan | 7日間の開発計画 |
| 中 / 日 / EN 界面与内容语言切换 | Switch UI & AI output language: ZH / JA / EN | UI・AI出力言語の切り替え（中/日/英）|
| 导出 Markdown / PNG | Export as Markdown or PNG | Markdown・PNG エクスポート |
| 选择 AI 厂商与模型，保存各厂商的密钥 | Select a provider/model and save a key per provider | AI プロバイダー・モデルを選択、キーをプロバイダー別に保存 |

---

## 🛠 技术栈 / Tech Stack / 技術スタック

- **Frontend:** React + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Express + TypeScript
- **AI:** OpenAI, Anthropic, Google, xAI, DeepSeek (using user-supplied keys)
- **Package Manager:** pnpm
- **Export:** html-to-image (PNG), Markdown

---

## 📁 项目结构 / Project Structure

```
├── client/                 # React frontend
├── server/                 # Express API server
└── package.json
```

---

## 📄 License
 MIT
