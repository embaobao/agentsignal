# 任务：本地能力面（local-capability-plane）—— 执行版（夜间多 Agent 流水线）

> 状态：**执行中**（决议 [2026-09-11-local-capability-plane](../../../docs/decisions/2026-09-11-local-capability-plane.md) ✅ 已签发 2026-09-11）
> 执行范式：**夜间四席流水线**（23:00 后免额窗口；会话模型 flash 档 → 小颗粒 · 强处方 · 夜夜审查）
> 口径：node:test 单测 + `AGENTSIGNAL_HOME` 临时夹具；**不碰真实宿主配置**；`pnpm verify` 全绿为每任务出口
> 五件套：[proposal.md](proposal.md)（为什么）· [design.md](design.md)（细节/降级/场景 S1–S16）· 本文件（执行）· [templates.md](templates.md)（模板）· **[progress.md](progress.md)（进度台账，每席收尾必追加）**

---

## 〇、执行体系（所有会话先读本节）

### 0.1 夜间流水线（七席 · 写串行 / 读并行 · 免额窗口 23:00–08:00）

| # | 席 | 会话 | 时间 | 职责 | 并发性 |
|---|---|---|---|---|---|
| 1 | 主轨开发 | zcode | 23:00（≤120m） | **轨道 A**：取任务→实现→测试→commit | 写·**串行** |
| 2 | 副轨开发 | zcode-2 | 01:00（≤120m） | **轨道 B**：同上 | 写·**串行** |
| 3 | 基建轨 | zcode-3 | 03:00（≤120m） | **轨道 C**：测试基建 · 场景壳 · 台账脚本 · 性能基线 · 手册随行 | 写·**串行** |
| 4 | 审查·规范 | zcode-5 | 05:00（≤90m） | DoD 与台账一致性 → `reviews/<date>-dod.md` | 读·**并行** |
| 5 | 审查·测试 | zcode-6 | 05:00（≤90m） | 测试真实性与覆盖 → `reviews/<date>-test.md` | 读·**并行** |
| 6 | 审查·红线 | zcode-7 | 05:00（≤90m） | 安全与红线七条 → `reviews/<date>-redline.md` | 读·**并行** |
| 7 | 汇总修复 | zcode-4 | 06:30（≤90m） | 合并三份报告 → 定稿 `tasks.md` + 修复 + 全量 verify | 写·**串行** |

**并发原则**：
- **写轨串行**（避免 `git index.lock` 互锁与同文件冲突）；**读轨并行**（三审查席只写各自独立报告文件）
- **审查席禁止并行写 `tasks.md`**；**`tasks.md` 定稿权唯一归汇总席**
- **审查席不做任何 git 写操作**（报告由汇总席统一提交），彻底消除读席之间的写冲突

**轨道划分（文件域隔离）**：
- 轨道 A = P0 → P1 → P2 → P3（`capability/` 骨架与适配器 · `wiring/hosts.ts` · `AGENTS.md` 定位）
- 轨道 B = P5 → P4 → P7 → P8（`skills/` 内核 · providers · 面板 · 包源/运行时/动态加载）
- 轨道 C = 验证工程与基建（`packages/cli/test/**` · `scripts/**` · `reviews/**` · 手册随行）→ 见 §九之一
- 交叉文件（如 `skills/status.ts`）：**先读当前内容再改，不回退对方已合入的改动**

**接棒检查（每席第 0 步，必做）**：若工作区有未提交改动 → 判断归属：属上一席的**原子边界**（测试绿、可独立提交）→ 直接 commit 并记台账；否则按 §0.6 阻塞处理，**不覆盖、不回退**。

### 0.2 任务状态机（开放任务协议）

```
[ ] 待认领 → [~] 认领中（记会话名+进度） → [x] 开发完成 → 审查通过（终态）
                    ↑__________ 审查驳回（带原因）__________|
```

- 开发席：只取**本轨道第一个 `[ ]`**；依赖未勾不取；★门任务**不得编码**（输出门请求后结束）
- **任务自包含**：背景 / 文件 / DoD 齐备——任何会话（含社区贡献者）都能认领，无隐藏依赖
- `[x]` 但未过审查 ≠ 完成

