# C5 手册随行检查清单（轨道 C · 2026-09-15 席3）

## 命令面 ↔ 三手册覆盖矩阵

| 命令 | user-manual | participant SKILL | admin-guide | 结论 |
|---|---|---|---|---|
| init | ✓(9处) | ✓ | ✓ | 一致 |
| mcp / status / uninstall | ✓ | ✓ | ✓ | 一致 |
| register / publish / query / use / verify / validate | ✓(§2 命令面清单) | ✓ | —（用户域，管理册不涉） | 一致 |
| me / ls / edit / rm | ✓(§2) | ✓ | — | 一致 |
| context（推通道） | ✗ | ✗ | ✗ | **正确**——内部 hook 命令，设计为不进 USAGE/命令面护栏/手册 |

## 不一致项

**零 P0 不一致。**

## 随行预留（未上线能力，随下次发版 0.6.0 入册——非当前不一致）

1. Hermes 宿主接线（host-matrix 1.1–1.7：三件产物 SOUL.md/config.yaml/allowlist）→ user-manual §1.5 宿主清单 + admin-guide
2. status「验证体检」行（5.4：三态+三计数+上游溯源）→ user-manual status 段
3. 产物 SKILL.md frontmatter 首部（P0.3，零工具可读）→ user-manual use --install 段
4. 本地能力面 broker/ledger/lock（P1 三规则）→ admin-guide 新章（随 G-B 门命名定稿）
5. P4 互操作导出/导入用法（apm.yml 往返 + extensions.json5 私有增强随行）→ user-manual 新节（4.4 DoD 条目，随 0.6.0 入册——2026-09-16 席 2 登记）

## 依据

§11 双手册纪律「手册只写已上线能力」——上述 1–4 均未随 0.5.0 发版，登记等待而非回填。
