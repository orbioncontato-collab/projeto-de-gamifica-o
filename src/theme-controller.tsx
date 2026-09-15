import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Moon, Sun } from "lucide-react";
import "./theme.css";

type ThemeMode = "dark" | "light";

const THEME_KEY = "orbion-ui-theme-v1";

function getSavedTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  const saved = localStorage.getItem(THEME_KEY);
  return saved === "light" ? "light" : "dark";
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.orbionTheme = theme;
  document.documentElement.style.colorScheme = theme;
  localStorage.setItem(THEME_KEY, theme);
}

export function ThemeController() {
  const [theme, setTheme] = useState<ThemeMode>(() => getSavedTheme());
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    let created: HTMLElement | null = null;
    let observer: MutationObserver | null = null;

    const mount = () => {
      const header = document.querySelector("header");
      if (!header) return false;
      const actionRow = header.querySelector<HTMLElement>(".ml-auto.flex");
      if (!actionRow) return false;

      let target = actionRow.querySelector<HTMLElement>("[data-orbion-theme-host]");
      if (!target) {
        target = document.createElement("div");
        target.dataset.orbionThemeHost = "1";
        target.className = "orbion-theme-host";
        actionRow.prepend(target);
        created = target;
      }
      setHost(target);
      return true;
    };

    if (!mount()) {
      observer = new MutationObserver(() => {
        if (mount()) {
          observer?.disconnect();
          observer = null;
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      observer?.disconnect();
      if (created?.isConnected) created.remove();
    };
  }, []);

  if (!host) return null;

  return createPortal(
    <div className="orbion-theme-switch" role="group" aria-label="Escolher tema da plataforma">
      <button
        type="button"
        className={theme === "dark" ? "active" : ""}
        onClick={() => setTheme("dark")}
        aria-pressed={theme === "dark"}
        title="Usar tema escuro"
      >
        <Moon />
        <span>Escuro</span>
      </button>
      <button
        type="button"
        className={theme === "light" ? "active" : ""}
        onClick={() => setTheme("light")}
        aria-pressed={theme === "light"}
        title="Usar tema claro"
      >
        <Sun />
        <span>Claro</span>
      </button>
    </div>,
    host,
  );
}
