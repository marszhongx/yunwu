import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { MessageRenderer } from "@/components/biz/MessageRenderer";

test("renders built-in regions as plain text", () => {
  render(
    <MessageRenderer
      content={
        "<content>正文 **重点**</content><summary>- 摘要</summary><status>心情：平静</status>"
      }
    />,
  );

  expect(screen.getByText("正文 **重点**")).toBeInTheDocument();
  expect(screen.queryByText("重点", { selector: "strong" })).not.toBeInTheDocument();
  expect(screen.getByText("- 摘要")).toBeInTheDocument();
  expect(screen.getByText("心情：平静")).toBeInTheDocument();
});

test("renders unknown tags transparently", () => {
  render(<MessageRenderer content="<scene>雨夜 **场景**</scene>" />);

  expect(screen.getByText("雨夜 **场景**")).toBeInTheDocument();
  expect(screen.queryByText("场景", { selector: "strong" })).not.toBeInTheDocument();
  expect(document.querySelector("scene")).not.toBeInTheDocument();
});

test("allows callers to register a custom tag component", () => {
  render(
    <MessageRenderer
      content="<scene>雨夜</scene>"
      registry={{
        scene: ({ children }) => <section data-testid="scene-region">{children}</section>,
      }}
    />,
  );

  expect(screen.getByTestId("scene-region")).toHaveTextContent("雨夜");
});

test("renders choices as plain text and reports the original line", () => {
  const onChoice = vi.fn();
  render(<MessageRenderer content={"<choices>- 前进\n- 等待</choices>"} onChoice={onChoice} />);

  fireEvent.click(screen.getByRole("button", { name: "- 前进" }));
  expect(onChoice).toHaveBeenCalledWith("- 前进");
});

test("hides choices when selection is inactive", () => {
  render(<MessageRenderer content={"<choices>- 前进\n- 等待</choices>"} />);

  expect(screen.queryByRole("button", { name: "- 前进" })).not.toBeInTheDocument();
});

test("shows disabled choices while selection is temporarily unavailable", () => {
  render(
    <MessageRenderer
      content="<choices>- 前进</choices>"
      onChoice={() => undefined}
      choicesDisabled
    />,
  );

  expect(screen.getByRole("button", { name: "- 前进" })).toBeDisabled();
});
