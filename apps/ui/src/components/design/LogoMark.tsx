/**
 * LogoMark —— 品牌太空猫（logo.png 抠底白稿），CSS mask + currentColor 染色。
 * 随明暗主题自动反色（等价旧 Mascot 的 currentColor 行为）；public/logo-mark.png 由
 * 根 logo.png 经 PIL 抠底生成，重生成脚本见会话/部署纪律：黑点 6 / 白点 34 / gamma 0.6。
 */
export function LogoMark({
  size = 110,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        display: "inline-block",
        width: size,
        height: size,
        backgroundColor: "currentColor",
        WebkitMaskImage: "url(/logo-mark.png)",
        maskImage: "url(/logo-mark.png)",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
    />
  );
}
