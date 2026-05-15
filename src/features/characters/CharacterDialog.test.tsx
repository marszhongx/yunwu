import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { CharacterDialog } from "./CharacterDialog";
import * as aiGeneration from "@/services/aiGeneration";
import * as characters from "@/services/characters";
import * as settings from "@/services/settings";

vi.mock("@/services/aiGeneration", () => ({
  generateCharacterCard: vi.fn(),
}));

vi.mock("@/services/characters", () => ({
  createCharacter: vi.fn(),
  deleteCharacter: vi.fn(),
  listCharacters: vi.fn(),
  updateCharacter: vi.fn(),
}));

vi.mock("@/services/settings", () => ({
  getActiveProvider: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
});

test("shows an empty state before creating the first character", async () => {
  vi.mocked(characters.listCharacters).mockResolvedValueOnce([]);

  render(<CharacterDialog open onOpenChange={() => {}} />);

  expect(await screen.findByText("还没有角色")).toBeInTheDocument();
  expect(screen.getByText("先创建一个角色卡，再用它开启对话。")).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "角色" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "编辑 新建角色" })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("名称")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "导入角色" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "新建角色" }));

  expect(screen.getByRole("button", { name: "编辑 新建角色" })).toHaveAttribute(
    "aria-current",
    "true",
  );
  expect(screen.getByLabelText("名称")).toHaveValue("");
});

test("shows a selection empty state when characters exist but none is selected", async () => {
  vi.mocked(characters.listCharacters).mockResolvedValueOnce([
    {
      id: "char-1",
      name: "云雀",
      description: "旅行者",
      first_mes: "你好",
      personality: "温和",
      scenario: "山间",
      mes_example: "用户: 你好",
      alternate_greetings: [],
      creator_notes: "",
      tags: [],
      creator: "",
      character_version: "",
    },
  ]);

  render(<CharacterDialog open onOpenChange={() => {}} />);

  expect(await screen.findByText("选择一个角色")).toBeInTheDocument();
  expect(screen.getByText("从左侧选择角色进行编辑，或创建一个新角色。")).toBeInTheDocument();
  expect(screen.queryByLabelText("名称")).not.toBeInTheDocument();
});

test("places the new character item after existing characters", async () => {
  vi.mocked(characters.listCharacters).mockResolvedValueOnce([
    {
      id: "char-1",
      name: "云雀",
      description: "旅行者",
      first_mes: "你好",
      personality: "温和",
      scenario: "山间",
      mes_example: "用户: 你好",
      alternate_greetings: [],
      creator_notes: "",
      tags: [],
      creator: "",
      character_version: "",
    },
  ]);

  render(<CharacterDialog open onOpenChange={() => {}} />);

  await screen.findByRole("button", { name: "编辑 云雀" });
  const buttons = screen.getAllByRole("button", { name: /编辑 (云雀|新建角色)/ });
  expect(buttons.map((button) => button.textContent)).toEqual(["云雀", "新建角色"]);
});

test("generates a new character from the generation description", async () => {
  const provider = {
    id: "provider-1",
    name: "测试 Provider",
    type: "openai" as const,
    apiKey: "key",
    baseUrl: "https://example.test",
    model: "test-model",
    enabled: true,
  };
  vi.mocked(characters.listCharacters).mockResolvedValueOnce([]);
  vi.mocked(settings.getActiveProvider).mockReturnValue(provider);
  vi.mocked(aiGeneration.generateCharacterCard).mockResolvedValue({
    name: "镜城侦探",
    description: "能在雨夜读取霓虹倒影的私家侦探。",
    first_mes: "雨水敲着招牌时，你推开了事务所的门。",
    opening_user_choices: ["说明委托", "观察房间"],
    entries: [],
  });

  render(<CharacterDialog open onOpenChange={() => {}} />);

  fireEvent.click(await screen.findByRole("button", { name: "新建角色" }));
  const generationRegion = screen.getByRole("region", { name: "AI 生成角色" });
  fireEvent.change(screen.getByRole("textbox", { name: "AI 生成角色描述" }), {
    target: { value: "赛博雨夜侦探" },
  });
  expect(generationRegion).toContainElement(screen.getByRole("textbox", { name: "AI 生成角色描述" }));
  expect(generationRegion).toContainElement(screen.getByRole("button", { name: "立即生成" }));
  fireEvent.change(screen.getByRole("textbox", { name: "名称" }), { target: { value: "旧草稿" } });
  fireEvent.click(screen.getByRole("button", { name: "立即生成" }));

  await waitFor(() =>
    expect(aiGeneration.generateCharacterCard).toHaveBeenCalledWith(provider, "赛博雨夜侦探"),
  );
  expect(screen.getByRole("textbox", { name: "AI 生成角色描述" })).toHaveValue("赛博雨夜侦探");
  expect(screen.getByRole("textbox", { name: "名称" })).toHaveValue("镜城侦探");
  expect(screen.getByRole("textbox", { name: "描述" })).toHaveValue("能在雨夜读取霓虹倒影的私家侦探。");
});

