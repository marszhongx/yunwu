import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ImageProviderDialog } from "@/components/biz/ImageProviderDialog";
import type { ImageProviderSettings } from "@/types";
import * as settings from "@/services/settings";

vi.mock("@/services/settings", () => ({
  addImageProvider: vi.fn(),
  updateImageProvider: vi.fn(),
  deleteImageProvider: vi.fn(),
  setActiveImageProvider: vi.fn(),
  getSettings: vi.fn(),
}));

vi.mock("@/store/appState", () => ({
  useAppState: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) => selector(mockState),
    {
      getState: () => mockState,
    },
  ),
}));

let mockState: Record<string, unknown> = {
  settings: { imageProviders: [], activeImageProviderId: "" },
  reload: vi.fn(),
};

describe("ImageProviderDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState = {
      settings: { imageProviders: [], activeImageProviderId: "" },
      reload: vi.fn(),
    };
  });

  test("renders empty state with create button", () => {
    render(<ImageProviderDialog open onOpenChange={() => {}} />);

    expect(screen.getByText("图片生成设置")).toBeInTheDocument();
    expect(screen.getByText("还没有图片 Provider")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建图片 Provider" })).toBeInTheDocument();
  });

  test("renders form fields when creating", () => {
    render(<ImageProviderDialog open onOpenChange={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "新建图片 Provider" }));

    expect(screen.getByLabelText("名称")).toBeInTheDocument();
    expect(screen.getByLabelText("API Key")).toBeInTheDocument();
    expect(screen.getByLabelText("模型")).toBeInTheDocument();
    expect(screen.getByLabelText("API 地址")).toBeInTheDocument();
  });

  test("shows API preview", () => {
    render(<ImageProviderDialog open onOpenChange={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "新建图片 Provider" }));

    expect(
      screen.getByText("预览：https://api.openai.com/v1/images/generations"),
    ).toBeInTheDocument();
  });

  test("preserves selected image provider type after save and reopen", () => {
    const savedProvider: ImageProviderSettings = {
      id: "img-1",
      name: "My Responses",
      type: "openai-response",
      apiKey: "image-key",
      baseUrl: "https://api.example.com/v1",
      model: "gpt-4o",
    };

    vi.mocked(settings.addImageProvider).mockImplementation(() => {
      mockState = {
        settings: { imageProviders: [savedProvider], activeImageProviderId: "img-1" },
        reload: vi.fn(),
      };
      return savedProvider;
    });

    const { rerender } = render(<ImageProviderDialog open onOpenChange={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "新建图片 Provider" }));
    fireEvent.change(screen.getByLabelText("名称"), { target: { value: "My Responses" } });
    fireEvent.change(screen.getByLabelText("API Key"), { target: { value: "image-key" } });
    fireEvent.change(screen.getByLabelText("模型"), { target: { value: "gpt-4o" } });

    const typeSelect = screen.getByRole("combobox", { name: "类型" });
    fireEvent.click(typeSelect);
    fireEvent.click(screen.getByRole("option", { name: "Responses API" }));

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(settings.addImageProvider).toHaveBeenCalled();

    // Simulate dialog close and reopen
    rerender(<ImageProviderDialog open={false} onOpenChange={() => {}} />);
    rerender(<ImageProviderDialog open onOpenChange={() => {}} />);

    expect(screen.getByRole("combobox", { name: "类型" })).toHaveTextContent("Responses API");
  });
});
