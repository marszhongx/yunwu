import { create } from "zustand";
import type { AppSettings, ImageProviderSettings, ProviderSettings } from "@/domain/types";
import { getActiveProvider, getImageProvider, getSettings } from "@/services/settings";

type AppState = {
  settings: AppSettings;
  activeProvider: ProviderSettings | null;
  imageProvider: ImageProviderSettings | null;
  init: () => void;
  reload: () => void;
};

export const useAppState = create<AppState>((set) => ({
  settings: getSettings(),
  activeProvider: getActiveProvider(),
  imageProvider: getImageProvider(),
  init: () =>
    set({
      settings: getSettings(),
      activeProvider: getActiveProvider(),
      imageProvider: getImageProvider(),
    }),
  reload: () =>
    set({
      settings: getSettings(),
      activeProvider: getActiveProvider(),
      imageProvider: getImageProvider(),
    }),
}));
