import { Navigate, Route, Routes, useLocation, useParams } from "react-router";
import { Toaster } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { HomePage } from "@/pages/HomePage";
import { TopicPage } from "@/pages/TopicPage";
import { RelatedRail, SignalDetail } from "@/pages/SignalDetail";
import { NotFoundPage, UnauthorizedPage } from "@/components/design/EmptyState";
import { AuthPage } from "@/pages/AuthPage";
import { PublishWizard } from "@/pages/PublishWizard";
import { MePage } from "@/pages/MePage";

/** 旧路由 301：保留 query（如 ?q=）平滑迁移到语义化新路径 */
function LegacyRedirect({ to }: { to: string }) {
  const { search } = useLocation();
  return <Navigate to={`${to}${search}`} replace />;
}

/** /t/:slug → /topics/:slug */
function LegacyTopicRedirect() {
  const { slug } = useParams();
  const { search } = useLocation();
  return <Navigate to={`/topics/${slug}${search}`} replace />;
}

/** /s/:id → /signals/:id */
function LegacySignalRedirect() {
  const { id } = useParams();
  return <Navigate to={`/signals/${id}`} replace />;
}

export function App() {
  return (
    <>
      <Routes>
        {/* landing 首页自带顶栏，不经 AppLayout */}
        <Route path="/" element={<HomePage />} />
        {/* 浏览全部信号 */}
        <Route
          path="/signals"
          element={
            <AppLayout>
              <TopicPage />
            </AppLayout>
          }
        />
        {/* 分区页 */}
        <Route
          path="/topics/:slug"
          element={
            <AppLayout>
              <TopicPage />
            </AppLayout>
          }
        />
        {/* 信号详情（右侧 Related 栏） */}
        <Route
          path="/signals/:id"
          element={
            <AppLayout related={<RelatedRail />}>
              <SignalDetail />
            </AppLayout>
          }
        />
        <Route
          path="/publish"
          element={
            <AppLayout>
              <PublishWizard />
            </AppLayout>
          }
        />
        <Route
          path="/me"
          element={
            <AppLayout>
              <MePage />
            </AppLayout>
          }
        />
        <Route
          path="/auth"
          element={
            <AppLayout>
              <AuthPage />
            </AppLayout>
          }
        />
        {/* 旧路由兼容重定向 */}
        <Route path="/t/all" element={<LegacyRedirect to="/signals" />} />
        <Route path="/t/:slug" element={<LegacyTopicRedirect />} />
        <Route path="/s/:id" element={<LegacySignalRedirect />} />
        <Route
          path="/401"
          element={
            <AppLayout>
              <UnauthorizedPage />
            </AppLayout>
          }
        />
        <Route
          path="*"
          element={
            <AppLayout>
              <NotFoundPage />
            </AppLayout>
          }
        />
      </Routes>
      <Toaster position="top-right" closeButton />
    </>
  );
}
