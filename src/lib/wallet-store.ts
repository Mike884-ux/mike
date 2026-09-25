import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Position } from "./types";
import { averageIn } from "./portfolio-math";
import { uid } from "./utils";

export const MAX_POSITIONS = 30;

export type AddResult = "added" | "merged" | "full";

type WalletState = {
  positions: Position[];
  addPosition: (input: { base: string; symbol: string; qty: number; entry: number }) => AddResult;
  removePosition: (id: string) => void;
};

export const useWallet = create<WalletState>()(
  persist(
    (set, get) => ({
      positions: [],
      addPosition: (input) => {
        const { positions } = get();
        const existing = positions.find((row) => row.symbol === input.symbol);
        if (existing) {
          // Buying more of a coin you already hold averages in. It used to
          // overwrite the old quantity and entry, silently losing the position.
          const merged = averageIn(existing, input);
          set({
            positions: positions.map((row) =>
              row.id === existing.id ? { ...row, ...merged } : row,
            ),
          });
          return "merged";
        }
        // At the cap the new row used to be appended and then sliced off, so it
        // vanished without a word. Refuse explicitly instead.
        if (positions.length >= MAX_POSITIONS) return "full";
        set({ positions: [...positions, { ...input, id: uid(), openedAt: Date.now() }] });
        return "added";
      },
      removePosition: (id) =>
        set((state) => ({ positions: state.positions.filter((row) => row.id !== id) })),
    }),
    { name: "scan-wallet" },
  ),
);
