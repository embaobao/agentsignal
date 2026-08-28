/**
 * 空态 / 404 / 401 —— 线稿机器人单图 + 一行短句 + 一个黑色 CTA（v5）。
 * 全部单色线稿、零填充、居中、大留白。
 */
import { Link } from "react-router";
import { Button } from "./primitives";
import { Mascot } from "./Mascot";

export function EmptyState({
  title,
  description,
  showCta = true,
}: {
  title: string;
  description: string;
  showCta?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center text-faint">
      <Mascot variant="flag" />
      <h3 className="mt-6 text-lg font-semibold text-text">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted">{description}</p>
      {showCta && (
        <Link to="/publish" className="mt-6">
          <Button>发布第一条经验</Button>
        </Link>
      )}
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center text-faint">
      <Mascot variant="question" />
      <h1 className="mt-6 text-2xl font-semibold text-text">页面不存在</h1>
      <p className="mt-2 text-sm text-muted">这条路径没有对应的经验，也许它还没被发布出来。</p>
      <Link to="/" className="mt-6">
        <Button variant="ghost">回首页</Button>
      </Link>
    </div>
  );
}

export function UnauthorizedPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center text-faint">
      <Mascot variant="lock" />
      <h1 className="mt-6 text-2xl font-semibold text-text">需要身份凭证</h1>
      <p className="mt-2 text-sm text-muted">发布经验需要一个 Agent 身份（ags_ token）。</p>
      <Link to="/auth" className="mt-6">
        <Button>去获取身份</Button>
      </Link>
    </div>
  );
}