test("does not generate a character without a generation description", async () => {
  const provider = {
    id: "provider-1",
    name: "测试 Provider",
    type: "openai" as const,
    apiKey: "key",
    baseUrl: "https://example.test",
    model: "test-model",
    enabled: true,
  };
  vi.mocked(characters.listCharacters).mockResolvedValueOnce([]);
  vi.mocked(settings.getActiveProvider).mockReturnValue(provider);

  render(<CharacterDialog open onOpenChange={() => {}} />);

  fireEvent.click(await screen.findByRole("button", { name: "新建角色" }));
  fireEvent.click(screen.getByRole("button", { name: "立即生成" }));

  expect(aiGeneration.generateCharacterCard).not.toHaveBeenCalled();
});

test("resets character generation description when starting or clearing creation", async () => {
  vi.mocked(characters.listCharacters).mockResolvedValueOnce([
    {
      id: "char-1",
      name: "云雀",
      description: "旅行者",
      first_mes: "你好",
      personality: "温和",
      scenario: "山间",
      mes_example: "用户: 你好",
      alternate_greetings: [],
      creator_notes: "",
      tags: [],
      creator: "",
      character_version: "",
    },
  ]);

  render(<CharacterDialog open onOpenChange={() => {}} />);

  fireEvent.click(await screen.findByRole("button", { name: "编辑 新建角色" }));
  fireEvent.change(screen.getByRole("textbox", { name: "AI 生成角色描述" }), {
    target: { value: "赛博雨夜侦探" },
  });
  fireEvent.click(screen.getByRole("button", { name: "清空" }));
  expect(screen.getByRole("textbox", { name: "AI 生成角色描述" })).toHaveValue("");

  fireEvent.change(screen.getByRole("textbox", { name: "AI 生成角色描述" }), {
    target: { value: "荒原信使" },
  });
  fireEvent.click(screen.getByRole("button", { name: "编辑 云雀" }));
  fireEvent.click(screen.getByRole("button", { name: "编辑 新建角色" }));
  expect(screen.getByRole("textbox", { name: "AI 生成角色描述" })).toHaveValue("");
});

test("shows AI generation only while creating a character", async () => {
  vi.mocked(characters.listCharacters).mockResolvedValueOnce([
    {
      id: "char-1",
      name: "云雀",
      description: "旅行者",
      first_mes: "你好",
      personality: "温和",
      scenario: "山间",
      mes_example: "用户: 你好",
      alternate_greetings: [],
      creator_notes: "",
      tags: [],
      creator: "",
      character_version: "",
    },
  ]);

  render(<CharacterDialog open onOpenChange={() => {}} />);

  fireEvent.click(await screen.findByRole("button", { name: "编辑 云雀" }));

  expect(screen.queryByRole("heading", { name: "云雀" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "编辑 云雀" })).toHaveAttribute("aria-current", "true");
  expect(screen.getByRole("button", { name: "编辑 新建角色" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "删除" })).toBeInTheDocument();
  expect(screen.queryByRole("textbox", { name: "AI 生成角色描述" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "立即生成" })).not.toBeInTheDocument();
});

