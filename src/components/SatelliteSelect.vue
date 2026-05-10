<template>
  <div class="satellite-select">
    <div class="panel-header">
      <i class="panel-icon svg-sat"></i>
      <span class="panel-title">{{ $t("satelliteSelection") || "卫星选择" }}</span>
      <div class="header-stats">
        <span class="stat-badge">
          <i class="stat-icon icon-sat"></i>
          {{ totalSatelliteCount }}
        </span>
      </div>
    </div>

    <div class="select-section">
      <div class="section-header">
        <i class="section-icon icon-group"></i>
        <span class="section-title">{{ $t("enabledSatelliteGroups") }}</span>
        <span v-if="enabledTags.length > 0" class="section-count">{{ enabledTags.length }}</span>
      </div>
      <div class="section-content">
        <vue-multiselect
          v-model="enabledTags"
          :options="availableTags"
          :multiple="true"
          :searchable="false"
          :placeholder="satelliteGroupsPlaceholder"
          :show-labels="false"
          :hide-selected="true"
        >
        </vue-multiselect>
      </div>
      <div class="section-actions">
        <button class="action-btn" @click="selectAllGroups">
          <i class="btn-icon icon-check-all"></i>
          {{ $t("selectAll") || "全选" }}
        </button>
        <button class="action-btn" @click="clearAllGroups">
          <i class="btn-icon icon-clear"></i>
          {{ $t("clearAll") || "清除" }}
        </button>
      </div>
    </div>

    <div class="select-section">
      <div class="section-header">
        <i class="section-icon icon-satellite"></i>
        <span class="section-title">{{ $t("enabledSatellites") }}</span>
        <span v-if="enabledSatellites.length > 0 || satellitesEnabledByTag.length > 0" class="section-count">
          {{ enabledSatellites.length + satellitesEnabledByTag.length }}
        </span>
      </div>
      <div class="section-content">
        <vue-multiselect
          v-model="allEnabledSatellites"
          :options="availableSatellites"
          :multiple="true"
          group-values="sats"
          group-label="tag"
          :group-select="true"
          :placeholder="$t('searchSatellites')"
          :close-on-select="false"
          :limit="0"
          :limit-text="limitText"
          :options-limit="100000"
          :show-labels="false"
          :searchable="true"
          :max-height="300"
        >
          <template #noResult> {{ $t("noResults") }} </template>
          <template #maxElements>
            <span class="max-elements-text">{{ $t("maxElementsReached") || "已达上限" }}</span>
          </template>
        </vue-multiselect>
      </div>
      <div class="section-actions">
        <button class="action-btn" @click="selectAllSatellites">
          <i class="btn-icon icon-check-all"></i>
          {{ $t("selectAllSatellites") || "全选卫星" }}
        </button>
        <button class="action-btn" @click="clearAllSatellites">
          <i class="btn-icon icon-clear"></i>
          {{ $t("clearAll") || "清除" }}
        </button>
      </div>
    </div>

    <div class="quick-stats">
      <div class="stat-row">
        <span class="stat-label">{{ $t("totalAvailable") || "可用卫星" }}</span>
        <span class="stat-value">{{ totalSatelliteCount }}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">{{ $t("selectedCount") || "已选数量" }}</span>
        <span class="stat-value highlight">{{ enabledSatellites.length + satellitesEnabledByTag.length }}</span>
      </div>
    </div>
  </div>
</template>

<script>
import VueMultiselect from "vue-multiselect";
import { mapWritableState } from "pinia";

import { useSatStore } from "../stores/sat";

export default {
  components: {
    VueMultiselect,
  },
  data() {
    return {};
  },
  computed: {
    ...mapWritableState(useSatStore, ["availableSatellitesByTag", "availableTags", "enabledSatellites", "enabledTags", "trackedSatellite"]),
    satelliteGroupsPlaceholder() {
      const count = this.enabledTags?.length ?? 0;
      return count === 1 ? this.$t("satelliteGroupsSelected", { count }) : this.$t("satelliteGroupsSelectedPlural", { count });
    },
    limitText() {
      return (count) => {
        return count === 1 ? this.$t("satellitesSelected", { count }) : this.$t("satellitesSelectedPlural", { count });
      };
    },
    availableSatellites() {
      let satlist = Object.keys(this.availableSatellitesByTag).map((tag) => ({
        tag,
        sats: this.availableSatellitesByTag[tag],
      }));
      if (satlist.length === 0) {
        satlist = [];
      }
      return satlist;
    },
    satellitesEnabledByTag() {
      return this.getSatellitesFromTags(this.enabledTags);
    },
    totalSatelliteCount() {
      return Object.values(this.availableSatellitesByTag).reduce((sum, sats) => sum + sats.length, 0);
    },
    allEnabledSatellites: {
      get() {
        return this.satellitesEnabledByTag.concat(this.enabledSatellites ?? []);
      },
      set(sats) {
        const enabledTags = this.availableTags.filter((tag) => !this.availableSatellitesByTag[tag].some((sat) => !sats.includes(sat)));
        const satellitesInEnabledTags = this.getSatellitesFromTags(enabledTags);
        const enabledSatellites = sats.filter((sat) => !satellitesInEnabledTags.includes(sat));
        cc.sats.enabledSatellites = enabledSatellites;
        cc.sats.enabledTags = enabledTags;
      },
    },
  },
  watch: {
    enabledSatellites(sats) {
      cc.sats.enabledSatellites = sats;
    },
    enabledTags(tags) {
      cc.sats.enabledTags = tags;
    },
    trackedSatellite(satellite) {
      cc.sats.trackedSatellite = satellite;
    },
  },
  methods: {
    getSatellitesFromTags(taglist) {
      return taglist.flatMap((tag) => this.availableSatellitesByTag[tag] || []);
    },
    selectAllGroups() {
      this.enabledTags = [...this.availableTags];
    },
    clearAllGroups() {
      this.enabledTags = [];
    },
    selectAllSatellites() {
      const allSats = this.availableSatellites.flatMap((group) => group.sats);
      this.allEnabledSatellites = allSats;
    },
    clearAllSatellites() {
      this.allEnabledSatellites = [];
    },
  },
};
</script>

