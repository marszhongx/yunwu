import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProviderType } from "@/constants";
import { beforeEach, expect, test, vi } from "vitest";
import { CharacterDialog } from "@/components/biz/CharacterDialog";
import * as exportLib from "@/lib/export";
import * as pngMetadata from "@/lib/pngMetadata";
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

vi.mock("@/lib/export", async () => {
  const actual = await vi.importActual<typeof import("@/lib/export")>("@/lib/export");
  return {
    ...actual,
    downloadBlob: vi.fn(),
    exportToJson: vi.fn(),
  };
});

vi.mock("@/lib/pngMetadata", () => ({
  fileToDataUrl: vi.fn(),
  readCharaCardFromPng: vi.fn(),
  writeCharaCardToPng: vi.fn(),
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

  expect(screen.getByRole("heading", { name: "新建角色" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "返回列表" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "编辑 新建角色" })).not.toBeInTheDocument();
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
      opening_user_choices: [],
      entries: [],
    },
  ]);

  render(<CharacterDialog open onOpenChange={() => {}} />);

  expect(await screen.findByRole("button", { name: "编辑 云雀" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "编辑 新建角色" })).toBeInTheDocument();
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
      opening_user_choices: [],
      entries: [],
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
    type: ProviderType.OPENAI,
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
    personality: "",
    scenario: "",
    mes_example: "",
    opening_user_choices: ["说明委托", "观察房间"],
    entries: [],
  });

  render(<CharacterDialog open onOpenChange={() => {}} />);

  fireEvent.click(await screen.findByRole("button", { name: "新建角色" }));
  const generationRegion = screen.getByRole("region", { name: "AI 生成角色" });
  fireEvent.change(screen.getByRole("textbox", { name: "AI 生成角色描述" }), {
    target: { value: "赛博雨夜侦探" },
  });
  expect(generationRegion).toContainElement(
    screen.getByRole("textbox", { name: "AI 生成角色描述" }),
  );
  expect(generationRegion).toContainElement(screen.getByRole("button", { name: "立即生成" }));
  fireEvent.change(screen.getByRole("textbox", { name: "名称" }), { target: { value: "旧草稿" } });
  fireEvent.click(screen.getByRole("button", { name: "立即生成" }));

  await waitFor(() =>
    expect(aiGeneration.generateCharacterCard).toHaveBeenCalledWith(provider, "赛博雨夜侦探"),
  );
  expect(screen.getByRole("textbox", { name: "AI 生成角色描述" })).toHaveValue("赛博雨夜侦探");
  await waitFor(() =>
    expect(screen.getByRole("textbox", { name: "名称" })).toHaveValue("镜城侦探"),
  );
  expect(screen.getByRole("textbox", { name: "描述" })).toHaveValue(
    "能在雨夜读取霓虹倒影的私家侦探。",
  );
});

test("does not generate a character without a generation description", async () => {
  const provider = {
    id: "provider-1",
    name: "测试 Provider",
    type: ProviderType.OPENAI,
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
      opening_user_choices: [],
      entries: [],
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
  fireEvent.click(screen.getByRole("button", { name: "返回列表" }));
  fireEvent.click(screen.getByRole("button", { name: "编辑 云雀" }));
  fireEvent.click(screen.getByRole("button", { name: "返回列表" }));
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
      opening_user_choices: [],
      entries: [],
    },
  ]);

  render(<CharacterDialog open onOpenChange={() => {}} />);

  fireEvent.click(await screen.findByRole("button", { name: "编辑 云雀" }));

  expect(screen.getByRole("heading", { name: "修改角色" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "云雀" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "返回列表" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "编辑 云雀" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "编辑 新建角色" })).not.toBeInTheDocument();
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
        opening_user_choices: [],
        entries: [],
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