test("returns to new character state after deleting the character being edited", async () => {
  vi.mocked(characters.listCharacters)
    .mockResolvedValueOnce([
      {
        id: "char-1",
        name: "云雀",
        description: "旅行者",
        first_mes: "你好",
        personality: "温和",
        scenario: "山间",
        mes_example: "用户: 你好",
        alternate_greetings: [],
        creator_notes: "",
        tags: [],
        creator: "",
        character_version: "",
      },
    ])
    .mockResolvedValueOnce([]);
  vi.mocked(characters.deleteCharacter).mockResolvedValue();

  render(<CharacterDialog open onOpenChange={() => {}} />);

  fireEvent.click(await screen.findByRole("button", { name: "编辑 云雀" }));
  expect(screen.queryByRole("heading", { name: "云雀" })).not.toBeInTheDocument();
  expect(screen.getByLabelText("名称")).toHaveValue("云雀");

  fireEvent.click(screen.getByRole("button", { name: "删除" }));

  await waitFor(() => expect(screen.getByText("还没有角色")).toBeInTheDocument());
  expect(screen.queryByLabelText("名称")).not.toBeInTheDocument();
});

test("creates, edits, and deletes characters without avatar fields", async () => {
  const onChanged = vi.fn();
  vi.mocked(characters.listCharacters)
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      {
        id: "char-1",
        name: "云雀",
        description: "旅行者",
        first_mes: "你好",
        personality: "温和",
        scenario: "山间",
        mes_example: "用户: 你好",
        alternate_greetings: [],
        creator_notes: "",
        tags: [],
        creator: "",
        character_version: "",
      },
    ])
    .mockResolvedValueOnce([
      {
        id: "char-1",
        name: "云雀",
        description: "旅行者",
        first_mes: "你好",
        personality: "温和",
        scenario: "山间",
        mes_example: "用户: 你好",
        alternate_greetings: [],
        creator_notes: "",
        tags: [],
        creator: "",
        character_version: "",
      },
    ])
    .mockResolvedValueOnce([]);

  vi.mocked(characters.createCharacter).mockResolvedValue({
    id: "char-1",
    name: "云雀",
    description: "旅行者",
    first_mes: "你好",
    personality: "",
    scenario: "",
    mes_example: "",
    alternate_greetings: [],
    creator_notes: "",
    tags: [],
    creator: "",
    character_version: "",
  });
  vi.mocked(characters.updateCharacter).mockResolvedValue({
    id: "char-1",
    name: "云雀",
    description: "远行者",
    first_mes: "你好",
    personality: "温和",
    scenario: "山间",
    mes_example: "用户: 你好",
    alternate_greetings: [],
    creator_notes: "",
    tags: [],
    creator: "",
    character_version: "",
  });
  vi.mocked(characters.deleteCharacter).mockResolvedValue();

  render(<CharacterDialog open onOpenChange={() => {}} onChanged={onChanged} />);

  expect(await screen.findByText("角色管理")).toBeInTheDocument();
  expect(screen.queryByText(/头像|图片|avatar|image/i)).not.toBeInTheDocument();

  fireEvent.click(screen.getAllByRole("button", { name: "新建角色" })[0]);
  fireEvent.change(screen.getByLabelText("名称"), { target: { value: "云雀" } });
  fireEvent.change(screen.getByLabelText("描述"), { target: { value: "旅行者" } });
  fireEvent.change(screen.getByLabelText("开场白"), { target: { value: "你好" } });
  fireEvent.click(screen.getByRole("button", { name: "添加选项" }));
  fireEvent.change(screen.getByLabelText("开场选项 1"), { target: { value: "观察四周" } });
  fireEvent.click(screen.getByRole("button", { name: "添加选项" }));
  fireEvent.change(screen.getByLabelText("开场选项 2"), { target: { value: "向前走" } });
  fireEvent.click(screen.getByRole("button", { name: "保存" }));

  await waitFor(() =>
    expect(characters.createCharacter).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "云雀",
        description: "旅行者",
        first_mes: "你好",
        opening_user_choices: ["观察四周", "向前走"],
      }),
    ),
  );
  expect(onChanged).toHaveBeenCalledTimes(1);

  fireEvent.click(await screen.findByRole("button", { name: "编辑 云雀" }));
  fireEvent.change(screen.getByLabelText("描述"), { target: { value: "远行者" } });
  fireEvent.click(screen.getByRole("button", { name: "保存" }));

  await waitFor(() =>
    expect(characters.updateCharacter).toHaveBeenCalledWith(
      "char-1",
      expect.objectContaining({ description: "远行者" }),
    ),
  );
  expect(onChanged).toHaveBeenCalledTimes(2);

  fireEvent.click(await screen.findByRole("button", { name: "删除" }));

  await waitFor(() => expect(characters.deleteCharacter).toHaveBeenCalledWith("char-1"));
  expect(onChanged).toHaveBeenCalledTimes(3);
});
