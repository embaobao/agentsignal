#!/usr/bin/env node
/**
 * 文档站内容装配器 —— 唯一的内容入口闸门。
 *
 * 为什么存在：`docs/` 里同时躺着公开契约与内部资产（商业判断、竞品情报、部署拓扑）。
 * 白名单制要求「默认不公开」——所以本脚本只吃 docs/site-publishing-policy.md 的 P0/P1 名单，
 * 其余文件一律不进站点产物。P1 还要过敏感词清洗门（D4）。
 *
 * 分级真相在 policy 表格里，不在这里；这里只解析表格 + 拷贝 + 清洗。
 */
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SITE_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(SITE_DIR, '../..')
const POLICY_FILE = join(REPO_ROOT, 'docs/site-publishing-policy.md')
const CONTENT_DIR = join(SITE_DIR, 'docs')
const PUBLIC_DIR = join(SITE_DIR, 'static/repo-docs')

/** 溯源外链的归属：从 origin remote 推断，不硬编码仓库名（改了 remote 不会悄悄指错地方） */
let REMOTE_REPO = process.env.DOCS_REPO ?? 'embaobao/agentsignal'
try {
  const url = execFileSync('git', ['config', '--get', 'remote.origin.url'], { encoding: 'utf8' }).trim()
  const m = url.match(/[:/]([^/:]+\/[^/]+?)(?:\.git)?$/)
  if (m) REMOTE_REPO = m[1]
} catch {
  /* 无 git 环境时用默认值 */
}

/**
 * 清洗门词表：命中即要求人工豁免（policy 里给该源文件打 `[公开:豁免]`）。
 * 判据是 reuse-boundary 决议 D4：允许公开「已存在的事实」，禁止公开「对未来的承诺」与「生意判断」。
 * 所以 Node / Fastify / Postgres / Turborepo 不在列（公开它们是技术透明度），
 * `M4 起` 在列（那是没对外承诺过的排期）。
 */
const RESIDUE = [
  { re: /M\d\s*(?:起|前|阶段|内|后)/g, why: '未公开的里程碑排期' },
  { re: /规划未建|待建|计划中|尚未实现|暂未支持/g, why: '未落地功能预告' },
  { re: /任务台账|implementation-tasks|\broadmap\b/gi, why: '路线图与台账引用' },
  { re: /定价|报价|续费|目标金额|万元|付费客户/g, why: '商业判断内容' },
  { re: /竞品|对标|差异化优势|护城河/g, why: '竞争策略内容' },
]

/**
 * 解析 policy 的「二、名单」章节。目录段以 `/` 结尾（如 `docs/business/**`）整体展开，
 * 单文件段直接登记。只有 P0/P1 小节的条目参与入站。
 */
