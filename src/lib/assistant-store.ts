/** The floating AI assistant: whether it is open, and which asset the member is looking at. */
import { useEffect } from "react";
import { create } from "zustand";

export type AssistantFocus = { base: string; name?: string };

type AssistantState = {
  open: boolean;
  focus: AssistantFocus | null;
  setOpen: (open: boolean) => void;
  setFocus: (focus: AssistantFocus | null) => void;
};

export const useAssistant = create<AssistantState>((set) => ({
  open: false,
  focus: null,
  setOpen: (open) => set({ open }),
  setFocus: (focus) => set({ focus }),
}));

/**
 * Tells the assistant which asset is on screen while the calling component is
 * mounted; the previous one comes back when it goes away (closing a coin window
 * returns to the coin page underneath, if any).
 */
export function useAssistantFocus(base: string | null | undefined, name?: string): void {
  useEffect(() => {
    if (!base) return;
    const previous = useAssistant.getState().focus;
    useAssistant.getState().setFocus({ base: base.toUpperCase(), name });
    return () => {
      if (useAssistant.getState().focus?.base === base.toUpperCase()) useAssistant.getState().setFocus(previous);
    };
  }, [base, name]);
}
