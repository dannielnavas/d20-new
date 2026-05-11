import { DOCUMENT } from "@angular/common";
import { Injectable, inject, signal } from "@angular/core";

export type ThemeMode = "light" | "dark";

@Injectable({ providedIn: "root" })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storageKey = "d20.theme";

  readonly theme = signal<ThemeMode>("dark");

  init(): void {
    const storedTheme = localStorage.getItem(this.storageKey);
    const normalizedTheme: ThemeMode = storedTheme === "light" ? "light" : "dark";
    this.setTheme(normalizedTheme);
  }

  toggle(): void {
    this.setTheme(this.theme() === "dark" ? "light" : "dark");
  }

  setTheme(theme: ThemeMode): void {
    this.theme.set(theme);
    this.document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(this.storageKey, theme);
  }
}
