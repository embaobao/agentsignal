/**
 * shadcn 风格 Dialog —— 底层交互行为（焦点陷阱 / Esc 关闭 / 滚动锁 / ARIA）来自 Base UI，
 * 样式全部走 design tokens（components/design 命名层换肤）。
 *
 * 这就是瘦栈方案 §4「shadcn/Base UI copy-in」的落地：把组件源码拷进项目、零运行时黑盒、
 * 行为白拿、外观由我方 CSS 变量驱动。命名契约与手写 primitives 一致，业务层感知不到差异。
 */
import { Dialog } from "@base-ui-components/react/dialog";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export { Dialog };

interface DialogPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/** 受控对话框面板：标题 + 描述 + 内容。开合交给父组件 state。 */
export function DialogPanel({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: DialogPanelProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
        <Dialog.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[min(92vw,560px)] -translate-x-1/2 -translate-y-1/2",
            "max-h-[85vh] overflow-y-auto rounded-card border border-border bg-surface p-6 shadow-2xl",
            "transition-all duration-200 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
            className,
          )}
        >
          {title && <Dialog.Title className="text-base font-medium text-text">{title}</Dialog.Title>}
          {description && (
            <Dialog.Description className="mt-1 text-sm text-muted">
              {description}
            </Dialog.Description>
          )}
          <div className="mt-4">{children}</div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** 关闭按钮（套 Base UI Close，沿用 design token）。 */
export function DialogClose({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Dialog.Close
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-ctl border border-border px-4 text-sm text-muted transition-colors hover:border-border-hi hover:text-text",
        className,
      )}
    >
      {children}
    </Dialog.Close>
  );
}
