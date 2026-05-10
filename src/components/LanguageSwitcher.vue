<template>
  <button type="button" class="cesium-button cesium-toolbar-button language-switcher" :title="$t('language')" @click="toggleLanguage">
    {{ currentLocale === "en" ? "中文" : "EN" }}
  </button>
</template>

<script>
import { getCurrentLocale, setLocale } from "../i18n/index.js";

export default {
  name: "LanguageSwitcher",
  data() {
    return {
      currentLocale: getCurrentLocale(),
    };
  },
  methods: {
    toggleLanguage() {
      this.currentLocale = this.currentLocale === "en" ? "zh" : "en";
      setLocale(this.currentLocale);
    },
  },
};
</script>

<style scoped>
.language-switcher {
  font-size: 12px;
  min-width: 40px;
}
</style>
