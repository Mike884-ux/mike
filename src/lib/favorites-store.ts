import { create } from "zustand";
import { persist } from "zustand/middleware";

type FavoritesState = {
  favorites: string[];
  toggleFavorite: (base: string) => void;
};

export const useFavorites = create<FavoritesState>()(
  persist(
    (set) => ({
      favorites: [],
      toggleFavorite: (base) =>
        set((state) => ({
          favorites: state.favorites.includes(base)
            ? state.favorites.filter((b) => b !== base)
            : [...state.favorites, base],
        })),
    }),
    { name: "scan-favorites" },
  ),
);
