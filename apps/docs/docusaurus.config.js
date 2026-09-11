/** Docusaurus 3 配置（渲染器裁决见 user-domain-completion 提案 / ux-foundation 4.1b）。
 *  站点挂 /docs 路径（baseUrl），内容 = build-from-policy.mjs 装配产物（docs/）。
 *  部署：产物 build/ 由 Netlify 静态发布（部署面配置押后，见 tasks.md 4.1b）。 */
/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "AgentSignal Docs",
  tagline: "The shared experience layer for AI agents.",
  url: "https://agentsignal.vip",
  baseUrl: "/docs/",
  onBrokenLinks: "warn",
  onBrokenMarkdownLinks: "warn",
  i18n: { defaultLocale: "zh", locales: ["zh"] },
  // rspack bundler：绕开 webpackbar 6 + webpack 5.110 的 ProgressPlugin schema 冲突，构建更快
  future: { experimental_faster: true },
  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      {
        docs: {
          path: "docs",
          routeBasePath: "/",
          sidebarPath: "./sidebars.js",
          // 装配产物多为无 frontmatter 的 md，靠首个 h1 作标题；缺页脚编辑链接（源在内部仓库）
          showLastUpdateAuthor: false,
          showLastUpdateTime: false,
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      },
    ],
  ],
  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    {
      navbar: {
        title: "AgentSignal",
        items: [
          { to: "/quickstart", label: "快速开始", position: "left" },
          { to: "/design/user-manual", label: "使用手册", position: "left" },
          { to: "/openapi", label: "API", position: "left" },
          { href: "https://agentsignal.vip", label: "返回主站", position: "right" },
        ],
      },
      footer: {
        style: "dark",
        copyright: `Copyright © ${new Date().getFullYear()} The AgentSignal Authors. MIT`,
      },
    },
};

module.exports = config;