<style scoped>
@import "vue-multiselect/dist/vue-multiselect.css";

.satellite-select {
  width: 340px;
  max-height: calc(100vh - 120px);
  padding: 14px;
  background: linear-gradient(135deg, rgba(48, 51, 54, 0.95), rgba(35, 38, 41, 0.95));
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  overflow-y: auto;
  overflow-x: hidden;
}

/* 面板头部 */
.panel-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 14px;
  margin-bottom: 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.panel-icon {
  width: 24px;
  height: 24px;
  filter: brightness(1.5) drop-shadow(0 0 6px rgba(79, 172, 254, 0.5));
}

.panel-title {
  flex: 1;
  font-size: 16px;
  font-weight: 600;
  color: #edffff;
  letter-spacing: 0.5px;
}

.header-stats {
  display: flex;
  gap: 8px;
}

.stat-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: linear-gradient(135deg, rgba(79, 172, 254, 0.2), rgba(79, 172, 254, 0.1));
  border: 1px solid rgba(79, 172, 254, 0.3);
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  color: #4facfe;
}

.stat-icon {
  font-size: 12px;
}

.icon-sat::before { content: "🛰"; }

/* 选择区块 */
.select-section {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.3s ease;
}

.select-section:last-of-type {
  margin-bottom: 12px;
}

