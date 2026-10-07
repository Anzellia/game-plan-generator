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

在输入页点击 **AI 设置 → 展开**，选择 AI 厂商并输入对应厂商的 API Key。点击**测试连接**，应用会从厂商接口读取此 Key 可见的文本模型 ID，并向当前选中的模型发送一条简短请求，以验证它能被调用；这条测试请求可能产生少量厂商费用。你也可以直接输入自定义模型 ID。模型 ID 不再使用预置名单，实际可用性以厂商和你的账户权限为准。

Click **AI settings → Expand**, choose a provider and enter its API key. **Test connection** retrieves the text-model IDs visible to that key and sends a short request to the selected model to verify it can be called; the provider may charge a small amount. You can also enter a custom model ID. The model list comes from the provider, not a hard-coded catalog, and availability depends on your account.

密钥按厂商分别保存在**当前浏览器的 localStorage** 中，切换厂商时会载入该厂商保存的密钥，也可以在界面中清除。模型 ID 也会按厂商记住。测试连接和生成时，密钥会通过本站服务端转发给所选厂商，但不会保存在服务端或仓库。请勿在共用设备上保存密钥。模型无法访问时会显示错误，不会自动切换到其他模型。

Keys are saved **per provider in this browser's localStorage** and can be cleared in the UI. Model IDs are remembered per provider too. During connection tests and generation, the key passes through this app's server to the selected provider; it is not persisted on the server or committed to the repository. Avoid saving keys on shared devices. Failed model calls never silently switch providers or models.

---

## v1.5 界面演示 / UI demo / 画面デモ

![v1.5 首页：默认折叠的 AI 设置与生成企划书按钮](docs/images/home-ai-settings.jpg)

截图来自当前 Replit Preview，未填写任何 API Key。

### 使用步骤

1. 在主页输入游戏点子。
2. 点击 **AI 设置 → 展开**，选择 AI 厂商、填写对应的 API Key，并选择或手动输入模型 ID。
3. 可点击 **测试连接**，读取该 Key 可用的模型并验证调用。测试会向所选模型发送简短请求，厂商可能收取少量费用。
4. 点击 **收起**，让页面只显示当前厂商与模型摘要；已填写的配置不会被清除。点击 **生成企划书** 开始生成。

AI 设置默认折叠，包含厂商、API Key、连接测试及模型选择的全部选项。配置不完整时会显示“需要配置”；生成时若缺少密钥或模型、或模型 ID 格式无效，设置面板会自动展开并提示。收起时，已显示的密钥会重新隐藏；这不会删除浏览器中保存的密钥。

**English:** AI settings are collapsed by default. Click **Expand** to configure the provider, API key and model, or test the connection (provider charges may apply). **Collapse** keeps your inputs and shows only the provider/model summary. Enter an idea and click **Generate Plan**. Missing keys or missing/invalid model IDs automatically open the settings panel with a validation message. Revealed keys are masked when toggling the panel; saved keys are not deleted.

**日本語:** AI 設定は初期状態で折りたたまれています。**開く**をクリックして、プロバイダー・API キー・モデルを設定してください。接続テストにはプロバイダーの料金が発生する場合があります。**閉じる**をクリックしても入力内容は保持されます。アイデアを入力して企画書を生成してください。キーやモデルが未入力、またはモデル ID の形式が無効な場合、設定が自動で開き、エラーが表示されます。パネルの切り替え時には表示中のキーが再び隠されますが、保存済みのキーは削除されません。

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
| 测试连接、读取可用模型、手动输入模型 ID | Test connections, load available models, enter a custom ID | 接続テスト、利用可能なモデル取得、モデル ID 手入力 |
| 默认折叠的 AI 设置，收起时保留配置并显示厂商与模型摘要 | Collapsible AI settings with retained inputs and provider/model summary | 入力を保持し、プロバイダー・モデルを表示する折りたたみ式 AI 設定 |
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
