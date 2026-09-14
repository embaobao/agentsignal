# 进度台账：host-matrix-alignment（追加式，只增不改）

| 日期 | 席/会话 | 任务 | 结果 | 提交 |
|---|---|---|---|---|
| 2026-09-12 | 夜间通用轨（00:00 轮） | 1.1+1.5 Hermes 打底：HostId 加 hermes · HostDef 增 soulPath/hooksYamlPath/hookAllowlistPath · mcpPath 放宽 string|null（D1/D7）· snippets 三族 null 守卫（wire/status/unwire·toml 族·extra 族）零垃圾断言 · protocol HostBindingSchema.host 枚举加 hermes（config 真源闭环，三提案协调点打底首步）；wizard 断言 5→6 宿主；CLI 117/117 · check/lint 绿 | ✅ 待审查 | `e7fc8f2`
| 2026-09-12 | 夜间通用轨（00:00 轮） | 2.4+2.5 hosts.ts 文件头注释清偿——删 Trae 漂移（按授权夜间保守选「删注释」，站长可翻案）+ 写入 D7 不猜 MCP 纪律 | ✅ 待审查 | `480c128`
| 2026-09-12 | 夜间通用轨（02:00 轮） | 1.3 SOUL.md 块注入——新 wiring/soul.ts（injectSoulBlock 幂等/create-or-append·removeSoulBlock 只删标记段+多余空行清理·tmp+rename）+ 接线 snippets writeExtra/removeExtra hermes 分支（rules 兜底=SOUL.md 块）；wiring-hermes 零垃圾断言升级（仅 SOUL.md·无 MCP 文件）；新测试 wiring-soul.test.ts 6 用例，CLI 132/132 · check/lint 绿 | ✅ 待审查 | `1ed81f3`
| 2026-09-12 | 夜间通用轨（04:00 轮） | 1.4 hook 双写——新 wiring/hooksYaml.ts（config.yaml 行级 hooks.<event>[] 注入/摘除·E-10 只碰自己条目·按 (event,command) 幂等）+ allowlist.json 去重双写（tmp+rename）；修幂等粒度 bug（首版按 command 判重会漏同命令多 event）；wiring-hermeshook.test.ts 5 用例，CLI 137/137 · check/lint 绿；顺带回填 LCP C3 台账行最终 sha 59e7834 | ✅ 待审查 | `b905829`
| 2026-09-12 | 夜间通用轨（06:00 修复轮） | R5-a 审查整改（席6 报，限 1.7 前闭环）——removeYamlHook 由整块删除改逐条删除（同 event 块用户自有 command 毫发无损·块删空才清 event 键）；红测先行抓出测试漏 import 即修；CLI 138/138 · check/lint 绿 | ✅ 待审查 | `dda2731`
| 2026-09-13 | 夜间通用轨（00:00 轮） | 1.2 Hermes skills 目录式落盘——新 wiring/hostSkills.ts（writeHostSkill 产物渲染复用 renderArtifactSkillMd·宿主侧仅 SKILL.md 内部形式零泄漏·SKILL_ID_PATTERN 白名单 fail-fast·removeHostSkill 只删自己条目零残留+foreign 不动）；init 全链接线留 1.9 走查；修测试两处（非法 id 统一 fail-fast 断言）；CLI 150/150 · check/lint 绿 | ✅ 待审查 | `29b5f3d`
| 2026-09-14 | 夜间通用轨（02:00 轮） | 1.6 事件映射——context.ts 增 parseEventArg（--event 提取）+ mapHookEvent（SessionStart/未知→push·Stop→noop 静默早退，不硬造收尾语义）；未初始化静默契约顺带覆盖；CLI 181/181 · check/lint 绿 | ✅ 待审查 | `c0ba0cd`
| 2026-09-14 | 夜间通用轨（04:00 轮） | 1.7 兜底——writeExtra hermes 分支整体 try/catch（落盘失败 stderr 可见告警+extra=none 降级只发 skill 不 fail init，EISDIR 占位夹具红测）+ hook 命令带 --event SessionStart（1.6 映射消费）；wiring-hermes 零垃圾断言升级为固定三件产物（SOUL.md/config.yaml/allowlist 无 MCP 文件）；（原注「Shim 顺手清」归属笔误：实为 LCP 轮 03f474f 清）；CLI 182/182 · check/lint 0 警告 | ✅ 待审查 | `9771e13`
| 2026-09-15 | 夜间通用轨（00:00 轮） | 1.8 测试收口——核对 design §五：三断言（探测/写入/摘除）与专项 3 条已被 1.1–1.7 单元测试分摊覆盖（wiring-hermes/hostskill/hermeshook/soul 四文件 19 用例）；本笔补「探测命中」用例闭最后缺口；Phase 1 夜间面只剩 1.9 真机走查（站长项）；CLI 191/191 · check/lint 绿 | ✅ 待审查 | `d4c6d41`
