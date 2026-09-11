# 外部输入归档：Microsoft APM（Agent Package Manager）评估（2026-09-11）

> 站长令：调研 `microsoft/apm`，核对其做法**是否符合我们的想法**。
> 结论先行：**高度吻合——吻合到"我们想做的事，它已经做了大半"。清单格式与多宿主装载层已有主，我们不应自造；真正空着的是「记忆」与「经验链路」。**

## 来源

| # | 项目 | 引用 | License |
|---|---|---|---|
| 1 | microsoft/apm | <https://github.com/microsoft/apm> · <https://microsoft.github.io/apm/> | MIT |

热度：3.8k stars · 358 forks · 1,960 commits · 版本约 v0.29（0.x 早期，活跃）· 主力维护者 @danielmeppiel。
技术栈：**Python CLI**（`pyproject.toml` / `uv.lock` / `src/apm_cli/`），发布原生二进制 + Homebrew/pip/WinGet/Scoop。

## 一、它是什么

> "A dependency manager for AI agents — **like npm for agent context**."
> 三大原则：**Portable by manifest · Secure by default · Governed by policy.**

`apm.yml` **跟着仓库走**（ships with your repo, like package.json）；任何开发者 clone 后跑 `apm install`，seven 类原语按目标宿主各自格式落盘。

## 二、清单与依赖

```yaml
name: my-project
version: 1.0.0
dependencies:
  apm:
    - anthropics/skills/skills/frontend-design
    - github/awesome-copilot/plugins/context-engineering#v2.1
    - git: https://gitlab.com/acme/coding-standards.git
      path: instructions/security
      ref: v2.0
  mcp:
    - io.github.github/github-mcp-server
```

- **原语 7 类**（targets matrix 口径）：`instructions` · `prompts` · `agents` · `skills` · `commands` · `hooks` · `mcp`
  （README 另提 `plugins`，与 matrix 不一致；以 matrix 为准，**plugins 不在 primitive 列**）
- **依赖坐标**：`owner/repo/路径#ref`；支持 GitHub / GitLab / Bitbucket / Azure DevOps / Gitea / 任意 git host
- **传递依赖**：包可依赖包，解析完整依赖树
- **两份清单**：`apm.yml`（声明）+ **`apm.lock.yaml`（锁定 + 内容哈希 + SBOM 导出）**
- **无 npm registry** —— "npm" 只是类比；分发靠 git 直引 + Marketplace + `apm pack`
- **卸载命令**：文档（README / 首页 / consumer ramp）**均未出现** —— 需查 CLI reference

## 三、宿主矩阵（16 target）

**稳定 13**：copilot · **claude** · grok-build · **cursor** · **codex** · **gemini** · antigravity · **opencode** · windsurf · kiro · intellij · agent-skills · **hermes**
**实验 4**（需 `apm experimental enable`）：copilot-cowork · copilot-app · grok-cloud · openclaw

三条机制值得注意：

1. **skills 是唯一全局普适的原语**——所有稳定 target 都支持；`prompts` 仅 copilot/intellij 支持
2. **Skills 汇聚（convergence）**：多数 target 统一落到 **`.agents/skills/<name>/SKILL.md`**；仅 claude / grok-build / kiro / hermes(用户级) 保留原生目录 —— **`.agents/skills/` 正在成为跨宿主共识目录**
3. **自动探测信号**：按目录/文件存在与否选 target；探测不到时 **fail closed**（不写）；`--target` / `apm.yml targets:` / 自动探测三级优先级

## 四、治理与安全（我们此前没设想的强项）

| 机制 | 内容 |
|---|---|
| `apm-policy.yml` | 限制允许的来源/范围/原语；继承链**企业 → 组织 → 仓库，只能收紧** |
| `apm audit` | 在 scratch 环境重建上下文并与工作树 diff，**捕获手改**；`--ci` 接入分支保护 |
| 内容哈希 | lockfile 记录 integrity hash，保证逐字节一致 |
| 传递性 MCP | **默认阻断未声明/未受信任的传递 MCP server** |
| 隐藏 Unicode 扫描 | 安装时扫描（提示注入防护） |
| fail-closed 范例 | kiro 的 agent `tools` 权限超集 → **不部分写入**；探测不到 target → 不写 |

## 五、形态与空白

- **CLI，非常驻**（无 daemon / 后台服务描述）
- **无 memory 概念**（README / docs 均未提及记忆或状态持久化）
- primitive types 参考页是**遗留说明**，指向 `package-types` 与 `targets-matrix`；旧设计为 `.apm/`（本地）+ `apm_modules/{dep}/.apm/`（依赖），本地优先、按声明顺序、先声明者胜

## 五之二、MCP 管理机制（详查）

**结论：支持，而且比我们设想的完善——包括"只碰自己的条目"这条我们以为是自家的红线。**