### 0.3 溢出协议（上下文 / 时长不够时）

1. 停在**原子边界**（一个测试绿的点）2. `git commit`（**绝不留未提交改动**）3. 在任务行下写交接注记（templates §二）4. 结束会话。
**禁止**：跨原子边界硬撑、丢弃已写代码不提交。

### 0.4 验证失败协议

- 开发席内 30 分钟修不绿 → 任务回 `[~]` + 失败注记（templates §三）→ 结束
- 修复席（06:00）接手：修绿 → `[x]`；仍不绿 → §0.6 阻塞区登记
- **同一任务连续两夜失败** → 冻结该任务 + 升级报告（templates §六），轨道跳下一任务

### 0.5 审查协议（04:00 席）

按 templates §四清单逐项审：DoD 逐条 / 红线七条 / 测试真实新增并跑过 / 勾选与提交一致 / 降级可见 / git status 干净。
产出：`✅通过` / `🔴驳回（任务回 [~] + 原因）` / `🟡警告`。**不改码**（仅 tasks.md 勾选修正可提交）。

### 0.6 阻塞报告区（修复席写入；处理完即删）

> （空）

### 0.7 进度台账（progress.md · 追加式）

**每席每次会话收尾前必须追加一条**（日期 · 席名 · 任务编号 · 结果 · 提交 sha）——「可记录 / 可追溯 / 可更新」的强制出口：

- **可记录**：无台账条目 = 该席当夜未工作，审查席报告
- **可追溯**：每条含 commit sha，台账 ↔ git log 双向可对
- **可更新**：条目只追加不重写；状态变化（驳回→修复）逐次追加新条目
- **口径豁免（2026-09-12 汇总席定）**：sha 修正/回填笔视为「勘误性追加」的合法形态（amend 自指悖论——本笔 sha 无法写进本笔），对账主键是任务号（`scripts/check-ledger.mjs` 同口径）；已有新条目背书的就地 sha 勘误不算重写

### 0.8 并发不足时的兼容降级（尽量多做，绝不空转）

| 档 | 触发条件 | 做法 |
|---|---|---|
| **P-1 全开** | 平台允许并发 | 三写串行 + 三读并行（§0.1 表） |
| **P-2 读席受限** | 不能同时跑 3 个读席 | 单读席内 spawn 3 个**只读子代理**并行（各写独立报告），主读席汇总 |
| **P-3 子代理不可用** | 连子代理也没有 | 同一席按 **规范 → 测试 → 红线** 顺序过三遍清单（时间换并发） |
| **P-4 窗口不足** | 夜间窗口 < 6h | 保写轨（A/B/C 轮转，每晚 2 席）；审查合并 1 席 + **次日补审** |

**硬约束**：**任何降档都不取消审查**——质量门不可降级，只能压缩维度或延后，**不能跳过**。

### 0.9 并发与提交安全（写轨共同遵守）

- 一次只允许一席持有 git 写权；提交前 `git status` 确认无他人未提交产物
- 若遇 `index.lock` 冲突：等待 30s 重试一次；仍失败 → 视为§0.6 阻塞，不强行 `rm` 锁文件
- 大改动拆小提交（每任务 1 提交），**缩短 git 占用窗口**

---

## 一、阶段总览

| 期 | 主题 | 轨道 | 一句话目标 | 依赖 | 夜数 |
|---|---|---|---|---|---|
| **P0** | 产物规范化 | A | 产物**零工具可读** | — | 2 |
| **P1** | 适配器骨架 + APM | A | 接口跑通 | P0 | 5 |
| **P5** | 经验层收口 | B | verify_target + 三计数 | P0 | 3 |
| **P2** | native 适配器 | A | 宿主技能目录装载 + 对账 | P1 | 4 |
| **P3** | 长尾宿主 + 插件双轨 | A | pi / dsh / workbuddy | P2 | 3+★ |
| **P4** | 互操作 | B | `apm.yml` 导入导出 | P1 | 2 |
| **P7** | 模型接入 + 面板 | B | 国产全模型配置包 + 面板四区 | P4 | 3+★ |
| **P8** | 运行时 + 依赖 + 动态加载 | B | 拉起 / 白名单安装 / 热切换 | P7 | 3+★ |
| **C** | 验证工程与基建 | C | 场景壳 · 契约套件 · 台账脚本 · 性能基线 · 手册随行 | — | 3 |
| **P6** | 记忆层 | — | 独立立项 | P5 | ⏸ |

