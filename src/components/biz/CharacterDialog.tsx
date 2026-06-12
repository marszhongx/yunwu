import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Loader2, Plus, Sparkles, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fromCharaCardV2, toCharaCardV2 } from "@/lib/charaCardV2";
import { downloadBlob, exportToJson, importFromJson, safeFilename } from "@/lib/export";
import { fileToDataUrl, readCharaCardFromPng, writeCharaCardToPng } from "@/lib/pngMetadata";
import { cn } from "@/lib/utils";
import {
  createCharacter,
  deleteCharacter,
  listCharacters,
  updateCharacter,
} from "@/services/characters";
import { generateCharacterCard } from "@/services/aiGeneration";
import { getActiveProvider } from "@/services/settings";
import type { CharacterCard, LorebookEntry } from "@/types";
import { ConfigDialogLayout } from "@/components/biz/ConfigDialogLayout";
import { SaveButton } from "@/components/biz/SaveButton";
import { StepBackButton } from "@/components/biz/StepBackButton";

type CharacterDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
  onStartChat?: (characterId: string) => void;
};

type LorebookEntryForm = {
  keysText: string;
  content: string;
  enabled: boolean;
};

type CharacterForm = {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  opening_user_choices: string[];
  entries: LorebookEntryForm[];
};

function createEmptyEntry(): LorebookEntryForm {
  return { keysText: "", content: "", enabled: true };
}

const emptyForm: CharacterForm = {
  name: "",
  description: "",
  personality: "",
  scenario: "",
  first_mes: "",
  mes_example: "",
  opening_user_choices: [],
  entries: [createEmptyEntry()],
};

