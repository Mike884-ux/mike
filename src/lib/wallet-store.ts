import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Position } from "./types";
import { uid } from "./utils";

const MAX_POSITIONS = 30;

type WalletState = {
  positions: Position[];
  addPosition: (input: { base: string; symbol: string; qty: number; entry: number }) => void;
  removePosition: (id: string) => void;
};

export const useWallet = create<WalletState>()(
  persist(
    (set) => ({
      positions: [],
      addPosition: (input) =>
        set((state) => {
          const existing = state.positions.find((row) => row.symbol === input.symbol);
          if (existing) {
            return {
              positions: state.positions.map((row) =>
                row.id === existing.id ? { ...row, qty: input.qty, entry: input.entry } : row,
              ),
            };
          }
          return {
            positions: [...state.positions, { ...input, id: uid(), openedAt: Date.now() }].slice(0, MAX_POSITIONS),
          };
        }),
      removePosition: (id) =>
        set((state) => ({ positions: state.positions.filter((row) => row.id !== id) })),
    }),
    { name: "scan-wallet" },
  ),
);
