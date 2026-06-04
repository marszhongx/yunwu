import { create } from "zustand";
import type { AppSettings, ImageProviderSettings, ProviderSettings } from "@/types";
import { getActiveImageProvider, getActiveProvider, getSettings } from "@/services/settings";

type AppState = {
  settings: AppSettings;
  activeProvider: ProviderSettings | null;
  activeImageProvider: ImageProviderSettings | null;
  init: () => void;
  reload: () => void;
};

export const useAppState = create<AppState>((set) => ({
  settings: getSettings(),
  activeProvider: getActiveProvider(),
  activeImageProvider: getActiveImageProvider(),
  init: () =>
    set({
      settings: getSettings(),
      activeProvider: getActiveProvider(),
      activeImageProvider: getActiveImageProvider(),
    }),
  reload: () =>
    set({
      settings: getSettings(),
      activeProvider: getActiveProvider(),
      activeImageProvider: getActiveImageProvider(),
    }),
}));