export function CharacterDialog({
  open,
  onOpenChange,
  onChanged,
  onStartChat,
}: CharacterDialogProps) {
  const [characters, setCharacters] = useState<CharacterCard[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CharacterForm>(emptyForm);
  const [generationDescription, setGenerationDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadCharacters = useCallback(async () => {
    setCharacters(await listCharacters());
  }, []);

  useEffect(() => {
    if (open) {
      void loadCharacters();
    }
  }, [loadCharacters, open]);

  function updateField<K extends keyof CharacterForm>(field: K, value: CharacterForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateEntry(index: number, patch: Partial<LorebookEntryForm>) {
    setForm((current) => ({
      ...current,
      entries: current.entries.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
    }));
  }

  function addEntry() {
    setForm((current) => ({ ...current, entries: [...current.entries, createEmptyEntry()] }));
  }

  function removeEntry(index: number) {
    setForm((current) => {
      if (current.entries.length === 1) {
        return { ...current, entries: [createEmptyEntry()] };
      }
      return { ...current, entries: current.entries.filter((_, i) => i !== index) };
    });
  }

  function startCreate() {
    setSelectedId(null);
    setCreating(true);
    setForm(emptyForm);
    setGenerationDescription("");
  }

  function backToList() {
    setSelectedId(null);
    setCreating(false);
    setForm(emptyForm);
    setGenerationDescription("");
  }

  function clearForm() {
    setForm(emptyForm);
    setGenerationDescription("");
  }

  async function handleGenerate() {
    if (isGenerating) return;

    const description = generationDescription.trim();

    if (!description) {
      toast.error("请输入需求描述");
      return;
    }

    const provider = getActiveProvider();

    if (!provider) {
      toast.error("请先配置并激活 Provider");
      return;
    }

    setIsGenerating(true);

    try {
      const generated = await generateCharacterCard(provider, description);
      setForm({
        name: generated.name ?? "",
        description: generated.description ?? "",
        personality: generated.personality ?? "",
        scenario: generated.scenario ?? "",
        first_mes: generated.first_mes ?? "",
        mes_example: generated.mes_example ?? "",
        opening_user_choices: generated.opening_user_choices ?? [],
        entries: entriesToForm(generated.entries ?? []),
      });
      toast.success("角色卡已生成，请确认后保存");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "生成失败");
    } finally {
      setIsGenerating(false);
    }
  }

  function editCharacter(character: CharacterCard) {
    setSelectedId(character.id);
    setCreating(false);
    setForm({
      name: character.name,
      description: character.description,
      personality: character.personality ?? "",
      scenario: character.scenario ?? "",
      first_mes: character.first_mes,
      mes_example: character.mes_example ?? "",
      opening_user_choices: character.opening_user_choices ?? [],
      entries: entriesToForm(character.entries ?? []),
    });
  }

  async function saveCharacter() {
    if (!creating && !selectedId) return;

    if (!form.name.trim() || !form.description.trim()) {
      toast.error("名称和描述不能为空");
      return;
    }

    const characterInput = {
      ...form,
      opening_user_choices: form.opening_user_choices
        .map((choice) => choice.trim())
        .filter(Boolean),
      entries: entriesFromForm(form.entries),
    };

    if (selectedId) {
      const character = await updateCharacter(selectedId, characterInput);
      if (character) {
        editCharacter(character);
      }
    } else {
      const character = await createCharacter(characterInput);
      editCharacter(character);
    }

    setCreating(false);
    await loadCharacters();
    onChanged?.();
  }

  async function removeSelectedCharacter() {
    if (!selectedId) return;

    await deleteCharacter(selectedId);
    setSelectedId(null);
    setCreating(false);
    setForm(emptyForm);
    await loadCharacters();
    onChanged?.();
  }

  function handleExportJson() {
    const character = characters.find((c) => c.id === selectedId);
    if (!character) return;

    exportToJson(toCharaCardV2(character), safeFilename(character.name, ".json"));
  }

  async function handleExportPng() {
    const character = characters.find((c) => c.id === selectedId);
    if (!character) return;

    try {
      const png = await writeCharaCardToPng(toCharaCardV2(character, { includeAvatar: false }), character.avatar);
      downloadBlob(png, safeFilename(character.name, ".png"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "导出失败");
    }
  }

  async function handleImport(file: File) {
    try {
      const data = await importCharacter(file);
      await createCharacter(data);
      await loadCharacters();
      onChanged?.();
      toast.success("导入成功");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "导入失败");
    }
  }

  async function importCharacter(file: File): Promise<Partial<CharacterCard>> {
    if (isPngFile(file)) {
      const raw = await readCharaCardFromPng(file);
      return { ...fromCharaCardV2(raw, file.name), avatar: await fileToDataUrl(file) };
    }

    return fromCharaCardV2(await importFromJson<unknown>(file), file.name);
  }

  const isEditing = creating || selectedId !== null;
  const dialogTitle = creating ? "新建角色" : selectedId ? "修改角色" : "角色管理";

  return (
    <ConfigDialogLayout
      open={open}
      onOpenChange={onOpenChange}
      title={dialogTitle}
      titleAction={isEditing ? <StepBackButton onClick={backToList} /> : null}
      rightScroll
      rightFooter={
        isEditing ? (
          <DialogFooter>
            {selectedId ? (
              <>
                <Button type="button" variant="outline" onClick={handleExportJson}>
                  导出 JSON
                </Button>
                <Button type="button" variant="outline" onClick={() => void handleExportPng()}>
                  导出 PNG
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    onStartChat?.(selectedId);
                    onOpenChange(false);
                  }}
                >
                  开始对话
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => void removeSelectedCharacter()}
                >
                  删除
                </Button>
              </>
            ) : null}
            <Button type="button" variant="outline" onClick={clearForm} disabled={isGenerating}>
              清空
            </Button>
            <SaveButton onSave={() => void saveCharacter()} disabled={isGenerating} />
          </DialogFooter>
        ) : null
      }
    >
      {isEditing ? (
        <>
          {creating ? (
            <section
              aria-label="AI 生成角色"
              className="space-y-3 rounded-lg border border-border/70 bg-muted/30 p-3"
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="size-4" />
                AI 生成角色
              </div>
              <Textarea
                aria-label="AI 生成角色描述"
                placeholder="描述你想生成的角色设定、性格、场景或互动钩子"
                value={generationDescription}
                onChange={(event) => setGenerationDescription(event.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => void handleGenerate()}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 size-4" />
                )}
                立即生成
              </Button>
            </section>
          ) : null}
          <Field label="名称" value={form.name} onChange={(value) => updateField("name", value)} />
          <TextField
            label="描述"
            value={form.description}
            onChange={(value) => updateField("description", value)}
          />
          <TextField
            label="性格"
            value={form.personality}
            onChange={(value) => updateField("personality", value)}
          />
          <TextField
            label="场景"
            value={form.scenario}
            onChange={(value) => updateField("scenario", value)}
          />
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium">条目</h3>
              <Button type="button" variant="outline" size="sm" onClick={addEntry}>
                新增条目
              </Button>
            </div>
            <div className="space-y-2">
              {form.entries.map((entry, index) => {
                const entryNumber = index + 1;

                return (
                  <div key={index} className="space-y-3 rounded-lg border border-border/70 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">条目 {entryNumber}</span>
                      <label className="flex items-center gap-2 text-sm text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={entry.enabled}
                          aria-label={`条目 ${entryNumber} 启用`}
                          onChange={(event) =>
                            updateEntry(index, { enabled: event.target.checked })
                          }
                        />
                        启用
                      </label>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`character-entry-${index}-keys`}>关键词</Label>
                      <Input
                        id={`character-entry-${index}-keys`}
                        aria-label={`条目 ${entryNumber} 关键词`}
                        placeholder="关键词1, 关键词2"
                        value={entry.keysText}
                        onChange={(event) => updateEntry(index, { keysText: event.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`character-entry-${index}-content`}>内容</Label>
                      <Textarea
                        id={`character-entry-${index}-content`}
                        aria-label={`条目 ${entryNumber} 内容`}
                        className="min-h-24"
                        value={entry.content}
                        onChange={(event) => updateEntry(index, { content: event.target.value })}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`删除条目 ${entryNumber}`}
                      onClick={() => removeEntry(index)}
                    >
                      删除条目
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
          <TextField
            label="开场白"
            value={form.first_mes}
            onChange={(value) => updateField("first_mes", value)}
          />
          <TextField
            label="示例对话"
            value={form.mes_example}
            onChange={(value) => updateField("mes_example", value)}
          />
          <OpeningChoicesField
            value={form.opening_user_choices}
            onChange={(value) => updateField("opening_user_choices", value)}
          />
        </>
      ) : (
        <CharacterList
          characters={characters}
          fileInputRef={fileInputRef}
          onEdit={editCharacter}
          onCreate={startCreate}
          onImport={handleImport}
        />
      )}
    </ConfigDialogLayout>
  );
}

type CharacterListProps = {
  characters: CharacterCard[];
  fileInputRef: RefObject<HTMLInputElement | null>;
  onEdit: (character: CharacterCard) => void;
  onCreate: () => void;
  onImport: (file: File) => Promise<void>;
};

function CharacterList({
  characters,
  fileInputRef,
  onEdit,
  onCreate,
  onImport,
}: CharacterListProps) {
  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept=".json,.png,application/json,image/png"
      className="hidden"
      onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) {
          void onImport(file);
          event.target.value = "";
        }
      }}
    />
  );

  if (characters.length === 0) {
    return (
      <div className="flex min-h-[24rem] flex-col items-center justify-center rounded-lg border border-dashed border-border/70 p-8 text-center">
        <h3 className="text-base font-medium">还没有角色</h3>
        <p className="mt-2 text-sm text-muted-foreground">先创建一个角色卡，再用它开启对话。</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={onCreate}>
            新建角色
          </Button>
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 size-4" />
            导入角色
          </Button>
        </div>
        {fileInput}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {characters.map((character) => (
        <CharacterListButton
          key={character.id}
          label={character.name}
          onClick={() => onEdit(character)}
        />
      ))}
      <CharacterListButton dashed label="新建角色" onClick={onCreate} />
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2 px-3 py-2 font-normal"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="size-4" />
        导入角色
      </Button>
      {fileInput}
    </div>
  );
}

