import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { SettingsDialog } from "@/components/biz/SettingsDialog";

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

test("keeps provider settings usable at narrow widths", () => {
  localStorage.setItem(
    "yunwu.settings.v1",
    JSON.stringify({
      activeProviderId: "provider-1",
      theme: "light",
      providers: [
        {
          id: "provider-1",
          name: "grok-4-1-fast-reasoning",
          type: "openai",
          apiKey: "key",
          baseUrl: "https://yunwu.ai/v1/",
          model: "grok-4-1-fast-reasoning",
        },
      ],
    }),
  );

  render(<SettingsDialog open onOpenChange={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "编辑 grok-4-1-fast-reasoning" }));

  expect(screen.getByRole("dialog")).toHaveClass("sm:max-w-3xl");
  expect(screen.getByLabelText("名称").closest("div[class]")).toHaveClass("min-w-0");
  expect(screen.getByText("预览：https://yunwu.ai/v1/chat/completions")).toHaveClass("break-all");
  expect(screen.getByRole("button", { name: "保存" }).parentElement).toHaveClass("flex-wrap");
});

test("truncates long provider names in the provider list", () => {
  const longName = "grok-4-fastgrok-4-fastgrok-4-fast-reasoning";

  localStorage.setItem(
    "yunwu.settings.v1",
    JSON.stringify({
      activeProviderId: "provider-1",
      theme: "light",
      providers: [
        {
          id: "provider-1",
          name: longName,
          type: "openai",
          apiKey: "key",
          baseUrl: "https://yunwu.ai/v1/",
          model: "grok-4-fast",
        },
      ],
    }),
  );

  render(<SettingsDialog open onOpenChange={() => {}} />);

  const button = screen.getByRole("button", { name: `编辑 ${longName}` });

  expect(button.parentElement).toHaveClass("w-full", "min-w-0");
  expect(screen.getByText(longName)).toHaveClass("block", "min-w-0", "truncate");
  expect(screen.getByText(longName)).toHaveStyle({ flex: "1 1 0%", maxWidth: "100%" });
});

test("shows an empty state before creating the first provider", () => {
  render(<SettingsDialog open onOpenChange={() => {}} />);

  expect(screen.getByText("还没有 Provider")).toBeInTheDocument();
  expect(screen.getByText("先创建一个 Provider，再开始调用 AI 模型。")).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Provider" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "编辑 新建 Provider" })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("名称")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "新建 Provider" }));

  expect(screen.getByRole("heading", { name: "新建 Provider" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "返回列表" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "编辑 新建 Provider" })).not.toBeInTheDocument();
  expect(screen.getByLabelText("名称")).toHaveValue("");
  expect(screen.getByRole("combobox", { name: "类型" })).toHaveTextContent("OpenAI 兼容");
  expect(screen.getByText("预览：https://api.openai.com/v1/chat/completions")).toBeInTheDocument();
});

test("creates, edits, activates, and deletes providers without image provider fields", async () => {
  const onChanged = vi.fn();

  render(<SettingsDialog open onOpenChange={() => {}} onChanged={onChanged} />);

  expect(screen.getByText("Provider 设置")).toBeInTheDocument();
  expect(screen.queryByText(/生图|图片|头像|image|avatar/i)).not.toBeInTheDocument();
  expect(screen.queryByText("内置系统提示词")).not.toBeInTheDocument();

  fireEvent.click(screen.getAllByRole("button", { name: "新建 Provider" })[0]);
  fireEvent.change(screen.getByLabelText("名称"), { target: { value: "Gemini 主线路" } });
  fireEvent.change(screen.getByLabelText("API Key"), { target: { value: "gemini-key" } });
  fireEvent.change(screen.getByLabelText("模型"), { target: { value: "gemini-2.5-pro" } });
  fireEvent.click(screen.getByRole("button", { name: "保存" }));

  await waitFor(() =>
    expect(onChanged).toHaveBeenCalledTimes(1),
  );
  fireEvent.click(screen.getByRole("button", { name: "返回列表" }));
  expect(screen.getByRole("button", { name: "编辑 Gemini 主线路" })).toBeInTheDocument();
  expect(screen.getByText("当前")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "编辑 Gemini 主线路" }));
  expect(screen.getByRole("heading", { name: "修改 Provider" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Gemini 主线路" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("名称"), { target: { value: "OpenAI 兼容" } });
  fireEvent.change(screen.getByLabelText("API 地址"), {
    target: { value: "https://api.example.com/v1/" },
  });
  expect(screen.getByText("预览：https://api.example.com/v1/chat/completions")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("模型"), { target: { value: "gpt-4o" } });
  fireEvent.click(screen.getByRole("combobox", { name: "类型" }));
  fireEvent.click(screen.getByRole("option", { name: "OpenAI 兼容" }));
  fireEvent.click(screen.getByRole("button", { name: "保存" }));

  await waitFor(() =>
    expect(onChanged).toHaveBeenCalledTimes(2),
  );

  fireEvent.click(screen.getByRole("button", { name: "激活" }));
  await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(3));

  const settings = JSON.parse(localStorage.getItem("yunwu.settings.v1") ?? "{}");
  expect(settings.providers).toHaveLength(1);
  expect(settings.providers[0]).toMatchObject({
    name: "OpenAI 兼容",
    type: "openai",
    apiKey: "gemini-key",
    baseUrl: "https://api.example.com/v1/",
    model: "gpt-4o",
  });
  expect(settings.activeProviderId).toBe(settings.providers[0].id);

  fireEvent.click(screen.getByRole("button", { name: "删除" }));

  await waitFor(() => expect(screen.getByText("还没有 Provider")).toBeInTheDocument());
  expect(onChanged).toHaveBeenCalledTimes(4);
});

test("reloads providers from localStorage when dialog opens", () => {
  localStorage.setItem(
    "yunwu.settings.v1",
    JSON.stringify({
      activeProviderId: "provider-1",
      theme: "dark",
      providers: [
        {
          id: "provider-1",
          name: "Claude",
          type: "claude",
          apiKey: "key",
          baseUrl: "",
          model: "claude-sonnet-4-5",
        },
      ],
    }),
  );

  const { rerender } = render(<SettingsDialog open={false} onOpenChange={() => {}} />);
  expect(screen.queryByText("Claude")).not.toBeInTheDocument();

  rerender(<SettingsDialog open onOpenChange={() => {}} />);

  expect(screen.getByRole("button", { name: "编辑 Claude" })).toBeInTheDocument();
  expect(screen.getByText("当前")).toBeInTheDocument();
  expect(screen.queryByLabelText("名称")).not.toBeInTheDocument();
});