> **轨道 A 共 14 夜，轨道 B 共 11 夜**（并行流水）→ 关键路径 ≈ **14 夜 + 6 道门**。

---

## 二、P0 —— 产物规范化【轨道 A】

- [x] **0.1** `AGENTS.md` 定位更新（决议 D1/D2：经验层 + 本地能力面）；当前阶段刷为 P0
  - DoD：三节与决议一致；`docs/README.md` 阶段行同步
- [x] **0.2** `packages/protocol/src/skill-schema.ts`：产物 frontmatter（`name`/`description` 必填；`name`=目录名）
  - DoD：schema+校验导出；私有层字段（`layers`/`triggers`/`domains`）**不进产物 schema**
- [x] **0.3** `packages/cli/src/skills/transcoder.ts` + `install.ts`：落库生成/校验 frontmatter
  - DoD：产物 `SKILL.md` 首部合规；私有增强只进 `skill.json5`
- [x] **0.4** 快照测试：产物结构 + frontmatter + **旧技能零破坏**（旧样例升级路径夹具）
  - DoD：`pnpm verify` 全绿；正/旧两版样例（artifact-snapshot.test.ts 三用例：产物字节级快照/私有键零泄漏/旧库全链零破坏；verify 全链受 Docker 阻塞，替代口径 check+lint+CLI 141/141 绿留痕，Docker 可用次日补跑）
- [ ] **0.5** ★门 **G-A（P0 出口）**：站长真机抽验——产物丢进无 AgentSignal 环境的宿主直接可用（**不编码**，输出抽验清单）（**门请求已发出 2026-09-12 夜，见 progress.md 抽验清单——等站长真机**）

---

## 三、P1 —— 适配器骨架 + APM【轨道 A】

> 新目录 `packages/cli/src/capability/`

- [x] **1.1** `capability/types.ts`：接口照 design §四（`PackageSource`/`CapabilityAdapter`/`Cap`/`DeployResult`…）
  - DoD：类型编译过；`DeployResult` 含 `ladder` + `skipped[].reason`（补齐 Availability/PackageRef/Package/Metadata/Item/RemoveResult/ReconcileReport 五态 + UnsupportedCapability/HostLockConflict 结构化错——三规则类型层落点）
- [ ] **1.2** `capability/caps.ts`：能力枚举**冻结（O10）** + 门控 `assertCap` → `UnsupportedCapability`
  - DoD：fake 适配器未声明能力被拒
- [ ] **1.3** `capability/ledger.ts`：归属账本（schema v1；**tmp+rename 原子写**；文件级互斥；委托快照 sha256）
  - DoD：并发写测试 + 快照断言
- [ ] **1.4** `capability/lock.ts`：归属锁（一宿主×一能力=一适配器；`HostLockConflict` 含持锁方）
  - DoD：冲突/释放/复得三断言
- [ ] **1.5** `capability/broker.ts`：适配器选择（用户声明优先→native 优先）；probe 不可用→换适配器**不报错**
  - DoD：fake 双适配器选择测试
- [ ] **1.6** `capability/adapters/apm.ts`：spawn `apm`；**`-g` 用户级**；`capabilities()` **不声明 `remove`**（实测无此命令）
  - DoD：spawn 沙箱测试；APM 缺席 `probe` 返回 `{available:false}`（S6 前半）
- [ ] **1.7** 契约测试（V0）：fake 适配器全覆盖四方法 × 门控 × 锁；降级矩阵第一条夹具
  - DoD：契约套件入库，verify 全绿
- [ ] **1.8** ★门 **G-B（P1 出口）**：① glossary 登记「能力面」canonical 命名 ② APM 真机 `probe/deploy/reconcile` 三方法实跑（**不编码**，输出词条草案 + 实跑清单）

---

