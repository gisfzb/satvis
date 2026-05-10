import { createI18n } from "vue-i18n";
import en from "./en.js";
import zh from "./zh.js";

const messages = {
  en,
  zh,
};

// Get saved locale or detect from browser
function getDefaultLocale() {
  const saved = localStorage.getItem("satvis-locale");
  if (saved && (saved === "en" || saved === "zh")) {
    return saved;
  }
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith("zh")) {
    return "zh";
  }
  return "en";
}

export const i18n = createI18n({
  legacy: false,
  locale: getDefaultLocale(),
  fallbackLocale: "en",
  messages,
});

export function setLocale(locale) {
  if (locale === "en" || locale === "zh") {
    i18n.global.locale.value = locale;
    localStorage.setItem("satvis-locale", locale);
  }
}

export function getCurrentLocale() {
  return i18n.global.locale.value;
}
