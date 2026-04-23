import { createFileRoute } from "@tanstack/react-router";
import { DeckStudio } from "@/components/DeckStudio";

export const Route = createFileRoute("/")({
  component: HomePage,
});

/** 首頁：簡報工作區 */
function HomePage() {
  return <DeckStudio />;
}