## 四、P5 —— 经验层收口【轨道 B】

- [x] **5.1** `skill-schema.ts` + `packages/cli/src/skills/verify.ts`：`verify_target` 补实现（`{statement, checks[]}`）
  - DoD：三态判定可关联目标；旧 `skill.json5` 零破坏（null 兼容读）
- [x] **5.2** `transcoder.ts`：`provenance.origin` 补写入（平台订阅/包导入/手动）
  - DoD：新落库必有 origin；旧记录读 null 不报错
- [x] **5.3** `metrics.ts` + 检索/注入埋点：**三计数分立 `retrieved/injected/used`**（现状只 verify +1，S2 缺口）
  - DoD：三路径各 +1 断言（V1）（lifecycle.bumpSkillMetrics 批量计数·search_skills 命中 retrieved 埋点·loadDetail 成功 injected 埋点·used=use_count 语义零改名；**连带修生产级 bug：zod `.default(对象字面量)` 跨 parse 共享可变引用**——无 metrics 技能的 parse 结果原地改即全局污染，metrics/lifecycle 两处 default 改函数工厂；✅ 新缺口当轮闭环：全仓 6 处 `.default(对象字面量)` 已全部函数工厂化 + schema-defaults.test.ts 引用隔离防回归（2026-09-13 通用轨）
- [ ] **5.4** `status` 呈现验证结果（三态+上游+三计数，**不新增命令**）
  - DoD：夹具断言输出字段
- [ ] **5.5** S2/S3（本地半）场景测试入库
  - DoD：design §8.5 S2、S3-本地半 V1 层可执行且绿

---

## 五、P2 —— native 适配器【轨道 A】

- [ ] **2.1** `wiring/hosts.ts`：`HostDef` 增 `skillsPath`/`skillLayout`（复用 host-matrix-alignment）
  - DoD：5 宿主定义齐新字段
- [ ] **2.2** `capability/adapters/native.ts`：装载器 **symlink 优先**（跨卷/Windows 回退 copy；账本记 `mode`）
  - DoD：双模式夹具；S9 断言（symlink 跟随/copy 重写）
- [ ] **2.3** 对账器：五态 `active/outdated/revoked/missing/foreign`；**外来只读**
  - DoD：S7 夹具（模拟手改+外工具写入）五态正确
- [ ] **2.4** 准入控制：`min_validation` × 用户启用 × `max_installed`（**默认关**）
  - DoD：三开关组合测试
- [ ] **2.5** 卸载对等：只删账本内条目 + 空目录清理
  - DoD：S4 断言（卸 A 不影响 B · 零残留 · 本地库保留 · 重装恢复）
- [ ] **2.6** `status` 体检行：**watch 四信号**（§8.7）+ 降级落档呈现
  - DoD：四信号夹具断言；S5 断言（L2 落档+原因可见）
- [ ] **2.7** S5/S6 集成全绿 + **native 宿主集动态计算**（全集−当期 apm 覆盖集）
  - DoD：S5/S6 V1 绿；覆盖集计算单测

---

## 六、P3 —— 长尾宿主 + 插件双轨【轨道 A】

- [ ] **3.1** pi **适配轨**（宿主写入器）—— DoD：三态断言（夹具）
- [ ] **3.2** dsh **适配轨**（`~/.dsh/skills`）—— DoD：三态断言（夹具）
- [ ] **3.3** workbuddy 接入（`~/.workbuddy/...`）—— DoD：三态断言（夹具）
- [ ] **3.4** 宿主注册表**插件化**（外部贡献：指南 + fake 社区宿主测试模板）
- [ ] **3.5** ★门 **G-C**：pi/dsh **插件轨**（extension / `dsh plugin add`）需站长真机实测（**插件轨不编码**，输出实测步骤）
- [ ] **3.6** 适配轨收口：每宿主三态全绿 + `status` 呈现新宿主

---

## 七、P4 —— 互操作【轨道 B】