| 维度 | APM 的做法 |
|---|---|
| 发现来源 | **MCP Registry 引用**（`io.github.github/github-mcp-server`）或**自建定义**（`registry: false` + 自写 `transport`/`command`/`url`/`headers`/`args`） |
| 命令面 | `apm install --mcp <ref>` · `apm mcp search/list/show` · `--dry-run` |
| 落盘 | 按 **13 类 harness 各自 schema** 写入：`.github/mcp.json` · `.vscode/mcp.json` · `.mcp.json` / `~/.claude.json` · `.cursor/mcp.json` · **`.codex/config.toml`（TOML）** · `.gemini/settings.json` · `.agents/mcp_config.json` · **`$HERMES_HOME/config.yaml`（YAML）** · `opencode.json` · `~/.codeium/windsurf/mcp_config.json` · `.kiro/settings/mcp.json` · JetBrains |
| **机器级安装** | `apm install -g --mcp NAME` → 写各运行时**用户级**配置 + `~/.apm/apm.yml`（**说明它有 global scope，不是纯 per-project**） |
| **不碰用户条目** | 明确保证：「**用户手写的 server 条目以及无关的 JSON/TOML 设置保持不变**」；重装时移除某 target 只清 **APM 管理的** server 条目 |
| fail-closed 清单 | 畸形 `targets:` · 绿地项目无任何探测信号 · 原生配置写入失败 · **与已建模字段冲突的键**（防重定向）· 畸形/无法解析的必填条目 —— 均**不写并非零退出** |
| 凭据安全 | GitHub token 用**解析后 hostname 白名单**（`github.com.evil.example` 不匹配）；VS Code 把 secret 渲染成**原生 secret-input 引用**，**secret 字节永不进入 `mcp.json`** |
| 传输 | `stdio`（必须有 `command`，**不经 shell**）· `http`/`sse`/`streamable-http`（仅 http/https，**拒绝 `websockets` 与 `file://`**）；互斥组合退出码 2；Codex 非环回必须 HTTPS |
| 卸载 | **没有独立 `uninstall` 命令**；靠"重装时移除 target"清理 |

## 五之三、npm 生态的同类方案（回应「有没有 npm 的」）

**APM 本体不在 npm**（Python CLI；brew / pip / WinGet / Scoop / `curl|sh`）。但 npm 生态里**已经有同类**，且不止一个：

| 方案 | 形态 | 要点 |
|---|---|---|
| **`skills`（Vercel Labs · `npx skills`）** | npm CLI | **16,500+ stars**，生态最广；统一管理 50+ 工具的 skill；本项目已在其分发矩阵内（G4 镜像布局） |
| **`@antfu/skills-npm`** | npm 包 | 把 Agent Skills **内嵌进 npm 包**，复用 npm 的版本管理 / 依赖解析 / lockfile / 私服 |
| **`skillpm`（sbroenne/skillpm）** | npm 包 | 把 skills 放进**正常 npm 模型**：`package.json` + `node_modules` + lockfile + semver |

→ 即：**"用 npm 管理 Agent 能力"这条路，npm 侧已经有人走过，且是 Node 原生。**

## 五之四、Hub / 更新机制 / 全局管理（三问详查）

### Hub —— ⚠️ **更正：没有中心 registry；定位是 git 直连**

> **2026-09-11 更正**：此前据 CLI 命令面写"有 Registry（实验性）+ Marketplace"。核查官网与 `private-and-org-packages` 页后修正如下。

| 机制 | 事实 |
|---|---|
| **中心 registry** | ❌ **不存在**。官网首页**完全不提** registry/hub；依赖一律直接指向 **git 仓库路径** |
| **分发协议** | 无专属协议，**直接走 git 的 HTTPS / SSH** |
| **认证** | 各平台 PAT 环境变量：`GITHUB_APM_PAT`（可按 org 限域 `GITHUB_APM_PAT_<ORG>`）· `GITLAB_APM_PAT` / `GITLAB_TOKEN` · `ADO_APM_PAT`（或 `az login`）；Bitbucket DC / Sourcehut 走 git 自身凭据 |
| **团队共享** | ✅ 以"私有 repo + token 读权限 + per-org 令牌限域"实现，**不是 registry 权限模型** |
| **Marketplace** | 只是**策展的 git 引用清单**（复用同一认证后端），**不是 Hub** |
| `apm publish` / `registries` flag | CLI 里**存在**（实验性，`PUT /v1/packages/...`），但**官方文档的私有包路径是 git-direct**；两者并存，后者为主 |
| **MCP 侧** | 官方 **MCP Registry**（`io.github.x/y`）—— 这条成立 |

### 更新机制 —— ✅ 有，且完整

| 命令 | 作用 |
|---|---|
| `apm outdated` | 只读，报告有新 commit/tag 的依赖（`-g` 查用户级） |
| `apm update` | 重解析 → **打印计划** → 征求同意 → 应用 + **重新部署 primitives**；`--dry-run` / `--yes` / `-g` / `--force` |
| `apm install` | 纯同步，精确复现 lockfile；**从不静默 bump** |
| `apm install --frozen` | CI 用，lockfile 漂移即失败（≈ `npm ci`） |
| `apm install --refresh` | 绕过缓存、强制重新下载内容 |
| `apm lock --update` | 只改 lockfile，不部署 |
| `apm prune` | 清理不再被需要的目录，自动同步 lockfile + harness 文件 |

⚠️ **没有 `remove` 命令** —— 删依赖 = 手删 `apm.yml` 条目 + `apm prune`
⚠️ **缓存无 TTL**（按 SHA 复用 + 空缓存自动恢复 + `--refresh` 绕过）
⚠️ **不自动检查更新**（`apm install` 只打印一行 "Run 'apm update'"）

### 全局管理 —— ✅ 有