test("creates, edits, and deletes characters without avatar inputs", async () => {
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
        opening_user_choices: [],
        entries: [],
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
        opening_user_choices: [],
        entries: [],
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
    opening_user_choices: [],
    entries: [],
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
    opening_user_choices: [],
    entries: [],
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

  fireEvent.click(screen.getByRole("button", { name: "返回列表" }));
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

test("saves lorebook entries without keys", async () => {
  const character = {
    id: "char-1",
    name: "常驻规则角色",
    description: "包含常驻规则。",
    first_mes: "你好",
    personality: "",
    scenario: "",
    mes_example: "",
    alternate_greetings: [],
    creator_notes: "",
    tags: [],
    creator: "",
    character_version: "",
    opening_user_choices: [],
    entries: [{ keys: [], content: "始终注入。", enabled: true }],
  };
  vi.mocked(characters.listCharacters).mockResolvedValueOnce([character]).mockResolvedValueOnce([character]);
  vi.mocked(characters.updateCharacter).mockResolvedValue(character);

  render(<CharacterDialog open onOpenChange={() => {}} />);

  fireEvent.click(await screen.findByRole("button", { name: "编辑 常驻规则角色" }));
  expect(screen.getByLabelText("条目 1 关键词")).toHaveValue("");
  expect(screen.getByLabelText("条目 1 内容")).toHaveValue("始终注入。");
  fireEvent.click(screen.getByRole("button", { name: "保存" }));

  await waitFor(() =>
    expect(characters.updateCharacter).toHaveBeenCalledWith(
      "char-1",
      expect.objectContaining({
        entries: [{ keys: [], content: "始终注入。", enabled: true }],
      }),
    ),
  );
});

test("imports a Chara Card V2 JSON file", async () => {
  const onChanged = vi.fn();
  vi.mocked(characters.listCharacters).mockResolvedValue([]);
  vi.mocked(characters.createCharacter).mockResolvedValue({
    id: "char-1",
    name: "镜城侦探",
    description: "能读取霓虹倒影。",
    first_mes: "雨夜，你推开门。",
    personality: "冷静",
    scenario: "雨夜事务所",
    mes_example: "",
    alternate_greetings: [],
    opening_user_choices: ["说明委托"],
    entries: [],
    creator_notes: "",
    tags: [],
    creator: "",
    character_version: "",
  });

  render(<CharacterDialog open onOpenChange={() => {}} onChanged={onChanged} />);
  await screen.findByText("还没有角色");
  const input = document.querySelector('input[type="file"]');
  expect(input).toHaveAttribute("accept", ".json,.png,application/json,image/png");

  fireEvent.change(input!, {
    target: {
      files: [
        new File(
          [
            JSON.stringify({
              spec: "chara_card_v2",
              spec_version: "2.0",
              data: {
                name: "镜城侦探",
                description: "能读取霓虹倒影。",
                first_mes: "雨夜，你推开门。",
                opening_user_choices: ["说明委托"],
              },
            }),
          ],
          "detective.json",
          { type: "application/json" },
        ),
      ],
    },
  });

  await waitFor(() =>
    expect(characters.createCharacter).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "镜城侦探",
        description: "能读取霓虹倒影。",
        first_mes: "雨夜，你推开门。",
        opening_user_choices: ["说明委托"],
      }),
    ),
  );
  expect(onChanged).toHaveBeenCalled();
});

test("exports selected character as Chara Card V2 JSON and PNG", async () => {
  const character = {
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
    opening_user_choices: [],
    entries: [],
    avatar: "data:image/png;base64,avatar",
  };
  vi.mocked(characters.listCharacters).mockResolvedValueOnce([character]);
  const png = new Blob(["png"], { type: "image/png" });
  vi.mocked(pngMetadata.writeCharaCardToPng).mockResolvedValue(png);

  render(<CharacterDialog open onOpenChange={() => {}} />);

  fireEvent.click(await screen.findByRole("button", { name: "编辑 云雀" }));
  fireEvent.click(screen.getByRole("button", { name: "导出 JSON" }));
  expect(exportLib.exportToJson).toHaveBeenCalledWith(
    expect.objectContaining({
      spec: "chara_card_v2",
      data: expect.objectContaining({ name: "云雀", avatar: "data:image/png;base64,avatar" }),
    }),
    "云雀.json",
  );

  fireEvent.click(screen.getByRole("button", { name: "导出 PNG" }));
  await waitFor(() =>
    expect(pngMetadata.writeCharaCardToPng).toHaveBeenCalledWith(
      expect.objectContaining({
        spec: "chara_card_v2",
        data: expect.not.objectContaining({ avatar: expect.anything() }),
      }),
      "data:image/png;base64,avatar",
    ),
  );
  expect(exportLib.downloadBlob).toHaveBeenCalledWith(png, "云雀.png");
});

test("imports a Chara Card V2 PNG file and keeps the avatar", async () => {
  vi.mocked(characters.listCharacters).mockResolvedValue([]);
  vi.mocked(pngMetadata.readCharaCardFromPng).mockResolvedValue({
    spec: "chara_card_v2",
    data: { name: "图片角色", description: "来自 PNG" },
  });
  vi.mocked(pngMetadata.fileToDataUrl).mockResolvedValue("data:image/png;base64,card");
  vi.mocked(characters.createCharacter).mockResolvedValue({
    id: "char-1",
    name: "图片角色",
    description: "来自 PNG",
    first_mes: "",
    personality: "",
    scenario: "",
    mes_example: "",
    alternate_greetings: [],
    opening_user_choices: [],
    entries: [],
    creator_notes: "",
    tags: [],
    creator: "",
    character_version: "",
    avatar: "data:image/png;base64,card",
  });

  render(<CharacterDialog open onOpenChange={() => {}} />);
  await screen.findByText("还没有角色");
  fireEvent.change(document.querySelector('input[type="file"]')!, {
    target: { files: [new File(["png"], "card.png", { type: "image/png" })] },
  });

  await waitFor(() =>
    expect(characters.createCharacter).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "图片角色",
        description: "来自 PNG",
        avatar: "data:image/png;base64,card",
      }),
    ),
  );
});