- [ ] **4.1** 导出器：本地技能 → `apm.yml` + `.apm/skills/<name>/SKILL.md` —— DoD：布局快照一致
- [ ] **4.2** 导入器：外部 `apm.yml` → 本地技能（origin=apm-import）—— DoD：溯源断言
- [ ] **4.3** 扩展 JSON：私有增强独立文件 —— DoD：S10 断言（往返无损 + **零泄漏**）
- [ ] **4.4** 往返测试全绿 + 用法进 `user-manual.md`

---

## 八、P7 —— 模型接入 + 面板扩展【轨道 B】

- [ ] **7.1** 供应商注册表：`capability/providers.json`（厂商·base_url·建议模型·文档链接）+ schema + 加载
  - DoD：加载校验测试；**新增厂商 = 只改数据文件**
- [ ] **7.2** 包模型 `providers` 段（provider ref + model 映射 + **token 引用**）
  - DoD：token 不进产物断言（并入 S10 零泄漏）
- [ ] **7.3** env 写入器：**接管确认 + 快照回滚 + 归属锁**；降级（宿主不支持→仅记录）
  - DoD：S11 前三步夹具（写入/切换/回滚）
- [ ] **7.4** 面板 B 视图四新区块（能力面/模型接入/健康信号/验证结果），承 management-ui-spec-v1 全红线
  - DoD：S12 断言；全站无「skills」；提交即关服不破
- [ ] **7.5** S11/S12 场景测试全绿（V1）
- [ ] **7.6** ★门 **G-E（P7 出口）**：站长真机——配一个国产端点（GLM/DeepSeek 任一），Claude Code 跑通 + 面板走查

---

## 九、P8 —— 运行时 + 依赖 + 动态加载【轨道 B】

- [ ] **8.1** `PackageSource` 三源：git（clone+sha 锁）/ npm（tarball）/ local —— DoD：三源 resolve/fetch 夹具（含离线降级）
- [ ] **8.2** 依赖显式安装：预检（现状）+ 安装命令（**白名单 · origin=npm-install · 默认关**）
  - DoD：S14 断言（白名单外拦截；绝不自动装）
- [ ] **8.3** 运行时拉起：pi spawn / apm runtime / 宿主 CLI **按需拉起**；账本记（谁·何时·退出码）
  - DoD：S13 断言（用完即退，无常驻）
- [ ] **8.4** 动态加载收口：热切换降级矩阵（pi 热切待 G-C；其余降级重载/提示）—— DoD：S15 断言（降级可见）
- [ ] **8.5** 分 Agent 管理：per-host 独立准入/计数/卸载隔离 —— DoD：S16 断言（两宿主互不影响）
- [ ] **8.6** ★门 **G-F（P8 出口）**：站长批准 npm 白名单机制 + 真机拉起一个远程 Agent 仓库

---

## 九之一、轨道 C —— 验证工程与基建（3 夜 · 独立文件域）

> 目的：把「验证能力」本身做成基础设施，供 A/B 轨复用，并为性能与手册提供基线与随行检查。

- [x] **C1** 场景测试骨架：`packages/cli/test/scenarios/` 建 **S1–S16 fixture 库 + 测试壳**（对照 design §8.5 逐条）
  - DoD：16 个壳文件存在且可跳过/待填充；fixture 构造器齐（无 L1 宿主 / 无 APM / 外部漂移 / 双适配器冲突 / 双宿主…）（S8 fakeAdapter 构造器待 P1 types 落地补，壳注记已标）✅ 2026-09-12 汇总席补审：scenarios/ 已纳入 CLI test glob（`test/**/*.test.ts`，todo 16 可见——壳静默缺口闭合）；各壳填充断言时保持 glob 覆盖
- [ ] **C2** 契约测试骨架（V0 层）：四方法 × 门控 × 锁的通用套件，供 A 轨适配器**直接套用**
  - DoD：fake 适配器跑通套件；**新适配器接入 = 3 行**
- [x] **C3** 台账一致性脚本 `scripts/check-ledger.mjs`：`tasks.md` ↔ `git log` ↔ `progress.md` 三方对账
  - DoD：能报出「勾了没提交 / 提交没勾 / 无台账条目 / 台账 sha 不存在」四类（按任务号对账为主键；sha 失效为 warning——amend 自指悖论已在脚本头注说明；首跑即暴露 host-matrix 0.1–0.4 历史无尾注勾选，留审查席裁定）
