# 进度台账：host-matrix-alignment（追加式，只增不改）

| 日期 | 席/会话 | 任务 | 结果 | 提交 |
|---|---|---|---|---|
| 2026-09-12 | 夜间通用轨（00:00 轮） | 1.1+1.5 Hermes 打底：HostId 加 hermes · HostDef 增 soulPath/hooksYamlPath/hookAllowlistPath · mcpPath 放宽 string|null（D1/D7）· snippets 三族 null 守卫（wire/status/unwire·toml 族·extra 族）零垃圾断言 · protocol HostBindingSchema.host 枚举加 hermes（config 真源闭环，三提案协调点打底首步）；wizard 断言 5→6 宿主；CLI 117/117 · check/lint 绿 | ✅ 待审查 | `7df4dc4`
| 2026-09-12 | 夜间通用轨（00:00 轮） | 2.4+2.5 hosts.ts 文件头注释清偿——删 Trae 漂移（按授权夜间保守选「删注释」，站长可翻案）+ 写入 D7 不猜 MCP 纪律 | ✅ 待审查 | `d8878e8`
| 2026-09-12 | 夜间通用轨（02:00 轮） | 1.3 SOUL.md 块注入——新 wiring/soul.ts（injectSoulBlock 幂等/create-or-append·removeSoulBlock 只删标记段+多余空行清理·tmp+rename）+ 接线 snippets writeExtra/removeExtra hermes 分支（rules 兜底=SOUL.md 块）；wiring-hermes 零垃圾断言升级（仅 SOUL.md·无 MCP 文件）；新测试 wiring-soul.test.ts 6 用例，CLI 132/132 · check/lint 绿 | ✅ 待审查 | `4695c58`
