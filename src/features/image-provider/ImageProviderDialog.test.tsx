import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ImageProviderDialog } from "./ImageProviderDialog";

vi.mock("@/store/appState", () => ({
  useAppState: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ imageProvider: null, reload: vi.fn() }),
}));

vi.mock("@/services/settings", () => ({
  saveImageProvider: vi.fn(),
}));

describe("ImageProviderDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders form fields", () => {
    render(<ImageProviderDialog open onOpenChange={() => {}} />);

    expect(screen.getByText("图片生成设置")).toBeInTheDocument();
    expect(screen.getByLabelText("API 地址")).toBeInTheDocument();
    expect(screen.getByLabelText("API Key")).toBeInTheDocument();
    expect(screen.getByLabelText("模型")).toBeInTheDocument();
  });

  test("has default values", () => {
    render(<ImageProviderDialog open onOpenChange={() => {}} />);

    expect(screen.getByLabelText("API 地址")).toHaveValue("https://api.openai.com/v1");
    expect(screen.getByLabelText("模型")).toHaveValue("dall-e-3");
  });

  test("previews the resolved image generation endpoint", () => {
    render(<ImageProviderDialog open onOpenChange={() => {}} />);

    expect(screen.getByText("预览：https://api.openai.com/v1/images/generations")).toBeInTheDocument();
  });

  test("renders save button", () => {
    render(<ImageProviderDialog open onOpenChange={() => {}} />);

    expect(screen.getByRole("button", { name: "保存" })).toBeInTheDocument();
  });
});