- `apm install -g` / `apm update -g` / `apm outdated -g` / `apm deps why -g` → 管理 `~/.apm/` 下的**用户级 manifest + lockfile**
- `~/.apm/config.json` 存默认 registry 与偏好
- ⚠️ 用户级 manifest 的**完整管理文档未见**（但 `-g` 在各命令普遍存在，说明是一等公民）

## 五之五、Node 生态有没有等价物

**没有整合型。** Node 侧现有三个都是**单一用途（只管 skill）**：

| 方案 | 覆盖范围 |
|---|---|
| `skills`（Vercel Labs） | 仅 skill |
| `@antfu/skills-npm` | 仅 skill |
| `skillpm`（sbroenne） | 仅 skill |

→ **"跨原语（skill + MCP + 提示词 + 规则 + hooks）统一声明与多宿主部署"这件事，Node 侧没有等价物——APM 是唯一。**
→ 一个旁证：`mizchi/skills`（TypeScript 技能集合）**选择用 APM 分发**，说明 TS 社区已在把 APM 当渠道用。

> 💡 **语言不是障碍**：APM 是 CLI，**可以当外部工具调用**（像调 `git` / `docker` 一样 spawn），不需要 Node 重写、也不需要引 Python 依赖进代码树。

## 六、逐条对照我们的想法（本档核心）

| # | 我们的想法（2026-09-11 共识） | APM 的对应 | 判定 |
|---|---|---|---|
| 1 | 包内容 = 能力 + 提示词/注入段 | `instructions` / `prompts` / `skills` / `commands` / `hooks` | ✅ **完全覆盖** |
| 2 | 包内容含 MCP | `dependencies.mcp` + 独立 integrator 写各客户端配置 | ✅ 覆盖 |
| 3 | 包内容含规则/人格 | `agents` + `instructions` | ✅ 覆盖 |
| 4 | 两份清单（声明 + 留痕） | `apm.yml` + `apm.lock.yaml`（含内容哈希） | ✅ **比我们想得更完整** |
| 5 | 分发到本机各 Agent | 16 targets + 自动探测 + 支持矩阵 | ✅ **规模远超我们（我们 5 宿主）** |
| 6 | 常驻 = 默认按需 | CLI 非常驻 | ✅ 一致 |
| 7 | 和模型无关、不管套餐 | 完全不涉及 provider | ✅ 一致 |
| 8 | 落点长在我们自己项目里 | 它是独立工具，可被消费 | ⚠️ 需重新表态 |
| 9 | **引用式（symlink 优先）** | 文档**未说明** copy vs symlink；有 skills convergence | ⚠️ **未确认** |
| 10 | **写只碰自己的** | **明确保证不碰用户手写条目**；重装移除 target 只清 APM 管理的条目 | ✅ **已有（不是我们的独有红线）** |
| 10b | **读全量对账**（查本机所有 Agent 的真实状态） | 无"对账 / 外来条目只读"概念（`apm audit` 查的是"手改漂移"，非机器级全量） | ❌ **无** |
| 11 | **切换能力**（在哪些 Agent 启用/停用） | 无此维度 | ❌ **无** |
| 12 | **重复提示**（能力重复 + 配置冲突） | 有冲突检测，但只在**包内**同名原语，不是**机器级** | ⚠️ 层次不同 |
| 13 | **记忆下发与同步** | **完全没有** | ❌ **空白位** |
| 14 | **经验的来源与回流** | 无（不涉及平台/经验） | ❌ **空白位** |
| 15 | 第一版不引入 A2A | 未涉及 A2A | — |
| — | （我们未设想）策略治理 | `apm-policy.yml` + `apm audit` + SBOM | 💡 **值得吸收** |
| — | （我们未设想）安全默认 | 隐藏 Unicode 扫描 · 传递 MCP 默认阻断 · fail-closed | 💡 **值得吸收** |
| — | （我们未设想）宿主共识目录 | **`.agents/skills/`** 汇聚 | 💡 **值得对齐** |

## 七、结论与建议

### 结论

1. **清单格式这一层已有主，且做得比我们的设想完整**（锁定哈希、SBOM、策略继承、16 宿主矩阵、fail-closed）。自造 `agents.json` = 重造轮子。
2. **APM 是"项目视角"（per-repo manifest），我们要的是"机器视角"（per-machine 中心化）**——但这个轴同样已有主：skills-manager（中央库 + 53 宿主）、cc-switch（跨工具配置）。
3. **真正空着的只有两块**：**记忆的下发与同步** · **经验的来源与回流**。这两块 APM 与所有已调研项目都没有。

### 建议（供站长裁决）

