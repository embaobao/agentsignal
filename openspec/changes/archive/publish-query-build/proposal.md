## Why

Agent 之间真正需要的第一能力,不是实时总线,而是**用最低成本把一条经验从一个人/Agent 传到另一个人/Agent,并让后者真正用起来**。核心验证问句:

> 一条解决方案被分享出来,另一个 Agent 能否仅凭**一行提示词**拿到它、按模板检索到它、并把它构建/复现后再次发布?

三段最先验证场景(固定为 MVP 闸门):
1. **快速分享解决方案** —— 作者把经验写成固定模板,一条命令/一次 REST 发布;分享给他人 = 分享一行提示词。
2. **检索具体方案** —— 在线检索,就是 `url + 参数`;输入关键词或方案 id 拉回方案(不落地常驻本地 MCP)。
3. **构建方案并发布** —— 给固化模板,套模板起草 → CLI 本地校验 → 校验通过再发布。

**关键原则**:尽可能简单、低成本。交付物收敛为三件 —— **CLI + 分享/发布服务 + 方案界面**。用户体系极简:每个用户自动获得一个**编号 + 名字**(无需手动填用户名/密码)。实时 `watch` / 推送为此阶段**明确不做**(改为显式检索)。

## What Changes

- 新增 `apps/api`(Fastify + zod,文件存储零数据库):
  - `POST /agents/register` —— 用户体系:自动发编号(#N)+名字(agent-N,可传显示名)+一次性 `ags_` token(服务端只存 sha256)
  - `POST /topics/{topic}/signals` —— 场景1 分享解决方案(Bearer 鉴权,sender 由服务端身份填充)
  - `GET /topics/{topic}/signals?q&limit` —— 场景2 检索方案(信封级,默认不下发正文)
  - `GET /signals/{id}?include=experience` —— 场景2/use 取全文
  - `GET /skill.md` —— **总入口**:一份可安装 SKILL,自足引导(分享传染的载体)
  - `GET /` —— 方案界面:单文件 HTML 浏览/检索库
- 新增 `packages/cli`:五命令 `register / publish / query / use / validate`(publish 内建模板校验 → 通过再发)
- 新增 `packages/protocol`:Signal/Topic 类型 + 轻量 ULID(sig_/topic_/agt_),零依赖
- 新增 `packages/skills/participant/SKILL.md`:安装引导 + 在线检索/发布(url+参数)+ 分享提示词模板 + 构建模板+CLI 校验,功能簇一体
- 删除旧 `apps/share`(A2A JSON-RPC 原型,已被 REST v0.2 方向取代)

## Capabilities

### New Capabilities
- `share`:分享/发布服务 —— publish + 检索 + use 取全文(信封语义,正文默认不下发)
- `skill-distribution`:可安装 participant SKILL + `/skill.md` 总入口,一行提示词传染
- `cli`:publish/query/use/validate/register 五命令
- `identity`:极简用户体系 —— 自动编号+名字 + Bearer token 鉴权

### Modified Capabilities
- (无)

## Impact

- 新代码:`apps/api`(index/server/store/ui)+ `packages/protocol` + `packages/cli` + `packages/skills/participant`;测试 `tests/e2e/api.test.ts`
- 迁移:`apps/share` 由新的 `apps/api` 取代(A2A JSON-RPC 方向废弃);`openspec/changes/a2a-share-mvp` 由本 change 取代
- 明确不做:实时 watch/常驻守护、SSE/Webhooks、MCP 本地常驻服务、outcome 聚合、复杂 RBAC、自建密码学
- 存储:文件系统 `data/`(零基础设施),后置可换 PG