- [ ] **C4** 性能评估基线 `scripts/bench/`（**架构不限，bun/rust 可**）：检索 / 装配 / 对账三条关键路径
  - DoD：基线可重复跑并输出数字；**纳入参考，不入 CI 门禁**
- [ ] **C5** 手册随行检查：`user-manual` / participant SKILL / `admin-guide` 与 CLI 命令面一致性核对
  - DoD：检查清单产出 + 不一致项登记
- [ ] **C6** `reviews/` 约定落地 + 汇总席辅助脚本（三份报告 → 汇总清单）
  - DoD：模板与脚本可用；审查席一次跑通

---

## 十、P6 —— 记忆层

- ⏸ **独立立项**（本线只预留 optional 段）——P0–P8 完成后站长决定

---

## 十一、里程碑门汇总（任何会话遇门即停等站长）

| 门 | 位置 | 站长做什么 |
|---|---|---|
| **G-A** | 0.5 | 真机抽验「产物零工具可读」 |
| **G-B** | 1.8 | 定「能力面」命名 + APM 真机三方法 |
| **G-C** | 3.5 | pi / dsh 插件轨真机实测 |
| **G-E** | 7.6 | 国产端点真机跑通 + 面板走查 |
| **G-F** | 8.6 | 批准 npm 白名单 + 真机拉起远程 Agent |
| **G-D** | 终验 | A1–A7 真机清单 + S1–S16 完成报告 |

---

## 十二、终验清单（全部完成后）

- [ ] P0–P8 任务全部 `[x]` **且过审查**（P3 插件轨除外待 G-C；P8 白名单待 G-F）
- [ ] V0–V4 五层验证各绿（design §8.4；V2/V3 真机部分列站长项）
- [ ] S1–S16 场景状态报告（design §8.5 逐条）
- [ ] watch 四信号在 `status` 与面板可见（design §8.7）
- [ ] `AGENTS.md` 当前阶段刷至「本地能力面交付」
- [ ] 输出终验报告 → 站长执行归档

---

## 十三、跨期纪律（每席自查）

- 每任务出口 = **`pnpm verify` 全绿 + G1–G4 护栏绿 + 测试随行 + 审查通过**
- 适配器新增 = **契约测试 + 能力声明 + 归属锁**三件齐；宿主新增 = **探测/写入/摘除**三态齐
- 触碰 CLI 命令面 → **同 PR 同步 participant SKILL**（AGENTS.md §9）
- 账实同步：落地即勾台账 + 刷 `AGENTS.md` 阶段；手册随行（user-manual / participant / admin-guide）
- **降级纪律**：能力不可用 → 降档 + 可见 + 不静默（design §一）
- **采购纪律**：成熟三方包优先（活跃维护 · 许可合规 · 无常驻依赖）；自研仅限红线/无成熟包/过重；**核心 TS 单口径，辅助件不限架构**
- **夜间纪律**：全部会话在 23:00–08:00 窗口；白天零运行

---

## 十四、风险与缓解

| # | 风险 | 缓解 |
|---|---|---|
| 1 | **flash 档会话误判/跑偏** | 任务小颗粒 + 强处方（DoD 逐条）+ **夜夜审查席** + 驳回回滚机制 |
| 2 | 会话溢出 | §0.3 溢出协议：原子边界 + 交接注记 + 绝不留未提交 |
| 3 | 双轨同文件冲突 | 文件域隔离 + 先读后改 + 交叉文件清单 |
| 4 | 验证反复失败 | §0.4：两夜失败冻结 + 升级报告，不空转烧夜 |
| 5 | token / 凭证泄漏 | 并入 S10 零泄漏断言；私有配置 0600 |
| 6 | npm 供应链 | 白名单 + 显式安装 + origin 溯源；**默认关** |
| 7 | 引入 APM 抬门槛 | 适配器可选+降级（S6） |
| 8 | APM 升级漂移 | 覆盖集动态计算 + 重对账（2.7） |
| 9 | 长尾宿主参差 | 逐宿主三态实测（G-C），未实测不入册 |
