import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { DEFAULT_SETTINGS } from "@/domain/constants";
import { SystemPromptDialog } from "./SystemPromptDialog";

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

test("saves, adds, deletes, and resets system prompts", () => {
  const onChanged = vi.fn();

  render(<SystemPromptDialog open onOpenChange={() => {}} onChanged={onChanged} />);

  expect(screen.getByText("系统提示词")).toBeInTheDocument();
  expect(screen.getByLabelText("内置系统提示词 1")).toHaveValue(DEFAULT_SETTINGS.systemPrompts[0]);
  expect(screen.getByLabelText("内置系统提示词 2")).toHaveValue(DEFAULT_SETTINGS.systemPrompts[1]);
  expect(screen.getByLabelText("内置系统提示词 3")).toHaveValue(DEFAULT_SETTINGS.systemPrompts[2]);

  fireEvent.change(screen.getByLabelText("内置系统提示词 1"), {
    target: { value: "自定义第一条" },
  });
  fireEvent.click(screen.getByRole("button", { name: "新增提示词" }));
  fireEvent.change(screen.getByLabelText("内置系统提示词 4"), {
    target: { value: "新增第四条" },
  });
  fireEvent.click(screen.getAllByRole("button", { name: "删除" })[1]);
  fireEvent.click(screen.getByRole("button", { name: "保存提示词" }));

  let settings = JSON.parse(localStorage.getItem("yunwu.settings.v1") ?? "{}");
  expect(settings.systemPrompts).toEqual([
    "自定义第一条",
    DEFAULT_SETTINGS.systemPrompts[2],
    "新增第四条",
  ]);
  expect(onChanged).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole("button", { name: "恢复默认" }));

  settings = JSON.parse(localStorage.getItem("yunwu.settings.v1") ?? "{}");
  expect(settings.systemPrompts).toEqual(DEFAULT_SETTINGS.systemPrompts);
  expect(screen.getByLabelText("内置系统提示词 1")).toHaveValue(DEFAULT_SETTINGS.systemPrompts[0]);
  expect(screen.getByLabelText("内置系统提示词 2")).toHaveValue(DEFAULT_SETTINGS.systemPrompts[1]);
  expect(screen.getByLabelText("内置系统提示词 3")).toHaveValue(DEFAULT_SETTINGS.systemPrompts[2]);
  expect(onChanged).toHaveBeenCalledTimes(2);
});

test("reloads system prompts from localStorage when dialog opens", () => {
  localStorage.setItem(
    "yunwu.settings.v1",
    JSON.stringify({
      activeProviderId: "",
      providers: [],
      theme: "dark",
      systemPrompts: ["已保存第一条", "已保存第二条"],
    }),
  );

  const { rerender } = render(<SystemPromptDialog open={false} onOpenChange={() => {}} />);
  expect(screen.queryByText("系统提示词")).not.toBeInTheDocument();

  rerender(<SystemPromptDialog open onOpenChange={() => {}} />);

  expect(screen.getByLabelText("内置系统提示词 1")).toHaveValue("已保存第一条");
  expect(screen.getByLabelText("内置系统提示词 2")).toHaveValue("已保存第二条");
});
