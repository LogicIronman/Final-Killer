import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

const STORAGE_KEY = "final-killer-learning-settings";

type LearningSettings = {
  selectedQuizBankId: number | null;
  includeEssay: boolean;
  countdownEnabled: boolean;
  countdownExamId: number | null;
  countdownHiddenExamIds: number[];
  countdownOrder: number[];
};

type LearningSettingsContextValue = LearningSettings & {
  setSelectedQuizBankId: (id: number | null) => void;
  setIncludeEssay: (enabled: boolean) => void;
  setCountdownEnabled: (enabled: boolean) => void;
  setCountdownExamId: (id: number | null) => void;
  hideCountdownExam: (id: number) => void;
  setCountdownOrder: (ids: number[]) => void;
  moveCountdownExam: (id: number, direction: "up" | "down", visibleIds?: number[]) => void;
  resetSettings: () => void;
};

const defaultSettings: LearningSettings = {
  selectedQuizBankId: null,
  includeEssay: true,
  countdownEnabled: true,
  countdownExamId: null,
  countdownHiddenExamIds: [],
  countdownOrder: []
};

const LearningSettingsContext = createContext<LearningSettingsContextValue | null>(null);

export function LearningSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<LearningSettings>(() => {
    try {
      return { ...defaultSettings, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") };
    } catch {
      return defaultSettings;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const value = useMemo<LearningSettingsContextValue>(
    () => ({
      ...settings,
      setSelectedQuizBankId: (id) => setSettings((current) => ({ ...current, selectedQuizBankId: id })),
      setIncludeEssay: (enabled) => setSettings((current) => ({ ...current, includeEssay: enabled })),
      setCountdownEnabled: (enabled) => setSettings((current) => ({ ...current, countdownEnabled: enabled })),
      setCountdownExamId: (id) => setSettings((current) => ({ ...current, countdownExamId: id })),
      hideCountdownExam: (id) =>
        setSettings((current) => ({
          ...current,
          countdownHiddenExamIds: Array.from(new Set([...current.countdownHiddenExamIds, id])),
          countdownExamId: current.countdownExamId === id ? null : current.countdownExamId
        })),
      setCountdownOrder: (ids) => setSettings((current) => ({ ...current, countdownOrder: ids })),
      moveCountdownExam: (id, direction, visibleIds = []) =>
        setSettings((current) => {
          const order = current.countdownOrder.length ? [...current.countdownOrder] : [...visibleIds];
          if (!order.includes(id)) order.push(id);
          const index = order.indexOf(id);
          const nextIndex = direction === "up" ? Math.max(0, index - 1) : Math.min(order.length - 1, index + 1);
          [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
          return { ...current, countdownOrder: order };
        }),
      resetSettings: () => setSettings(defaultSettings)
    }),
    [settings]
  );

  return (
    <LearningSettingsContext.Provider value={value}>
      {children}
    </LearningSettingsContext.Provider>
  );
}

export function useLearningSettings() {
  const value = useContext(LearningSettingsContext);
  if (!value) {
    throw new Error("useLearningSettings must be used inside LearningSettingsProvider");
  }
  return value;
}