.select-section:hover {
  border-color: rgba(79, 172, 254, 0.2);
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.section-icon {
  font-size: 14px;
  width: 16px;
  text-align: center;
}

.icon-group::before { content: "📁"; color: #a78bfa; }
.icon-satellite::before { content: "🛸"; color: #4facfe; }

.section-title {
  flex: 1;
  font-size: 11px;
  font-weight: 600;
  color: #7eb8e8;
  text-transform: uppercase;
  letter-spacing: 0.8px;
}

.section-count {
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background: linear-gradient(135deg, #4facfe, #00f2fe);
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 8px rgba(79, 172, 254, 0.4);
}

.section-content {
  margin-bottom: 10px;
}

/* 操作按钮 */
.section-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  background: linear-gradient(135deg, rgba(79, 172, 254, 0.1), rgba(79, 172, 254, 0.05));
  border: 1px solid rgba(79, 172, 254, 0.2);
  border-radius: 8px;
  color: #c0c0c0;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.25s ease;
}

.action-btn:hover {
  background: linear-gradient(135deg, rgba(79, 172, 254, 0.25), rgba(79, 172, 254, 0.1));
  border-color: rgba(79, 172, 254, 0.5);
  color: #edffff;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(79, 172, 254, 0.2);
}

.action-btn:active {
  transform: translateY(0);
}

.btn-icon {
  font-size: 12px;
}

.icon-check-all::before { content: "☑"; }
.icon-clear::before { content: "☐"; }

/* 统计信息 */
.quick-stats {
  background: rgba(0, 0, 0, 0.25);
  border-radius: 10px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
}

.stat-row:not(:last-child) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.stat-label {
  font-size: 12px;
  color: #888;
}

.stat-value {
  font-size: 14px;
  font-weight: 600;
  color: #c0c0c0;
}

.stat-value.highlight {
  color: #4facfe;
  text-shadow: 0 0 8px rgba(79, 172, 254, 0.4);
}

/* Vue Multiselect 自定义样式 */
:deep(.multiselect) {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  min-height: 40px;
  transition: all 0.25s ease;
}

:deep(.multiselect:hover) {
  border-color: rgba(79, 172, 254, 0.4);
}

:deep(.multiselect:focus-within) {
  border-color: rgba(79, 172, 254, 0.6);
  box-shadow: 0 0 0 3px rgba(79, 172, 254, 0.15);
}

:deep(.multiselect__select) {
  padding: 10px;
  background: rgba(255, 255, 255, 0.05);
  transition: background 0.2s ease;
}

:deep(.multiselect__select:before) {
  border-color: #7eb8e8 transparent transparent;
  transition: transform 0.2s ease;
}

:deep(.multiselect:hover .multiselect__select) {
  background: rgba(79, 172, 254, 0.1);
}

:deep(.multiselect--active .multiselect__select:before) {
  transform: rotate(-180deg);
}

:deep(.multiselect__tags) {
  background: transparent;
  border: none;
  min-height: 40px;
  padding: 8px 40px 8px 12px;
}

:deep(.multiselect__tags-wrap) {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

:deep(.multiselect__tag) {
  background: linear-gradient(135deg, rgba(79, 172, 254, 0.3), rgba(79, 172, 254, 0.15));
  border: 1px solid rgba(79, 172, 254, 0.4);
  border-radius: 6px;
  color: #edffff;
  font-size: 11px;
  padding: 4px 24px 4px 8px;
  margin: 0;
  animation: tagAppear 0.25s ease;
}

:deep(.multiselect__tag-icon) {
  background: transparent;
  border-radius: 0 6px 6px 0;
  transition: all 0.2s ease;
}

:deep(.multiselect__tag-icon:after) {
  color: #4facfe;
  font-size: 14px;
}

:deep(.multiselect__tag-icon:hover) {
  background: rgba(79, 172, 254, 0.3);
}

:deep(.multiselect__tag-icon:hover:after) {
  color: #fff;
}

:deep(.multiselect__input) {
  background: transparent;
  color: #edffff;
  font-size: 12px;
}

:deep(.multiselect__input::placeholder) {
  color: rgba(255, 255, 255, 0.4);
}

:deep(.multiselect__placeholder) {
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
  padding-left: 4px;
}

:deep(.multiselect__single) {
  display: none;
}

/* 搜索框样式 */
:deep(.multiselect__input) {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 6px;
  padding: 4px 8px;
  margin: 4px;
}

/* 分组选项样式 */
:deep(.multiselect__option) {
  background: rgba(48, 51, 54, 0.9);
  color: #c0c0c0;
  font-size: 12px;
  padding: 10px 12px;
  min-height: 36px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
}

:deep(.multiselect__option:hover) {
  background: rgba(79, 172, 254, 0.15);
  color: #edffff;
}

:deep(.multiselect__option--highlight) {
  background: rgba(79, 172, 254, 0.2);
  color: #edffff;
}

:deep(.multiselect__option--selected) {
  background: rgba(79, 172, 254, 0.25);
  color: #4facfe;
  font-weight: 500;
}

:deep(.multiselect__option--selected:hover) {
  background: rgba(79, 172, 254, 0.35);
}

/* 分组标签样式 */
:deep(.multiselect__option--group) {
  background: rgba(0, 0, 0, 0.4);
  color: #a78bfa;
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

:deep(.multiselect__option--group:before) {
  content: "▸";
  color: rgba(167, 139, 250, 0.6);
  font-size: 10px;
}

:deep(.multiselect__option--group:hover) {
  background: rgba(79, 172, 254, 0.1);
}

/* 选中状态 */
:deep(.multiselect__option--selected.multiselect__option--highlight) {
  background: rgba(79, 172, 254, 0.25);
}

/* 下拉面板 */
:deep(.multiselect__content-wrapper) {
  background: rgba(35, 38, 41, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  margin-top: 4px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  max-height: 300px;
  overflow-y: auto;
}

:deep(.multiselect__content-wrapper)::-webkit-scrollbar {
  width: 6px;
}

:deep(.multiselect__content-wrapper)::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

:deep(.multiselect__content-wrapper)::-webkit-scrollbar-thumb {
  background: rgba(79, 172, 254, 0.4);
  border-radius: 3px;
}

:deep(.multiselect__content) {
  margin: 4px 0;
}

:deep(.multiselect__spinner) {
  background: rgba(48, 51, 54, 0.9);
  border-radius: 50%;
}

:deep(.multiselect__spinner:after) {
  border-color: #4facfe transparent transparent;
}

/* 无结果提示 */
:deep(.multiselect__no-result) {
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  padding: 16px;
  text-align: center;
}

:deep(.max-elements-text) {
  color: #f59e0b;
  font-size: 11px;
  padding: 8px 12px;
  display: block;
}

/* 选中计数 */
:deep(.multiselect__strong) {
  color: #4facfe;
  font-weight: 600;
  font-size: 11px;
  background: rgba(79, 172, 254, 0.2);
  padding: 2px 8px;
  border-radius: 8px;
}

/* 动画效果 */
@keyframes tagAppear {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* 主滚动条样式 */
.satellite-select::-webkit-scrollbar {
  width: 6px;
}

.satellite-select::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.satellite-select::-webkit-scrollbar-thumb {
  background: rgba(79, 172, 254, 0.4);
  border-radius: 3px;
}

.satellite-select::-webkit-scrollbar-thumb:hover {
  background: rgba(79, 172, 254, 0.7);
}

/* Firefox */
.satellite-select {
  scrollbar-width: thin;
  scrollbar-color: rgba(79, 172, 254, 0.4) rgba(0, 0, 0, 0.2);
}

/* 响应式优化 */
@media (max-width: 768px) {
  .satellite-select {
    width: 290px;
    padding: 12px;
  }

  .section-actions {
    flex-direction: column;
  }

  .action-btn {
    width: 100%;
  }
}
</style>
