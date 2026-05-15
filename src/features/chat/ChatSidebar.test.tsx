import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { ChatSidebar } from "./ChatSidebar";
import type { CharacterCard, Chat } from "@/domain/types";

test("renders selected chat, character, and enabled lorebook entries", () => {
  render(
    <ChatSidebar
      chat={chat({
        latestStatus: "体力良好",
        summaries: ["抵达山脚", "进入村庄"],
        latestSummary: "进入村庄",
      })}
      character={character({
        name: "云雀",
        description: "旅行者",
        entries: [
          { keys: ["山", "雾"], content: "山间常有白雾。", enabled: true },
          { keys: ["海"], content: "隐藏条目", enabled: false },
        ],
      })}
    />,
  );

  expect(screen.getByText("角色状态")).toBeInTheDocument();
  expect(screen.getByText("体力良好")).toBeInTheDocument();
  const items = screen.getAllByRole("listitem");
  expect(items).toHaveLength(2);
  expect(items[0]).toHaveTextContent("抵达山脚");
  expect(items[1]).toHaveTextContent("进入村庄");
  expect(screen.getByText("云雀", { exact: false })).toHaveClass("whitespace-pre-wrap");
  expect(screen.getByText(/山, 雾/).textContent).toBe("山, 雾\n山间常有白雾。");
  expect(screen.queryByText("隐藏条目")).not.toBeInTheDocument();
});

test("falls back to latestSummary when summaries array is empty", () => {
  render(<ChatSidebar chat={chat({ latestSummary: "旧摘要" })} character={null} />);
});

test("renders empty sidebar states", () => {
  render(<ChatSidebar chat={null} character={null} />);

  expect(screen.getByText("暂无状态")).toBeInTheDocument();
  expect(screen.getByText("暂无摘要")).toBeInTheDocument();
  expect(screen.getByText("未选择角色")).toBeInTheDocument();
  expect(screen.getByText("暂无条目")).toBeInTheDocument();
});

function chat(overrides: Partial<Chat> = {}): Chat {
  return {
    id: "chat-1",
    title: "对话",
    charId: "char-1",
    summaries: [],
    latestSummary: "",
    latestStatus: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function character(overrides: Partial<CharacterCard> = {}): CharacterCard {
  return {
    id: "char-1",
    name: "角色",
    description: "描述",
    first_mes: "你好",
    personality: "温和",
    scenario: "山间",
    mes_example: "",
    alternate_greetings: [],
    opening_user_choices: [],
    entries: [],
    creator_notes: "",
    tags: [],
    creator: "",
    character_version: "",
    ...overrides,
  };
}
