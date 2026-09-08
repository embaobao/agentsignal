/**
 * 技能三工具 + 管理一工具（裁决 13：模型消费本地能力的唯一入口）。
 * 共享 CLI 引擎单例（同一 config/索引/metrics），verify 只写本地 lifecycle.metrics。
 */
import { z } from "zod";
import type { Engine } from "../skills/engine.ts";
import { recordMetrics } from "../skills/metrics.ts";
import {
  type MirrorOutcome,
  mirrorContextForSkill,
  mirrorPlatformVerify,
} from "../skills/mirror.ts";
import { tokensEst } from "../skills/paths.ts";
import { startWizard } from "../skills/wizard/server.ts";

export interface SkillTool {
  name: string;
  description: string;
  schema: Record<string, z.ZodType>;
  /** open_setup 允许 engine 为 null（无配置时正是要靠它去初始化） */
  run(args: Record<string, unknown>, engine: Engine | null): Promise<string>;
}

const needEngine = (engine: Engine | null): Engine => {
  if (!engine) {
    throw new Error(
      "CONFIG_MISSING: 本机尚未初始化，请先运行 agentsignal init（或调用 open_setup）",
    );
  }
  return engine;
};

export function skillTools(): SkillTool[] {
  return [
    {
      name: "search_skills",
      description:
        "何时用：开工前、或遇到陌生领域/报错时，先查本地是否已有成文经验。命中后只给简表，需要完整步骤再调 load_skill_detail。别用：简单到不需要参考的任务（省一次调用）。",
      schema: {
        query: z.string().describe("检索词，中英文均可，如「登录 认证」"),
        task: z.string().optional().describe("当前任务描述，用于按触发规则匹配"),
        stack: z
          .array(z.string())
          .optional()
          .describe('当前项目技术栈，如 ["nextjs","typescript"]'),
        limit: z.number().int().min(1).max(20).default(5),
      },
      async run(args, engine0) {
        const engine = needEngine(engine0);
        const hits = await engine.search({
          query: String(args.query ?? ""),
          task: args.task ? String(args.task) : undefined,
          stack: (args.stack as string[] | undefined) ?? undefined,
          domain: engine.config.domains.current,
          limit: Number(args.limit ?? 5),
        });
        if (hits.length === 0) {
          return JSON.stringify({
            hits: [],
            hint: "本地没有匹配条目。可先用 query_signals 查平台经验，或按既有方式继续。",
          });
        }
        // 双指标：命中但只发简表 = 省下的全文 token
        const saved = hits.reduce((acc, h) => {
          const skill = engine.skills.find((s) => s.id === h.id);
          return acc + (skill ? Math.ceil(skill.bodyBytes / 4) : 0);
        }, 0);
        await recordMetrics({ saved, residual: tokensEst(JSON.stringify(hits)) }, engine.paths);
        return JSON.stringify({ hits }, null, 2);
      },
    },
    {
      name: "load_skill_detail",
      description:
        "何时用：search_skills 命中某条、且确实要照它做时，取渲染后的完整步骤。别用：只是想确认是否存在——search_skills 的简表足够。缺少依赖或参数时返回结构化清单，补齐后再调用。",
      schema: {
        skill_id: z.string().describe("search_skills 返回的 id"),
        project_root: z.string().optional().describe("项目根目录（读取项目级参数覆盖）"),
      },
      async run(args, engine0) {
        const engine = needEngine(engine0);
        const result = await engine.loadDetail(
          String(args.skill_id),
          args.project_root ? String(args.project_root) : undefined,
        );
        if (!result.ok) {
          return JSON.stringify(
            {
              ok: false,
              id: result.id,
              code: result.code,
              missing: result.missing,
              hint:
                result.code === "DEPENDENCIES_MISSING"
                  ? "补齐缺失的环境变量或可执行文件后重试。"
                  : "补齐缺失参数（项目级 .agentsignal/params.json5 > ~/.agentsignal/params.json5 > 环境变量 > 默认值）。",
            },
            null,
            2,
          );
        }
        await recordMetrics({ saved: 0, residual: tokensEst(result.body) }, engine.paths);
        return result.body;
      },
    },
    {
      name: "verify_skill",
      description:
        "何时用：照某条做完之后，如实回报结果（worked/partial/failed）。结果写入本地记录；来源为平台信号时默认附一行手动回传提示（agentsignal verify），config 开 mirror_verify 才自动回传平台聚合。别用：没实际照做就不要报——虚报会污染后续排序。",
      schema: {
        skill_id: z.string(),
        verdict: z.enum(["worked", "partial", "failed"]),
      },
      async run(args, engine0) {
        const engine = needEngine(engine0);
        const verdict = String(args.verdict) as "worked" | "partial" | "failed";
        const result = await engine.verify(String(args.skill_id), verdict);
        // 回流镜像（决议 2026-09-08 裁决 4）：默认 off 零网络只提示；on 且有 token 才回传。任何失败不影响本地裁决返回。
        let mirror: MirrorOutcome | undefined;
        try {
          const mctx = await mirrorContextForSkill(String(args.skill_id), engine.paths);
          if (mctx) {
            mirror = await mirrorPlatformVerify({
              sigId: mctx.sigId,
              verdict,
              baseUrl: mctx.baseUrl,
              token: mctx.token,
              mirrorEnabled: mctx.mirrorEnabled,
            });
          }
        } catch {
          // 镜像链路任何异常都只降级为无提示
        }
        return JSON.stringify({ ok: true, ...result, ...(mirror ? { mirror } : {}) }, null, 2);
      },
    },
  ];
}

/** 管理一工具：拉起本地 web 管理/向导界面（无配置即向导、有配置即状态/管理视图） */
export function manageTools(): SkillTool[] {
  return [
    {
      name: "open_setup",
      description:
        "何时用：用户需要初始化本机、调整配置，或你说不清当前接线状态时——拉起本地管理界面让用户在浏览器里完成，Agent 不必替用户猜参数。别用：只是查本地经验（那是 search_skills 的活）。",
      schema: {
        reason: z.string().optional().describe("为什么要打开（会展示给用户）"),
      },
      async run(args, engine) {
        const w = await startWizard({ rootOverride: engine?.paths.root, open: true });
        void w.wait.finally(() => {
          void w.close();
        });
        return JSON.stringify(
          {
            ok: true,
            url: w.url,
            reason: args.reason ? String(args.reason) : undefined,
            hint: "已在本机浏览器打开管理界面。用户完成操作后服务自动关闭；配置生效无需重启。",
          },
          null,
          2,
        );
      },
    },
  ];
}