type CharacterListButtonProps = {
  active?: boolean;
  dashed?: boolean;
  label: string;
  onClick: () => void;
};

function CharacterListButton({ active, dashed = false, label, onClick }: CharacterListButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "block w-full rounded-md border border-border/70 px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
        dashed &&
          "flex items-center justify-center gap-2 border-dashed border-foreground/35 text-center text-foreground hover:border-ring hover:text-accent-foreground",
        active && "border-ring bg-accent text-accent-foreground",
      )}
      aria-current={active ? "true" : undefined}
      aria-label={`编辑 ${label}`}
      onClick={onClick}
    >
      {dashed ? <Plus className="size-4" /> : null}
      {label}
    </button>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

function Field({ label, value, onChange }: FieldProps) {
  return (
    <div>
      <Label htmlFor={`character-${label}`}>{label}</Label>
      <Input
        id={`character-${label}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function TextField({ label, value, onChange }: FieldProps) {
  return (
    <div>
      <Label htmlFor={`character-${label}`}>{label}</Label>
      <Textarea
        id={`character-${label}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

type OpeningChoicesFieldProps = {
  value: string[];
  onChange: (value: string[]) => void;
};

function OpeningChoicesField({ value, onChange }: OpeningChoicesFieldProps) {
  function updateChoice(index: number, choice: string) {
    onChange(value.map((current, i) => (i === index ? choice : current)));
  }

  function addChoice() {
    onChange([...value, ""]);
  }

  function removeChoice(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div>
      <Label>开场选项</Label>
      <div className="space-y-2">
        {value.map((choice, index) => (
          <div key={index} className="flex gap-2">
            <Input
              aria-label={`开场选项 ${index + 1}`}
              value={choice}
              placeholder={`选项 ${index + 1}`}
              onChange={(event) => updateChoice(index, event.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              aria-label={`删除开场选项 ${index + 1}`}
              onClick={() => removeChoice(index)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-foreground/35 px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-ring hover:bg-accent hover:text-accent-foreground"
          onClick={addChoice}
        >
          <Plus className="size-4" />
          添加选项
        </button>
      </div>
    </div>
  );
}

function entriesToForm(entries: LorebookEntry[]): LorebookEntryForm[] {
  if (!Array.isArray(entries) || entries.length === 0) return [createEmptyEntry()];

  const forms = entries
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;

      const keys = Array.isArray(entry.keys)
        ? entry.keys.filter((k): k is string => typeof k === "string")
        : [];
      const content = typeof entry.content === "string" ? entry.content : "";
      const enabled = entry.enabled !== false;

      if (keys.length === 0 && !content) return null;

      return { keysText: keys.join(", "), content, enabled };
    })
    .filter((entry): entry is LorebookEntryForm => entry !== null);

  return forms.length > 0 ? forms : [createEmptyEntry()];
}

function entriesFromForm(entries: LorebookEntryForm[]): LorebookEntry[] {
  return entries
    .map((entry) => {
      const keys = entry.keysText
        .split(",")
        .map((key) => key.trim())
        .filter(Boolean);
      const content = entry.content.trim();

      if (!content) {
        return null;
      }

      return { keys, content, enabled: entry.enabled };
    })
    .filter((entry): entry is LorebookEntry => entry !== null);
}

function isPngFile(file: File): boolean {
  return file.type === "image/png" || file.name.toLowerCase().endsWith(".png");
}
