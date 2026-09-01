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
import { dirname, isAbsolute, join, normalize, resolve } from 'node:path'
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

/**
 * 链接改写（三态）：
 * - 目标已入站 → 按内容区落点重算相对 href
 * - 目标是仓库里真实存在但**未公开**的文件 → 换成 GitHub 绝对链接。
 *   理由：这些指针是文档的溯源线索（决议、提案、图），删掉等于把论证依据抹了；
 *   而 MIT 仓库本来就公开这些文件，指过去既不额外泄露，也不会给站内留死锚点。
 * - 目标不存在（旧稿残留）→ 降级为纯文本，并汇总提示销项
 */
// destOf / included 在下面定义；链接改写要用它们，故延迟到那里再取用
const linkIssues = { externalized: [], stale: [] }
let rewriteLinksReady = false
function rewriteLinks(...args) {
  if (!rewriteLinksReady) throw new Error('rewriteLinks 在初始化前被调用')
  return implRewriteLinks(...args)
}
function implRewriteLinks(text, fromRepoPath) {
  // 源文件与目标都换算成内容区落点，href 就是这两个落点之间的相对路径——
  // 只有一套坐标，不会再出现"同一串 ../ 两种解读"。
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
      const toSite = 'sitePath' in hit ? hit.sitePath : destOf(hit.repo).slice(CONTENT_DIR.length + 1)
      // 公开与否只由 included 判定：未入站的仓库文件一律指 GitHub，绝不留在站内当可达页
      if ('repo' in hit && !included.has(hit.repo)) {
        linkIssues.externalized.push(`${fromRepoPath} → ${hit.repo}`)
        return `[${label} — 仓库原文](https://github.com/${REMOTE_REPO}/blob/main/${encodeURI(hit.repo)}${anchor ? `#${anchor}` : ''})`
      }
      return `[${label}](${relative(fromSiteDir, toSite)}${anchor ? `#${anchor}` : ''})`
    },
  )
}

/**
 * 定位链接指向的文件。返回 `{ repo }`（仓库里的真实文件，可能未入站）或
 * `{ sitePath }`（只在内容区存在：手工页、include 宿主页、policy 页）。找不到返回 null。
 *
 * 三条候选，**从严到宽**排列，安全性由顺序保证：
 * 1. 仓库视角·严格：源文件所在目录 + 相对路径。协议文档写 `../decisions/x.md` 走这条，
 *    认成内部决议后改指 GitHub——这条永远优先，所以内部引用不可能被后面的宽容档洗白。
 * 2. 站点视角·严格：源文件的内容区位置 + 相对路径。手工页住在 pages/、站上却在 docs/ 下，
 *    它写的 `../design/glossary.md` 只有这条连得上；结果强制夹在内容区内。
 * 3. 仓库视角·宽松：把裸路径当作相对 docs/ 或仓库根。活文档里有少打一层 `../` 的旧写法
 *    （glossary.md 写 `design/product.md`）。这条只能命中**真实存在**的文件，
 *    且仍要过 included 才谈得上公开。
 */
function findTarget(fromRepoPath, rawTarget) {
  const at = (base) => normalize(base ? join(base, rawTarget) : rawTarget)
  const strictRepo = at(dirname(fromRepoPath))
  if (isIn(strictRepo, REPO_ROOT) && existsSync(join(REPO_ROOT, strictRepo))) return { repo: strictRepo }

  // 内容区顶端在站上等价于 docs/ 子树，所以基准是 siteDir 本身再补一层 docs/；
  // 少了这层，手工页写的 `../design/glossary.md` 会算成 design/glossary.md —— 内容区里没这个路径。
  const siteDir = dirname(destOf(fromRepoPath).slice(CONTENT_DIR.length + 1))
  const siteBase = join('docs', siteDir === '.' ? '' : siteDir)
  const strictSite = normalize(at(siteBase))
  if (isIn(strictSite, CONTENT_DIR) && existsSync(join(CONTENT_DIR, strictSite))) return { sitePath: strictSite }
  // 上跳越出内容区顶端的那些（quickstart 的 `../design/glossary.md` → docs/../design/…）：
  // 站上根之上就是 docs/ 子树，所以退到顶端后直接拼目标。仍夹在内容区内，够不到任何内部文件。
  const top = normalize(siteBase)
  if (strictSite.startsWith('..')) {
    const clamped = normalize(rawTarget.replace(/^(\.\.\/)+/, ''))
    const cand = normalize(join(top === '.' ? '' : top, clamped))
    if (isIn(cand, CONTENT_DIR) && existsSync(join(CONTENT_DIR, cand))) return { sitePath: cand, clamped: true }
  }

  for (const guess of [at('docs'), at('')]) {
    if (isIn(guess, REPO_ROOT) && existsSync(join(REPO_ROOT, guess))) return { repo: guess, loose: true }
  }
  return null
}

/** p 是否落在 root 之内（没有被 `../` 顶穿） */
function isIn(p, root) {
  return !p.startsWith('..') && !isAbsolute(p) && resolve(root, p).startsWith(root + '/')
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
// 手工页没有 docs/ 前缀的仓库路径，它的站上落点即文件名；链接改写按 included 判可达，
// 所以这里把"内容区落点名"也登记进去（rewriteLinks 用 sitePath 比较）。
for (const f of isDir(join(SITE_DIR, 'pages')) ? listFiles('apps/docs/pages/') : []) {
  included.add(f)
  included.add(`docs/${f.slice('apps/docs/pages/'.length)}`)
}
included.add('docs/site-publishing-policy.md')

/**
 * 入站页的**唯一坐标系就是仓库**：docs/x.md → 站上 x.md；apps/docs/pages/y.md → 站上 y.md。
 *
 * 早先版本把内容区再套一层 docs/、并给手工页造了个"仓库视角"别名，结果是同一串 `../`
 * 有两套互相矛盾的解读（pages 页写 `../design/glossary.md`，按它的真实位置解析会掉到
 * apps/docs/design/…），怎么兜底都补不回来。现在只有一条规则：**目标 = 源文件目录 + 相对路径**，
 * 剥不剥 docs/ 前缀只在最后决定落盘位置时出现一次。
 */
function destOf(repoPath) {
  return repoPath.startsWith('apps/docs/pages/')
    ? join(CONTENT_DIR, repoPath.slice('apps/docs/pages/'.length))
    : join(CONTENT_DIR, sitePath(repoPath))
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
  writeFileSync(dest, rewriteLinks(text, file))
  pages.push(dest)
  sources.set(dest, new Set([file]))
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
  writeFileSync(dest, rewriteLinks(readFileSync(join(REPO_ROOT, f), 'utf8'), f))
  pages.push(dest)
  sources.set(dest, new Set([f]))
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
