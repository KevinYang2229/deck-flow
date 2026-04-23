import { createRootRoute, Outlet } from "@tanstack/react-router";

/**
 * 根路由元件
 * 提供全域 Layout 包裹（Header / Footer 等）
 */
export const Route = createRootRoute({
  component: RootLayout,
});

/** 根 Layout — 所有頁面共用的外層結構 */
function RootLayout() {
  return (
    <>
      {/* 在此加入全域 Header、Navbar 等 */}
      <main>
        <Outlet />
      </main>
      {/* 在此加入全域 Footer */}
    </>
  );
}
