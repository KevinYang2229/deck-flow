import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { DeckStudio } from "@/components/DeckStudio";

vi.mock("@tanstack/react-router", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");

  return {
    ...actual,
    Link: ({
      children,
      ...props
    }: ComponentPropsWithoutRef<"a"> & { children: ReactNode }) => <a {...props}>{children}</a>,
  };
});

describe("DeckStudio", () => {
  it("應可切換到播放模式", () => {
    window.localStorage.clear();
    render(<DeckStudio />);

    fireEvent.click(screen.getByRole("button", { name: "播放模式" }));
    expect(screen.getByText("上一張")).toBeInTheDocument();
    expect(screen.getByText("下一張")).toBeInTheDocument();
  });
});