function parsePolicy(md) {
  const section = md.split(/^## /m).find((s) => s.startsWith('二、名单'))
  if (!section) throw new Error('policy 缺少「二、名单」章节')
  const tiers = { P0: [], P1: [] }
  let current = null
  for (const line of section.split('\n')) {
    const heading = line.match(/^###\s+(P\d)[^\n]*/)
    if (heading) {
      current = heading[1] in tiers ? heading[1] : null
      continue
    }
    if (!current || !line.trimStart().startsWith('-')) continue
    // 反引号里的东西只有「看起来是仓库路径」才算条目：必须带扩展名，或以 `/` 结尾（目录）
    for (const raw of line.match(/`([^`]+)`/g)?.map((s) => s.slice(1, -1)) ?? []) {
      const p = raw.replace(/^\.\//, '').replace(/\/\*\*?$/, '/').trim()
      if (!p) continue
      const isDirEntry = p.endsWith('/') && /^[\w./@-]+$/.test(p)
      const isFileEntry = /\.[A-Za-z0-9]+$/.test(p) && /^[\w./@-]+$/.test(p)
      if (isDirEntry) tiers[current].push({ dir: p })
      else if (isFileEntry) tiers[current].push({ file: p })
    }
  }
  return tiers
}

function isDir(abs) {
  try {
    return statSync(abs).isDirectory()
  } catch {
    return false
  }
}

function listFiles(dirRel) {
  const out = []
  const walk = (rel) => {
    let names
    try {
      names = readdirSync(join(REPO_ROOT, rel))
    } catch {
      console.error(`⚠ policy 登记的目录 ${dirRel} 不存在，已跳过`)
      return
    }
    for (const name of names) {
      const child = rel + name
      if (isDir(join(REPO_ROOT, child))) walk(child + '/')
      else if (/\.(md|mdx)$/.test(name)) out.push(child)
    }
  }
  walk(dirRel.endsWith('/') ? dirRel : dirRel + '/')
  return out
}

/** 站点落盘路径：docs/ 前缀剥掉，其余保留原层级 */
function sitePath(repoPath) {
  return repoPath.startsWith('docs/') ? repoPath.slice('docs/'.length) : repoPath
}

function toSiteAbs(repoPath) {
  return join(REPO_ROOT, 'apps/docs/docs', sitePath(repoPath))
}

/**
 * 链接改写（三态）：
 * - 目标已入站 → 按站点目录重算相对 href
 * - 目标是仓库里真实存在但**未公开**的文件 → 换成 GitHub 绝对链接。
 *   理由：这些指针是文档的溯源线索（决议、提案、图），删掉等于把论证依据抹了；
 *   而 MIT 仓库本来就公开这些文件，指过去既不额外泄露，也不会给站内留死锚点。
 * - 目标不存在（旧稿残留）→ 降级为纯文本，并汇总提示销项
 */
// destOf / repoView / included 在下面定义；链接改写要用它们，故延迟到那里再取用
const linkIssues = { externalized: [], stale: [] }
let rewriteLinksReady = false
function rewriteLinks(...args) {
  if (!rewriteLinksReady) throw new Error('rewriteLinks 在初始化前被调用')
  return implRewriteLinks(...args)
}
function implRewriteLinks(text, fromRepoPath) {
  const fromSiteDir = dirname(destOf(fromRepoPath).slice(CONTENT_DIR.length + 1))
  return text.replace(
    /\[([^\]]*)\]\((?!https?:|mailto:|#)([^)\s]+)\)/g,
    (whole, label, target) => {
      const [rawClean, anchor] = target.split('#')
      if (!rawClean || /^(mailto:|\/\/)/i.test(rawClean)) return whole
      // 站内绝对路径（Docusaurus 的 /slug 写法）原样保留，交给路由解析
      if (rawClean.startsWith('/')) return `[${label}](${rawClean}${anchor ? `#${anchor}` : ''})`
      // 无扩展名的目标按 .md 寻址：`./architecture-overview` 指向同目录那篇文档
      const clean = /\.[A-Za-z0-9]+$/.test(rawClean) ? rawClean : `${rawClean}.md`
      const hit = findTarget(fromRepoPath, clean)
      if (!hit) {
        linkIssues.stale.push(`${fromRepoPath} → ${clean}`)
        return `[${label}](#${anchor ?? ''})`
      }
      if (included.has(hit.repo)) {
        return `[${label}](${relative(fromSiteDir, sitePath(hit.repo))}${anchor ? `#${anchor}` : ''})`
      }
      // 仓库里存在但未公开 → 指去 GitHub。MIT 仓库本就公开这些文件，
      // 保留溯源线索比留个站内死锚点诚实，也不额外泄露任何东西。
      linkIssues.externalized.push(`${fromRepoPath} → ${hit.repo}`)
      return `[${label} — 仓库原文](https://github.com/${REMOTE_REPO}/blob/main/${encodeURI(hit.repo)}${anchor ? `#${anchor}` : ''})`
    },
  )
}

/**
 * 定位链接指向的真实文件。入站页的**站点目录层级与仓库并不一致**（docs/protocols/x.md 与
 * apps/docs/pages/y.md 都落在内容区的不同深度上），所以同一个 `../design/glossary.md`
 * 在不同页面里的基准不一样。这里枚举所有合理基准逐个试：
 * - 源文件的仓库目录（协议文档写 `../decisions/x.md` 走这条）
 * - 源文件的站点目录（手工页写在 pages/ 下但站点视角是 docs/，`./architecture-overview.md` 走这条）
 * - docs/ 根、仓库根（活文档里少打一层 `../` 的旧写法）
 * 全部落空才算断链——判定从严，宁可漏报也不把真断链洗白。
 */
function findTarget(fromRepoPath, rawTarget) {
  // 仓库视角与站点视角是两套坐标（手工页住在 pages/，站点里却算 docs/ 下），两个基准都要试；
  // 最后再兜底 docs/ 根与仓库根——活文档里有少打一层 `../` 的旧写法。
  // 手工页的仓库路径（apps/docs/pages/x.md）不在 docs/ 下，它的链接一律按 docs/ 视角写；
  // docs/ 前缀要显式补上，否则 join('','../design/glossary.md') 会掉出内容区。
  const inDocs = fromRepoPath.startsWith('docs/')
  const repoBase = dirname(fromRepoPath)
  const siteBase = dirname(sitePath(fromRepoPath))
  const bases = [
    inDocs ? repoBase : join('docs', siteBase === '.' ? '' : siteBase),
    repoBase,
    'docs',
    '',
  ]
  const seen = new Set()
  for (const b of bases) {
    const repo = normalize(b ? join(b, rawTarget) : rawTarget)
    // 每个基准单独夹在仓库根内：`docs` 视角下 `../design/x.md` 会掉出 docs/，
    // 但它正是站点视角里那篇文档的位置，不能被 startsWith('..') 一票否掉。
    const abs = resolve(REPO_ROOT, repo)
    if (seen.has(repo) || !abs.startsWith(REPO_ROOT + '/')) continue
    seen.add(repo)
    if (existsSync(abs)) return { repo }
  }
  return null
}

function relative(fromDir, toSitePath) {
  const from = fromDir ? fromDir.split('/') : []
  const to = toSitePath.split('/')
  let i = 0
  while (i < from.length - 1 && from[i] === to[i]) i++
  return [...Array(Math.max(0, from.length - 1 - i)).fill('..'), ...to.slice(i)].join('/')
}

/**
 * 内联片段标记，写在 policy 名单行尾：
 *   `` `docs/design/architecture.md` —— 说明文字 <!-- include: docs/design/architecture.md ## 总体数据流, ## Token Firewall 三层归属 → docs/public-architecture.md --> ``
 * 语义：从源文件抽取列出的章节（逗号分隔；省略 `##` 则抽全文），追加到宿主公开页末尾。
 * 为什么这么设计：一份权威叙述只维护一处。公开架构页可以按需嵌入内部文档里已经稳定的小节，
 * 而不必复制第二份全文——复制必然漂移，内联不会。
 */
const INCLUDE_RE = /<!--\s*include:\s*([\w./@-]+\.md)((?:\s+,?\s*#{1,6}\s+[^,<]+)*)\s*(?:→|->)\s*([\w./@-]+\.md)\s*-->/g

/**
 * 取源文件从 startHeading 起的整段（含子节），到下一个同级或更高级标题前为止。
 * `!` 前缀是**段落级豁免**：该段跳过清洗门（用于协议文档点名自己的启用阶段这类已写进契约的事实）。
 */
function extractSection(lines, spec) {
  const exempt = spec.startsWith('!')
  const heading = spec.replace(/^!\s*/, '').trim()
  const level = (heading.match(/^#+/) ?? ['#'])[0].length
  const from = lines.findIndex((l) => l.trimEnd() === heading)
  if (from < 0) throw new Error(`找不到章节标题「${heading}」`)
  let to = lines.length
  for (let i = from + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s/)
    if (m && m[1].length <= level) {
      to = i
      break
    }
  }
  return { text: lines.slice(from, to).join('\n').trim(), exempt }
}

const policyText = readFileSync(POLICY_FILE, 'utf8')
const includes = [...policyText.matchAll(INCLUDE_RE)].map((m) => ({
  src: m[1],
  sections: (m[2] ?? '').split(',').map((s) => s.trim()).filter((s) => /^!?\s*#/.test(s)),
  host: m[3],
}))
const tiers = parsePolicy(policyText)
// 目录展开时的排除项：生成物与包元数据不是文档
const SKIP = ['node_modules/', 'package.json']
const resolved = (tier, t) => {
  const files = t.dir ? listFiles(t.dir) : [t.file]
  return files
    .filter((f) => !SKIP.some((s) => f.startsWith(s) || f === s))
    .map((file) => ({ tier, file }))
}
const listed = [...tiers.P0.flatMap((t) => resolved('P0', t)), ...tiers.P1.flatMap((t) => resolved('P1', t))]
const entries = [...new Map(listed.map((e) => [e.file, e])).values()]
const included = new Set(entries.map((e) => e.file))
// 手工页与 policy 页要在链接改写之前就登记，否则它们的互链会被当成断链降级
for (const f of isDir(join(SITE_DIR, 'pages')) ? listFiles('apps/docs/pages/') : []) included.add(repoView(f))
included.add('docs/site-publishing-policy.md')

/** 站点落盘路径：仓库路径 → apps/docs/docs/ 下的相对路径 */
function destOf(repoPath) {
  return repoPath.startsWith('apps/docs/pages/')
    ? join(CONTENT_DIR, repoPath.slice('apps/docs/pages/'.length))
    : join(CONTENT_DIR, sitePath(repoPath))
}

/**
 * 入站页的「仓库视角路径」：docs/x → x；apps/docs/pages/y.md → docs/y.md。
 * 链接改写与越级引用检查都以它为基准解析相对路径——手工页里写 `../protocols/api.md`
 * 必须和架构文档里写同样内容得到同样的结果，否则同类链接要记两套写法。
 */
function repoView(repoPath) {
  return repoPath.startsWith('apps/docs/pages/') ? `docs/${repoPath.slice('apps/docs/pages/'.length)}` : repoPath
}

const violations = []
rewriteLinksReady = true
rmSync(CONTENT_DIR, { recursive: true, force: true })

// 第一遍：装配。每页记下来自哪些源文件，供第二遍按来源判定豁免。
const sources = new Map()
const pages = []
for (const { tier, file } of entries) {
  let text
  try {
    text = readFileSync(join(REPO_ROOT, file), 'utf8')
  } catch {
    violations.push(`${file}: 名单登记了但源文件读不到`)
    continue
  }
  const dest = destOf(file)
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, rewriteLinks(text, repoView(file)))
  pages.push(dest)
  sources.set(dest, new Set([repoView(file)]))
}

// policy 自身入站：分级规则是社区可查的公共约定
{
  const dest = join(CONTENT_DIR, 'site-publishing-policy.md')
  writeFileSync(dest, policyText)
  pages.push(dest)
  sources.set(dest, new Set(['docs/site-publishing-policy.md']))
}

// 手工页（apps/docs/pages/）
const overlayFiles = isDir(join(SITE_DIR, 'pages')) ? listFiles('apps/docs/pages/') : []
for (const f of overlayFiles) {
  const dest = destOf(f)
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, rewriteLinks(readFileSync(join(REPO_ROOT, f), 'utf8'), repoView(f)))
  pages.push(dest)
  sources.set(dest, new Set([repoView(f)]))
}

// 内联片段追加到宿主页：included 此时已完整，片段内的外链同样被降级
for (const { src, sections, host } of includes) {
  const hostFile = destOf(host)
  if (!existsSync(hostFile)) {
    violations.push(`include ${src} → 宿主页 ${host} 未装配（检查它是否真的在名单里）`)
    continue
  }
  let lines
  try {
    lines = readFileSync(join(REPO_ROOT, src), 'utf8').split('\n')
  } catch {
    violations.push(`include 源文件读不到：${src}`)
    continue
  }
  let block
  const picked = []
  try {
    const chunks = sections.length
      ? sections.map((s) => extractSection(lines, s))
      : [{ text: lines.join('\n').trim(), exempt: false }]
    for (const c of chunks) {
      block = (block ? block + '\n\n' : '') + rewriteLinks(c.text, src)
      if (!c.exempt) picked.push(src)
    }
  } catch (e) {
    violations.push(`include ${src}: ${e.message}`)
    continue
  }
  writeFileSync(
    hostFile,
    `${readFileSync(hostFile, 'utf8').trimEnd()}\n\n<!-- ===== 以下由 build-from-policy.mjs 装配自 ${src}${sections.length ? ` (${sections.join(' · ')})` : ''}，请勿手工编辑 ===== -->\n\n${block}\n`,
  )
  // 段落级豁免的片段不记来源：清洗门不该因为它亮灯，但越级引用检查照旧
  for (const s of picked) sources.get(hostFile)?.add(s)
}

// 第二遍：产物级清洗门。豁免只对标注过的源文件生效——
// 也就是说「这份文档整体可以带中性提及上线」，而不是「站点随便扫」。
const exemptFiles = new Set(
  [...policyText.matchAll(/`([\w./@-]+\.md)`[^\n]*\[公开:豁免\]/g)].map((m) => m[1].replace(/^\.\//, '')),
)
const POLICY_PAGE = join(CONTENT_DIR, 'site-publishing-policy.md')

for (const page of pages) {
  let text = readFileSync(page, 'utf8')
  // policy 页本身就是分级规则，必然点名它管制的对象；对它只查商业词（那才是真泄露）
  if (page === POLICY_PAGE) {
    text = text.split(/^## /m).filter((s) => !s.startsWith('二、名单')).join('\n')
    for (const b of RESIDUE.filter((r) => /商业|竞争/.test(r.why))) {
      for (const h of [...text.matchAll(b.re)].slice(0, 3)) {
        violations.push(`policy 页「${h[0].trim()}」${b.why} —— 分级规范本身也不该带生意判断上线`)
      }
    }
    continue
  }
  for (const src of sources.get(page)) {
    if (exemptFiles.has(src)) continue
    for (const b of RESIDUE) {
      for (const h of [...text.matchAll(b.re)].slice(0, 3)) {
        violations.push(
          `清洗门 ${page.slice(SITE_DIR.length + 1)} ← ${src}:${text.slice(0, h.index).split('\n').length} 「${h[0].trim()}」${b.why}`,
        )
      }
    }
  }
}

// 未入站目标的处理已在 rewriteLinks 里分流：存在→指 GitHub；不存在→降级并记账。
// 这里只把账目摊开，让"旧稿残留的断链"变成可见的销项清单而不是静默腐坏。
if (linkIssues.externalized.length > 0) {
  console.log(`↗ ${linkIssues.externalized.length} 条溯源链接改指 GitHub（未公开文件不进站点，但保留出处）`)
}
if (linkIssues.stale.length > 0) {
  const byTarget = new Map()
  for (const s of linkIssues.stale) {
    const t = s.split(' → ')[1]
    byTarget.set(t, (byTarget.get(t) ?? 0) + 1)
  }
  console.error(`\n⚠ ${linkIssues.stale.length} 条链接指向不存在的文件，已降级为纯文本（建议回源文档清理）：`)
  for (const [t, n] of [...byTarget].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.error(`   · ${t}${n > 1 ? ` （${n} 处）` : ''}`)
  }
}

if (violations.length > 0) {
  console.error(`\n❌ 文档站内容装配失败（${violations.length} 项）：`)
  for (const v of violations) console.error(`   · ${v}`)
  console.error(`\n处置：改写该段落、或按 site-publishing-policy.md §三 从名单撤下、或（仅限中性提及）打 [公开:豁免]。\n`)
  process.exit(1)
}

// openapi.json 每次构建强制重导：API 参考页的数据源必须是当下的契约。
// --no-openapi 供本地快速迭代（跳过重导，直接复用仓库里已有的 openapi.json）。
if (!process.argv.includes('--no-openapi')) {
  execFileSync('pnpm', ['openapi'], { cwd: REPO_ROOT, stdio: 'inherit' })
}
rmSync(PUBLIC_DIR, { recursive: true, force: true })
mkdirSync(PUBLIC_DIR, { recursive: true })
cpSync(join(REPO_ROOT, 'openapi.json'), join(PUBLIC_DIR, 'openapi.json'))

const count = (tier) => entries.filter((e) => e.tier === tier).length
console.log(`✓ 装配完成：${pages.length} 页入站（P0 ${count('P0')} · P1 ${count('P1')} · 手工页 ${overlayFiles.length}），清洗门全绿，openapi.json 已刷新`)
