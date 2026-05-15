import { create } from "zustand";
import type { AppSettings, ProviderSettings } from "@/domain/types";
import { getActiveProvider, getSettings } from "@/services/settings";

type AppState = {
  settings: AppSettings;
  activeProvider: ProviderSettings | null;
  init: () => void;
  reload: () => void;
};

export const useAppState = create<AppState>((set) => ({
  settings: getSettings(),
  activeProvider: getActiveProvider(),
  init: () => set({ settings: getSettings(), activeProvider: getActiveProvider() }),
  reload: () => set({ settings: getSettings(), activeProvider: getActiveProvider() }),
}));
