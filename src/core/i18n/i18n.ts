type Dict = { [key: string]: string | Dict };

let translations: Dict = {};

function getStoredLocale(): string {
  try {
    return localStorage.getItem("nova-clone-lang") || "en";
  } catch {
    return "en";
  }
}

export async function loadLocale(lang?: string): Promise<boolean> {
  const locale = lang || getStoredLocale();

  try {
    let localeData: Dict;
    if (locale === "uk") {
      localeData = (await import("./locales/uk.json")) as Dict;
    } else {
      localeData = (await import("./locales/en.json")) as Dict;
    }
    translations = ("default" in localeData ? localeData.default : localeData) as Dict;
    return true;
  } catch (error) {
    console.error("Error loading locale:", error);
    return false;
  }
}

export async function switchLocale(lang: string): Promise<boolean> {
  try {
    localStorage.setItem("nova-clone-lang", lang);
    translations = {};
    const ok = await loadLocale(lang);
    if (ok) updateUI();
    return ok;
  } catch (error) {
    console.error("Error switching locale:", error);
    return false;
  }
}

export function t(key: string, params: Record<string, string | number> = {}): string {
  if (!key) return "";

  const keys = key.split(".");
  let text: string | Dict = translations;

  for (const k of keys) {
    if (text && typeof text === "object" && k in text) {
      text = text[k] as string | Dict;
    } else {
      console.warn(`Missing translation: ${key}`);
      return key;
    }
  }

  if (typeof text !== "string") {
    console.warn(`Translation key "${key}" does not point to a string value`);
    return key;
  }

  for (const [param, value] of Object.entries(params)) {
    if (value != null) {
      text = text.replace(new RegExp(`{{\\s*${param}\\s*}}`, "g"), String(value));
    }
  }

  return text;
}

export async function setupI18n(): Promise<void> {
  await loadLocale();
}

export function updateUI(): void {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (!key) return;

    const text = t(key);
    if (text !== key) {
      el.innerHTML = text;
    }
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (!key) return;

    const text = t(key);
    if (text !== key) {
      el.setAttribute("placeholder", text);
    }
  });

  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const key = el.getAttribute("data-i18n-title");
    if (!key) return;

    const text = t(key);
    if (text !== key) {
      el.setAttribute("title", text);
    }
  });

  document.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
    const key = el.getAttribute("data-i18n-aria-label");
    if (!key) return;

    const text = t(key);
    if (text !== key) {
      el.setAttribute("aria-label", text);
    }
  });
}
