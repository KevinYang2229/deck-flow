import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import "./index.css";

/** TanStack Query 用戶端實例 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 分鐘
      retry: 1,
    },
  },
});

/** TanStack Router 實例 */
const router = createRouter({ routeTree });

/** 擴充 Router 型別（啟用型別安全路由） */
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

/** 應用程式入口：掛載 React 至 #root */
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