| # | 建议 | 理由 |
|---|---|---|
| R1 | **不自造包清单与装载层**，格式对齐 APM 的 `apm.yml`，并把「能导入导出 `apm.yml`」作为接口要求 | 不做第二个包管理器，也不被锁死 |
| R2 | **技能格式对齐 `agentskills.io` 开放规范**（`SKILL.md` 补 frontmatter），`skill.json5` 保留作本地增强 | 见 [Microsoft Agent Framework 评估](#关联) —— 技能天然可被任何宿主读，装载不需要转换层 |
| R3 | 差异位锁定为 **记忆层 + 经验链路**（平台 solution → 本地 → 验证回流） | 唯一无人占位的两块 |
| R4 | 吸收 APM 的**安全默认**：隐藏 Unicode 扫描 · 传递性 MCP 默认阻断 · fail-closed | 我们的 MCP 包边界（"装一个包 = 允许一段外部命令跑"）正需要这一层 |
| R5 | 对齐 **`.agents/skills/`** 作为跨宿主共识目录 | 减少一个宿主一张表的维护成本 |
| R6 | 以**外部工具**方式调用 APM（spawn CLI，像调 git/docker），不在 Node 侧重写 | 语言无障碍；**Node 侧无整合型等价物**，重写 = 重造 APM |
| R7 | 补齐 APM 的三处缺口：**对账（机器级全量）· 切换 · `remove` 语义** | 这三处是"中心化管理"与"可装载可卸载"的硬需求，APM 不做 |

## 八、实测结果（2026-09-11 · APM 0.30.0 · 隔离环境）

**环境**：`uv venv --python 3.14` + `uv pip install apm-cli` → **0.30.0**
**探针**：`/tmp/apm-probe`，`HOME` 指向临时目录，**不碰真实项目与 `~/.claude.json`**
**样本**：`microsoft/apm-sample-package`（官方示例包）+ 自动拉入的传递依赖

### 8.1 关键结论：**复制式，不是引用式**

| 证据 | 结果 |
|---|---|
| `find -type l`（全项目） | **0 个符号链接** |
| inode 比对（源 vs 部署） | `254000522` vs `254004641`，**links=1** → **真实文件副本，连硬链接都不是** |
| `apm install --help` 搜 link/symlink/copy/mode | **无任何链接相关选项** |

→ **APM 不支持引用式。** 上游更新后必须重跑 `apm install` 才同步（不像 symlink 自动跟随）。

### 8.2 部署映射（实测）

```
.apm/instructions/*.instructions.md  →  .claude/rules/*.md
.apm/prompts/*.prompt.md             →  .claude/commands/*.md     ← prompt 被映射为 command
.apm/agents/*.agent.md               →  .claude/agents/*.md
.apm/skills/<name>/SKILL.md          →  .claude/skills/<name>/SKILL.md
```

### 8.3 其他实测观察

| 观察 | 内容 |
|---|---|
| 传递依赖 | 自动拉入 `github/awesome-copilot/skills/review-and-refactor`（`depth: 2` + `resolved_by`） |
| 自动改 `.gitignore` | `Added apm_modules/ to .gitignore` |
| **转换有损** | `frontmatter keys not supported for claude commands and were dropped: mode` |
| 幂等 | 二次 `install` **0.1s**（首次 45.3s） |
| **宿主目录无归属标记** | `.claude/` 下只有 6 个产物文件，**无任何 marker** |
| **lockfile 极详** | `deployed_files` + **`deployed_file_hashes`（逐文件 sha256）** + `content_hash` + `resolved_commit` + `resolved_by` + `package_type`（`apm_package` / `claude_skill`） |
| **`apm audit` 是真对账** | `Replay install (cache-only)` → `Diff scratch vs working tree` → `No drift detected`（6 files） |
| 版本警告 | 未固定版本时警告 `add #tag or #sha to prevent drift` |
| 命令面 | **35+ 命令**：含 **`approve`/`deny`（可执行原语审批）** · **`find`（文件溯源到贡献包）** · `publish` · `search` · `runtime` · `doctor` · `targets` |

### 8.4 修正前文两处判断

1. **"无对账" → 修正为「有项目级哈希对账，缺机器级全量对账」**
   `apm audit` 会**重放安装并与工作树 diff**，能检出宿主文件被手改（哈希级）；但它只对**当前项目**，不回答"我本机所有 Agent 装了什么、哪些是外来的"。
2. **`approve` / `deny` 是重要发现**
   APM 对**可执行原语（hooks / MCP / LSP / bin / canvas）**有显式审批——默认写项目 `apm.yml` 的 `executables.allow`（**要提交**），`--user` 记个人授权到 `~/.apm/config.json`；另有 `--pending` / `--all` / `--recommended`。
   → 这正是我们担心的"**装一个包 = 允许一段外部命令跑**"的答案，且分**项目级 / 个人级两层**。

### 8.5 对我们两条决定的冲击

| 我们的决定 | 实测冲击 |
|---|---|
| #12 **引用式（symlink 优先）** | ❌ **APM 不满足**。若消费 APM，装载继承**复制式**；"更新自动跟随"要靠 `apm update` 重跑 |
| #10b **对账** | ⚠️ **部分满足**：项目级哈希对账已有且很强（连手改都能测出）；**机器级全量对账**仍需自建 |

> **一个反向发现**：复制式 + 逐文件哈希，**对账能力反而强于 symlink**（symlink 只能看指向，复制式能验内容）。我们此前偏好 symlink 的理由是"更新自动跟随"，两者其实是权衡——**APM 选了可验证，我们原本想要自动跟随**。这条需要重新裁决。

## 九、能力实测清单与四问判定（2026-09-11 · APM 0.30.0 实机）

### 9.1 实测确认可用的能力（每条有证据）

| 能力 | 命令 | 实测结果 |
|---|---|---|
| **MCP 注册表检索** | `apm mcp list/search/show` | 直连官方 MCP Registry；搜 `github` 得 10 条；`show` 出详情（Remote Endpoints + Local Packages + Runtime 三张表） |
| MCP 安装 | `apm install --mcp` / `apm mcp install` | 写 13 类 harness 配置 |
| 依赖树 | `apm deps why/tree/info` | 传递依赖自动解析（实测 `depth: 2` + `resolved_by`） |
| **宿主管理** | `apm targets` | 列出全部宿主 + 状态（active/inactive）+ 缺失信号 + 部署目录 |
| **运行时管理** | `apm runtime list/status/setup/remove` | **实测扫到本机 codex-cli 0.153.4**；给出 preference order（copilot→codex→gemini→llm）+ active runtime；可 `setup --version` |
| **可执行原语审批** | `apm approve/deny` | 分**项目级**（`apm.yml` 的 `executables.allow`，要提交）与**个人级**（`~/.apm/config.json`）；含 `--pending` / `--all` / `--recommended` |
| 环境诊断 | `apm doctor` | 5 项：git / network / auth / marketplace config / **executable trust** |
| **文件溯源** | `apm find <file>` | 实测：已知文件 → 贡献包名；未知文件 → 明确报"未被任何已装包追踪" |
| 发布 | `apm publish` | 需开 `registries` 实验开关；`PUT /v1/packages/{owner}/{repo}/versions/{version}` |
| 市场 | `apm marketplace` | 消费者 6 命令 + 作者 5 命令；默认无注册，需 `add` |
| 缓存管理 | `apm cache clean/info/prune` | SHA 组按天裁剪 |

### 9.2 四问判定

| 你的要求 | APM 对应 | 判定 |
|---|---|---|
| **工具整合** | MCP Registry 直连 · 13 宿主写入 · 依赖树 · 传递依赖自动解析 | ✅ **强** |
| **Agent 管理使用** | `targets` · **`runtime`（能装管 AI CLI 本身）** · `approve`/`deny` · `doctor` · `find` | ✅ **超出预期** |
| **动态加载 skill** | **静态复制部署**，无运行时动态加载；宿主靠自身渐进披露机制按需读 | ⚠️ **部分** |
| **经验沉淀分享** | 有 `publish` / `marketplace`（分发**包**），但**无经验语义**——无 validation 三档 · 无 verify/verdict · 无回流 · 无源信号 provenance | ❌ **不满足** |

### 9.3 一句话定性

> **APM 是「能力的分发与管理」，不是「经验的沉淀与回流」。**
> 它回答"装什么、装到哪、装得对不对"；回答不了"经验从哪来、有没有效、用得怎么样、值不值得传下去"。

→ **与本项目差异位（记忆 + 经验链路）不重叠**：APM 可作**装载与分发底座**，经验层仍需自建。

## 十、能力边界记录（2026-09-11 · 实机 + 源码核查）

### 10.1 边界内侧（它能做）

包清单与依赖树 · 17 宿主部署 · MCP 注册表检索与安装 · 渐进式原语映射 · 哈希级 lockfile · 策略治理（`apm-policy.yml`）· 可执行原语审批（`approve`/`deny`）· 漂移审计（`apm audit`）· 文件溯源（`apm find`）· 更新机制（`outdated`/`update`/`prune`/`lock`）· 发布与市场（`publish`/`marketplace`）· **AI runtime 管理（`runtime`）** · 环境诊断（`doctor`）· 缓存管理（`cache`）· 全局用户级（`-g` + `~/.apm/`）

### 10.2 边界外侧（它不做）

| 不做 | 说明 |
|---|---|
| **运行时动态加载** | 静态复制部署；无按需加载机制 |
| **经验语义** | 无 validation 三档 · 无 verify/verdict · 无回流 · 无源信号 provenance |
| **"沉淀"** | 无 capture / learn / record —— 它是**消费者**（按声明装），不是生产者（从使用中积累） |
| **机器级全量对账** | `audit` 只对当前项目；不回答"本机所有 Agent 装了什么、哪些是外来的" |
| **准入控制** | 无"装哪些、装多少"的上限策略（仅有可执行原语审批） |
| **运行时框架** | 不做 agent loop（我们也不做） |
| **常驻服务** | 无 |

### 10.3 内置宿主 target 全集（源码提取，权威）

```
agent-skills · agents · agy · antigravity · claude · codex · copilot · cursor ·
gemini · grok-build · hermes · intellij · kiro · openclaw · opencode · vscode · windsurf
（实验：copilot-app · copilot-cowork · grok-cloud）
```

**❌ 不支持：`pi` · `workbuddy` · `dsh`**

### 10.4 pi 支持核查

- **pi 是什么**（本仓 [pi 调研](2026-08-28-pi-research.md)）：Mario Zechner 的极简编码 Agent（TS monorepo），**OpenClaw 的内核**；skill = 目录 + `SKILL.md`（frontmatter），与 Claude Code / Codex CLI / Amp / Droid 互兼容；分发走 npm（`pi install npm:<pkg>`）；本仓结论「**pi 不是竞品，是管道与盟友**」
- **APM 支持吗**：❌ **源码内置 target 里没有 `pi`**
  - 唯一间接路径：APM 有 `openclaw` target（实验，**仅 skills**），而 pi 是 OpenClaw 的内核 —— **不等于支持 pi**
- **影响**：本仓已定"把 pi 列入宿主矩阵与兼容声明"（pi 调研 §四）。若采用 APM，**pi 需我们自补 target**，或走 `.agents/skills/` 共识目录（**pi 是否读该目录未确认**）

### 10.5 与「我们已有能力」的重叠分析

| # | APM 能力 | 我们已有的 | 重叠 |
|---|---|---|---|
| 1 | 宿主注册表 + 探测（17 target） | `wiring/hosts.ts`（5 宿主）+ 在册提案 `host-matrix-alignment`（→9，含 Hermes / WorkBuddy / dsh / OpenCode） | 🔴 **高度重叠** |
| 2 | 宿主 skills 目录部署 | 在册提案 `host-integration`（I1/I3，**symlink 优先**） | 🔴 **高度重叠**（差异：APM 复制式 · APM 无准入控制） |
| 3 | 宿主 MCP 配置写入 | `wiring/snippets.ts` 只写**自己那一条** | 🟡 部分重叠（APM 管任意 MCP → 13 类 schema） |
| 4 | 装载 / 卸载 / 更新 | `install.ts` · `deleteSkill` · `lifecycle.ts` · `sync.ts` | 🟡 部分重叠（对象不同：我们=经验技能，APM=任意包） |
| 5 | 依赖与版本声明 | `skill.json5.dependencies{env,bins,packages}` + `version`（只做存在性预检） | 🟡 部分重叠 |
| 6 | 溯源 | `lifecycle.provenance`（sig_id / base_url / topic / validation / synced_at） | 🟡 部分重叠（**我们溯源到平台信号，APM 溯源到 git 包**） |
| 7 | 对账 | ❌ 无（`host-integration` I9 提案有五态对账） | 🟡 与在册提案重叠 |
| 8 | 渐进加载 | `layers.ts` 四态加载 + `search_skills` / `load_skill_detail` | 🟢 概念重叠、实现不同（我们更细：四态 + 参数四来源链） |
| 9 | 缓存 | Orama 索引（`index/dump.json` + version） | 🟢 概念重叠 |
| 10 | 发布 / 分发 | 平台 `/skills` + `skills/agentsignal-participant` 镜像 + `npx skills add` 布局 | 🟢 形态不同 |
| 11 | **可执行原语审批** | ❌ 无 | ⚪ **无重叠 → 可吸收** |
| 12 | **runtime 管理** | ❌ 无 | ⚪ **无重叠 → 可吸收** |

**结论：三处高度/部分重叠（#1 #2 #7），且恰好落在我们两个在册提案上**——`host-matrix-alignment`（宿主矩阵）与 `host-integration`（宿主装载 + 对账）。
**即：若采用 APM，这两个提案的大部分工作量将失去意义，需要合并/改立。**

**我们独有、APM 没有的**：经验语义（validation / verify / 回流 / 信号 provenance）· 订阅同步（平台→本地）· 记忆 · 准入控制（`min_validation` × 用户启用 × `max_installed`）· WorkBuddy / dsh / **pi** 宿主。

## 十一、架构扩展性评估（2026-09-11 源码核查）

### 11.1 扩展性分三档

| 扩展类型 | 难度 | 依据 |
|---|---|---|
| **加"文件类"宿主**（如 pi） | 🟢 **容易** | `integration/targets.py` 文件头明写：*"Adding a new target means adding an entry to `KNOWN_TARGETS` -- **no new classes required**"*；第 245 行补充 *"Adding a new target now requires only a single `KNOWN_TARGETS` entry"* —— 作者**专门重构过**，把原先散在 4 个文件的 `if/elif` 链收敛为声明字段 |
| **给新宿主加 MCP 支持** | 🟡 **中等** | 需另写 `adapters/client/<host>.py`（各家 MCP schema 不同：JSON / TOML / YAML + 字段名差异）；现有 12 个宿主适配器类 |
| **加新 primitive 类型**（第八类） | 🔴 **较重** | 需写新的 `*_integrator.py` + 格式转换逻辑（转换散落在 integrators，也是实测"映射有损"的根源） |

**三层结构**：`core/target_catalog.py`（命令面能力）→ `integration/targets.py` 的 `KNOWN_TARGETS`（部署面，**数据驱动**）→ `integration/*_integrator.py`（每个原语一个转换器）。

### 11.2 但有三处"不合适"

| # | 问题 | 证据 |
|---|---|---|
| 1 | **没有第三方扩展点** | `apm_cli-0.30.0.dist-info/entry_points.txt` 只有一行 `apm = apm_cli.cli:main`；**无 `apm.targets` 之类插件组**。`KNOWN_TARGETS` 是**包内硬编码 dict** → 扩展 = **改源码 / fork / 提上游 PR**，不是"装扩展包" |
| 2 | **语言不对** | 扩展面是 **Python**；我们 Node 栈 → 加 pi 宿主 = 用 Python 写 + fork 维护 + 跟上上游 **1,960 commits** 的迭代 |
| 3 | **模型不对位（最根本）** | primitive 模型是**声明式资产**（instructions / skills / prompts / agents / commands / hooks / mcp）——**没有任何位置能放"从使用中学到的经验"**。我们的四件（validation / verify / 回流 / 记忆）在它模型里**无落脚点**，硬塞会扭曲其语义 |

### 11.3 结论

- 扩展它「**加宿主**」→ 技术上好做（声明式），但**不划算**（Python + fork 维护 + 追上游）
- 扩展它「**装我们的经验语义**」→ **不合适**，模型不对位
- **正确姿势：不扩展它，与它互操作**（格式对齐 + 可选调用），把真正的扩展点留给我们自己的 Node 侧

## 十二、包解剖与「构建产物」世界观（2026-09-11 补，来源：package-anatomy）

### 12.1 一个包 = 清单 + 源码树

```
my-pkg/
├── apm.yml          # 必需（name + version 两字段即可）
├── apm.lock.yaml    # 生成物，须提交
├── apm_modules/     # 生成物，须 gitignore
└── .apm/            # ← 唯一编辑处（源码树）
    ├── instructions/      # 绑文件 glob 的常开规则
    ├── skills/<name>/SKILL.md
    ├── prompts/           # *.prompt.md
    ├── agents/            # *.agent.md
    ├── context/           # 共享上下文片段（不单独加载）
    └── hooks/             # 生命周期钩子
```

其余（`.github/` `.claude/` `.cursor/` `.codex/` `AGENTS.md` `GEMINI.md`）**全部是构建产物**。

### 12.2 `apm.yml` 全字段（格式对齐的直接规格）

| 字段 | 必填 | 说明 |
|---|---|---|
| `name` | ✅ | 包名 |
| `version` | ✅ | SemVer 字符串（数字须加引号） |
| `description` · `author` · `license` · `homepage` · `repository` · `keywords` | ❌ | 元数据；后三者由 `apm pack` 透传到 `plugin.json` |
| `type` | ❌ | `instructions` / `skill` / `hybrid` / `prompts` |
| `targets`（旧 `target`） | ❌ | 固定编译到哪些 harness |
| `includes` | ❌ | `auto` 或显式仓库路径列表 |
| `dependencies.{apm,mcp}` | ❌ | 两类依赖（原语 / MCP server） |
| `devDependencies` | ❌ | 同构；**`apm pack` 排除** |
| `scripts` | ❌ | `apm run <name>` |

### 12.3 ⚠️ 世界观差异（对我们最重要的一条）

APM 文档明写：**部署目录（`.claude/` 等）都是构建产物**——「只能在 `.apm/` 下编辑源码，然后重新运行 `apm install`，**绝不要直接编辑已部署的副本**」。

**这不只是"复制 vs 链接"的取舍，是两套世界观：**

| | APM | 我们原定 |
|---|---|---|
| 宿主目录的定位 | **构建产物**（可重建、可哈希校验，手改即漂移） | **引用视图**（symlink 自动跟随上游） |
| 上游更新 | 重跑 `apm install` | 自动生效 |
| 可校验性 | ✅ 逐文件哈希 + `apm audit` | ❌ 只能看指向 |

> **结论：symlink 引用式在 APM 的模型里是反模式。** 两条路不能混用——选一条，就得接受它的整套世界观（含"别直接编辑部署目录"这条纪律）。

## 十三、全仓 Review 与最佳路线（2026-09-11 · 源码级）

来源：`/Users/embaobao/workspace/open-source/apm`（v0.30.0）

### 13.1 四条决定性发现

**① 它不只是工具，是在推一套规格 —— OpenAPM v0.1**
- `docs/src/content/docs/specs/openapm-v0.1.md`（**242 KB**）· 124 条 requirement（`req-xx-nnn`）· 四类 conformance class：**Producer / Consumer / Registry / Governance**
- 机械门禁：spec 锚点 == 清单 == Appendix C == `@pytest.mark.req` marker（`orphan_check.py`）+ Mode B 检测 + 重生 `CONFORMANCE.{md,json}` 并 `git diff --exit-code`
- **Registry 的 wire contract 在 v0.1 明确"not normative"，保留给 v0.2** → **注册中心这块尚未定形**

**② `PRINCIPLES.md` 是"拒绝契约"（rejection contract）——两条直接卡我们**

| 原则 | 内容 | 对我们的影响 |
|---|---|---|
| **P1 — No invented primitive frontmatter** | 不发明 `apm-*` 键；**产物必须在消费方 harness 里零 APM 工具也能读** | 🔴 **我们的 `skill.json5`（layers / triggers / domains）正是"私有元数据"，被直接拒绝** |
| **P2 — Multi-harness with traction gating** | **只支持有真实用户量的 harness，明确"不追长尾"**；加新 harness 需 citable traction | 🔴 **pi / workbuddy / dsh 政策上不会被上游接受**（不是能力问题，是政策拒绝）；要加只能 fork |
| P3 · P4 · P5 · P6 · P7 | 厂商中立 · UX 不可让路 · 可移植优先 · 无静默归一化/黑箱启发式 · 社区优先 | 🟢 与我们一致 |

**③ 官方自述的四条边界（`concepts/what-is-apm.md` §What APM is not）**

> **Not a runtime · Not an LLM gateway · Not a fine-tuning tool · Not a marketplace**

→ 这四条**恰好把我们的位置空出来了**：APM 是**下层底座**，不是竞争者。

**④ 无第三方扩展 API · 但工程纪律极强**

| 项 | 事实 |
|---|---|
| 扩展点 | `pyproject.toml` 只有 `[project.scripts]`，**无 `[project.entry-points]`** → 扩展只能**仓内 / fork** |
| 扩展方式 | 加 target = 往 `KNOWN_TARGETS`（+`TARGET_CAPABILITIES`）加一条；加 integrator 有强制契约（`integrators.instructions.md`） |
| 质量门禁 | ruff + **pylint R0801 重复度** + File-length guardrail + **架构边界 linter** + **单一规范所有者注册表**（`.apm/architecture/owners/`）+ merge-gate 单门 + 夜间 mutation |
| 测试 | **1000+ 测试文件**（unit ≥500 · integration 380）+ spec conformance 套件 + red_team（6 主题）+ benchmarks |
| 已知弱项 | **mypy 有配置但 CI/pre-commit 均未执行**（type gate 实缺）；若干文档路径漂移 |
| 迭代速度 | 2026-05→09 从 0.9 到 **0.30**（**约每周一小版**），CHANGELOG 已 225 KB，**含 BREAKING** |

**⑤ 确认无「经验 / 记忆 / 学习 / 回流」能力**
定向搜索 `self-improv|learning loop|experience store|memory store|feedback loop|outcome tracking|lesson` → **全仓 0 命中**。命中的 `memory` 全是宿主既有文件概念（`CLAUDE.md` / Windsurf global memory / 内存缓存），不是学习机制。

### 13.2 最佳路线：**站在它的装载层之上，做经验层**

| 路线 | 判定 | 理由 |
|---|---|---|
| **A. 复刻**（bun/node/rust） | ❌ **否决** | 169k 行 + 1000+ 测试 + 242KB 规范 + **每周一小版含 BREAKING**，追不上；且 bun/rust 撞 [D1 决议](../../decisions/2026-08-28-standardize-node-postgres.md) |
| **B. 全量采用（spawn APM）** | ⚠️ **不作主线** | P2 注定拿不到 pi/workbuddy/dsh；P1 禁止我们的私有元数据进产物；复制式；引 Python；0.x 每周 BREAKING；我们两个在册提案要作废 |
| **C. 只拿它无重叠的强项**（MCP 管理 / runtime 管理 / 安全扫描） | ✅ **采纳为可选增强** | 这两块我们完全没有，且它做得细；**按需 spawn，用户没装 APM 就降级** |
| **D. 格式对齐 + 互操作**（读写 `apm.yml`），装载自己做 | ✅ **采纳为主线** | 保住 symlink · pi/workbuddy/dsh · 准入控制 · 本地私有元数据；且搭上正在成形的规格 |

**D 的关键设计（同时满足 P1 与我们的检索需求）**：

```
产物层（出得去）  = 标准 SKILL.md + frontmatter        ← 零 APM 工具可读，符合 P1
本地层（留得下）  = skill.json5（layers / triggers / domains）← 私有增强，不进产物
```

→ **标准部分出去、增强部分留下**。这样我们的经验物化后，任何 APM 用户 / 任何宿主都能直接读；而我们的检索能力不受损。

### 13.3 分期建议

| 期 | 内容 |
|---|---|
| **P0** | 产物规范化：`SKILL.md` 补 frontmatter（对齐 agentskills.io / P1）；私有元数据显式声明为"本地增强、不进产物" |
| **P1** | 导出器：把本地技能导出成 `apm.yml` + `.apm/skills/<name>/SKILL.md` 布局 |
| **P2** | 导入器：读入外部 `apm.yml`，映射为本地技能（保留 provenance） |
| **P3** | 可选增强（C）：检测到用户已装 APM 时，代理其 MCP 管理 / runtime 管理 / 安全扫描；未装则降级 |

**与在册提案的关系**：`host-matrix-alignment` 与 `host-integration` **保留不变**（我们仍自建装载，因为 P2 拿不到 pi 等长尾、且我们要 symlink）。→ **不废提案**。

### 13.4 值得单独吸收的一条（与 APM 能力无关）

APM 用**一整套 AI agent 机制管自己的开源项目**：`PRINCIPLES.md`（拒绝契约）→ `apm-ceo` 仲裁 persona → `triage-panel` / `pr-review-panel`（**advisory**）/ `batch-bug-shepherd`（**executive**）+ gh-aw 编译的 workflow，写面用 `safe-outputs` 收敛（add-comment max 2 / remove-labels max 3）。
→ 与我们 [agent-dev-paradigm](../../design/agent-dev-paradigm.md) 同向，其"**原则编号引用 + 执行权分级（advisory vs executive）**"两点可直接借鉴。

## 关联

- [2026-09-10 skill-management-landscape](2026-09-10-skill-management-landscape.md)（分层方案 + skills-manager）
- [2026-09-11 mcp-hosting-management-trio](2026-09-11-mcp-hosting-management-trio.md)（mcp-gateway / skills-manager / mcphub）
- [2026-09-11 agent-skill-layered-management](2026-09-11-agent-skill-layered-management.md)（分层 Skill 构想稿）
- [2026-09-09 semantic-router-evaluation](2026-09-09-semantic-router-evaluation.md)

## 未核实项（不推测）

1. `plugins` 是否为正式 primitive（README 与 targets matrix 不一致）
2. 版本号与发布时间（页面未渲染时间戳）

**已由实测澄清（§八）**：`apm install` = **复制式**（非符号链接、非硬链接，且无链接模式选项）

**已澄清（2026-09-11 补充）**：

- **MCP 管理**：支持，机制见 §五之二
- **卸载**：**无独立 `uninstall` 命令**；靠"重装时移除 target"清理 APM 管理的条目
- **registry**：有 `apm marketplace add <repo>`（策展式注册表）+ 直接引用官方 **MCP Registry**；本体不发布到 npm
- **机器级安装**：**有** `apm install -g --mcp`，写 `~/.apm/apm.yml`
