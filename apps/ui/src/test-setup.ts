/**
 * Vitest 全局 setup：补齐 jsdom 缺失的浏览器 API。
 * cmdk 依赖 ResizeObserver 与 scrollIntoView（jsdom 未实现），这里给最小空实现。
 */

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
