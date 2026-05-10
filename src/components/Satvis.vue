<template>
  <div class="cesium">
    <div v-show="showUI" id="toolbarLeft">
      <div class="system-title">
        <img class="system-logo" src="/logo.svg" alt="Logo" />
        <span>太空导航</span>
      </div>
      <div class="toolbarButtons">
        <button v-tooltip="$t('satelliteSelection')" type="button" class="cesium-button cesium-toolbar-button" @click="toggleMenu('cat')">
          <i class="icon svg-sat"></i>
        </button>
        <button v-tooltip="$t('customSatellite')" type="button" class="cesium-button cesium-toolbar-button" @click="toggleMenu('custom')">
          <i class="icon svg-customsat"></i>
        </button>
        <button v-tooltip="$t('satelliteElements')" type="button" class="cesium-button cesium-toolbar-button" @click="toggleMenu('sat')">
          <i class="icon svg-layers"></i>
        </button>
        <button v-tooltip="$t('groundStation')" type="button" class="cesium-button cesium-toolbar-button" @click="toggleMenu('gs')">
          <i class="icon svg-groundstation"></i>
        </button>
        <button v-tooltip="$t('map')" type="button" class="cesium-button cesium-toolbar-button" @click="toggleMenu('map')">
          <i class="icon svg-globe"></i>
        </button>
        <button v-if="cc.minimalUI" v-tooltip="$t('mobile')" type="button" class="cesium-button cesium-toolbar-button" @click="toggleMenu('ios')">
          <i class="icon svg-mobile"></i>
        </button>
        <button v-tooltip="$t('debug')" type="button" class="cesium-button cesium-toolbar-button" @click="toggleMenu('dbg')">
          <i class="icon svg-tool"></i>
        </button>
      </div>
      <div v-show="menu.cat" class="toolbarSwitches">
        <satellite-select />
      </div>
      <div v-show="menu.custom" class="toolbarSwitches">
        <custom-satellite />
      </div>
      <div v-show="menu.sat" class="toolbarSwitches satellite-elements-panel">
        <div class="panel-header">
          <i class="panel-icon svg-layers"></i>
          <span class="panel-title">{{ $t("satelliteElementsTitle") }}</span>
        </div>

        <!-- 基础显示组件 -->
        <div class="elem-section">
          <div class="elem-section-title">
            <i class="section-icon icon-basic"></i>
            {{ $t("basicDisplay") }}
          </div>
          <div class="elem-grid">
            <label
              v-for="componentName in basicComponents"
              :key="componentName"
              class="elem-item"
              :class="{ active: enabledComponents.includes(componentName) }"
            >
              <input v-model="enabledComponents" type="checkbox" :value="componentName" />
              <div class="elem-icon" :class="'icon-' + getComponentIcon(componentName)"></div>
              <span class="elem-name">
                {{ $t(componentName.toLowerCase().replace(/ /g, ""), { defaultValue: componentName }) }}
              </span>
              <div class="elem-indicator"></div>
            </label>
          </div>
        </div>

        <!-- 轨道组件 -->
        <div class="elem-section">
          <div class="elem-section-title">
            <i class="section-icon icon-orbit"></i>
            {{ $t("orbitElements") }}
          </div>
          <div class="elem-grid">
            <label
              v-for="componentName in orbitComponents"
              :key="componentName"
              class="elem-item"
              :class="{ active: enabledComponents.includes(componentName) }"
            >
              <input v-model="enabledComponents" type="checkbox" :value="componentName" />
              <div class="elem-icon" :class="'icon-' + getComponentIcon(componentName)"></div>
              <span class="elem-name">
                {{ $t(componentName.toLowerCase().replace(/ /g, ""), { defaultValue: componentName }) }}
              </span>
              <div class="elem-indicator"></div>
            </label>
          </div>
        </div>

        <!-- 高级组件 -->
        <div class="elem-section">
          <div class="elem-section-title">
            <i class="section-icon icon-advanced"></i>
            {{ $t("advancedComponents") }}
          </div>
          <div class="elem-grid">
            <label
              v-for="componentName in advancedComponents"
              :key="componentName"
              class="elem-item"
              :class="{ active: enabledComponents.includes(componentName) }"
            >
              <input v-model="enabledComponents" type="checkbox" :value="componentName" />
              <div class="elem-icon" :class="'icon-' + getComponentIcon(componentName)"></div>
              <span class="elem-name">
                {{ $t(componentName.toLowerCase().replace(/ /g, ""), { defaultValue: componentName }) }}
              </span>
              <div class="elem-indicator"></div>
            </label>
          </div>
        </div>

        <!-- 链路组件 -->
        <div class="elem-section">
          <div class="elem-section-title">
            <i class="section-icon icon-link"></i>
            {{ $t("linkComponents") }}
          </div>
          <div class="elem-grid">
            <label
              v-for="componentName in linkComponents"
              :key="componentName"
              class="elem-item"
              :class="{ active: enabledComponents.includes(componentName) }"
            >
              <input v-model="enabledComponents" type="checkbox" :value="componentName" />
              <div class="elem-icon" :class="'icon-' + getComponentIcon(componentName)"></div>
              <span class="elem-name">
                {{ $t(componentName.toLowerCase().replace(/ /g, ""), { defaultValue: componentName }) }}
              </span>
              <div class="elem-indicator"></div>
            </label>
          </div>
        </div>
      </div>
      <div v-show="menu.gs" class="toolbarSwitches ground-station-panel">
        <div class="panel-header">
          <i class="panel-icon svg-groundstation"></i>
          <span class="panel-title">{{ $t("groundStationTitle") }}</span>
        </div>

        <!-- 基础操作卡片 -->
        <div class="gs-card">
          <div class="gs-card-title">
            <i class="card-icon icon-target"></i>
            {{ $t("basicOperations") }}
          </div>
          <div class="gs-card-content">
            <button class="gs-action-btn" @click="cc.setGroundStationFromGeolocation()">
              <i class="btn-icon icon-location"></i>
              <span>{{ $t("setFromGeolocation") }}</span>
            </button>
            <button class="gs-action-btn" @click="cc.sats.focusGroundStation()">
              <i class="btn-icon icon-focus"></i>
              <span>{{ $t("focus") }}</span>
            </button>
          </div>
          <div class="gs-toggle-row">
            <span class="toggle-label">{{ $t("pickOnGlobe") }}</span>
            <label class="gs-switch">
              <input v-model="pickMode" type="checkbox" />
              <span class="gs-slider"></span>
            </label>
          </div>
        </div>

        <!-- 过境计算卡片 -->
        <div class="gs-card">
          <div class="gs-card-title">
            <i class="card-icon icon-orbit"></i>
            {{ $t("overpassCalculation") }}
          </div>
          <div class="gs-radio-group">
            <label class="gs-radio-label">
              <input v-model="overpassMode" type="radio" value="elevation" />
              <span class="gs-radio-custom"></span>
              <i class="radio-icon icon-elevation"></i>
              {{ $t("elevation") }}
            </label>
            <label class="gs-radio-label">
              <input v-model="overpassMode" type="radio" value="swath" />
              <span class="gs-radio-custom"></span>
              <i class="radio-icon icon-swath"></i>
              {{ $t("swath") }}
            </label>
          </div>
        </div>

        <!-- 数传链路卡片 -->
        <div class="gs-card" :class="{ 'card-active': dataLinkEnabled }">
          <div class="gs-card-title">
            <i class="card-icon icon-link"></i>
            {{ $t("dataLinkSimulation") }}
            <span v-if="dataLinkEnabled" class="status-badge active">{{ $t("enabled") }}</span>
          </div>
          <div class="gs-card-content">
            <div class="gs-toggle-row">
              <span class="toggle-label">{{ $t("enableDataLink") }}</span>
              <label class="gs-switch">
                <input v-model="dataLinkEnabled" type="checkbox" />
                <span class="gs-slider"></span>
              </label>
            </div>
          </div>

          <div v-if="dataLinkEnabled" class="gs-expanded-content">
            <div class="gs-distance-control">
              <label class="distance-label">
                <i class="control-icon icon-distance"></i>
                {{ $t("dataLinkDistance") }}
              </label>
              <div class="distance-slider-container">
                <input
                  v-model.number="dataLinkDistanceThreshold"
                  type="range"
                  min="500"
                  max="10000"
                  step="100"
                  class="distance-slider"
                  @input="onDistanceSliderInput"
                  @change="onDistanceSliderChange"
                />
                <span class="distance-value">{{ dataLinkDistanceThreshold }} km</span>
              </div>
            </div>

            <div v-if="cc.sats.selectedSatellite" class="gs-link-status">
              <div class="status-header">
                <i class="status-icon icon-satellite"></i>
                <span>{{ $t("linkStatus") }}</span>
              </div>
              <div class="status-detail">
                <span class="detail-label">{{ $t("currentDistance") }}</span>
                <span class="detail-value" :class="{ 'in-range': currentDataLinkDistance !== '--' && parseFloat(currentDataLinkDistance) <= dataLinkDistanceThreshold }">
                  {{ currentDataLinkDistance }} km
                </span>
              </div>
              <div v-if="currentConnectedStation" class="status-detail">
                <span class="detail-label">{{ $t("connectedStation") }}</span>
                <span class="detail-value connected">{{ currentConnectedStation }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-show="menu.map" class="toolbarSwitches map-panel">
        <div class="panel-header">
          <i class="panel-icon svg-globe"></i>
          <span class="panel-title">{{ $t("map") }}</span>
        </div>

        <div class="settings-section">
          <div class="section-header">
            <i class="section-icon icon-layers"></i>
            {{ $t("layersTitle") }}
          </div>
          <div class="option-list">
            <label v-for="name in cc.imageryProviderNames" :key="name" class="option-item">
              <input v-model="layers" type="checkbox" :value="name" />
              <span class="option-toggle"></span>
              <span class="option-text">{{ name }}</span>
              <span class="option-indicator"></span>
            </label>
          </div>
        </div>

        <div class="settings-section">
          <div class="section-header">
            <i class="section-icon icon-terrain"></i>
            {{ $t("terrainTitle") }}
          </div>
          <div class="option-list">
            <label v-for="name in cc.terrainProviderNames" :key="name" class="option-item radio">
              <input v-model="terrainProvider" type="radio" :value="name" />
              <span class="option-radio"></span>
              <span class="option-text">{{ name }}</span>
            </label>
          </div>
        </div>

        <div class="settings-section">
          <div class="section-header">
            <i class="section-icon icon-view"></i>
            {{ $t("viewTitle") }}
          </div>
          <div class="option-list">
            <label v-for="name in cc.sceneModes" :key="name" class="option-item radio">
              <input v-model="sceneMode" type="radio" :value="name" />
              <span class="option-radio"></span>
              <span class="option-text">{{ name }}</span>
            </label>
          </div>
        </div>

        <div class="settings-section">
          <div class="section-header">
            <i class="section-icon icon-camera"></i>
            {{ $t("cameraTitle") }}
          </div>
          <div class="option-list">
            <label v-for="name in cc.cameraModes" :key="name" class="option-item radio">
              <input v-model="cameraMode" type="radio" :value="name" />
              <span class="option-radio"></span>
              <span class="option-text">{{ name }}</span>
            </label>
          </div>
        </div>
      </div>
      <div v-show="menu.ios" class="toolbarSwitches">
        <div class="toolbarTitle">{{ $t("mobileTitle") }}</div>
        <label class="toolbarSwitch">
          <input v-model="cc.viewer.scene.useWebVR" type="checkbox" />
          <span class="slider"></span>
          {{ $t("vr") }}
        </label>
        <label class="toolbarSwitch">
          <input v-model="cc.viewer.clock.shouldAnimate" type="checkbox" />
          <span class="slider"></span>
          {{ $t("play") }}
        </label>
        <label class="toolbarSwitch">
          <input type="button" @click="cc.viewer.clockViewModel.multiplier *= 2" />
          {{ $t("increasePlaySpeed") }}
        </label>
        <label class="toolbarSwitch">
          <input type="button" @click="cc.viewer.clockViewModel.multiplier /= 2" />
          {{ $t("decreasePlaySpeed") }}
        </label>
        <label class="toolbarSwitch">
          <input type="button" @click="$router.go({ path: '', force: true })" />
          {{ $t("reload") }}
        </label>
      </div>
      <div v-show="menu.dbg" class="toolbarSwitches debug-panel">
        <div class="panel-header">
          <i class="panel-icon svg-tool"></i>
          <span class="panel-title">{{ $t("debugTitle") }}</span>
        </div>

        <div class="settings-section">
          <div class="section-header">
            <i class="section-icon icon-performance"></i>
            {{ $t("performanceSettings") || "性能设置" }}
          </div>
          <div class="option-list">
            <label class="option-item">
              <input v-model="showFps" type="checkbox" />
              <span class="option-toggle"></span>
              <span class="option-text">{{ $t("fps") }}</span>
              <span class="option-badge fps">{{ showFps ? "ON" : "OFF" }}</span>
            </label>
            <label class="option-item">
              <input v-model="cc.viewer.scene.requestRenderMode" type="checkbox" />
              <span class="option-toggle"></span>
              <span class="option-text">{{ $t("requestRender") }}</span>
              <span class="option-badge">{{ cc.viewer.scene.requestRenderMode ? "ON" : "OFF" }}</span>
            </label>
            <label class="option-item">
              <input v-model="qualityPreset" true-value="high" false-value="low" type="checkbox" />
              <span class="option-toggle"></span>
              <span class="option-text">{{ $t("highQuality") }}</span>
              <span class="option-badge quality">{{ qualityPreset === "high" ? "HIGH" : "LOW" }}</span>
            </label>
          </div>
        </div>

        <div class="settings-section">
          <div class="section-header">
            <i class="section-icon icon-visual"></i>
            {{ $t("visualSettings") || "视觉效果" }}
          </div>
          <div class="option-list">
            <label class="option-item">
              <input v-model="cc.viewer.scene.fog.enabled" type="checkbox" />
              <span class="option-toggle"></span>
              <span class="option-text">{{ $t("fog") }}</span>
              <span class="option-indicator"></span>
            </label>
            <label class="option-item">
              <input v-model="cc.viewer.scene.globe.enableLighting" type="checkbox" />
              <span class="option-toggle"></span>
              <span class="option-text">{{ $t("lighting") }}</span>
              <span class="option-indicator"></span>
            </label>
            <label class="option-item">
              <input v-model="cc.viewer.scene.highDynamicRange" type="checkbox" />
              <span class="option-toggle"></span>
              <span class="option-text">{{ $t("hdr") }}</span>
              <span class="option-indicator"></span>
            </label>
            <label class="option-item">
              <input v-model="cc.viewer.scene.globe.showGroundAtmosphere" type="checkbox" />
              <span class="option-toggle"></span>
              <span class="option-text">{{ $t("atmosphere") }}</span>
              <span class="option-indicator"></span>
            </label>
          </div>
        </div>

        <div class="settings-section">
          <div class="section-header">
            <i class="section-icon icon-location"></i>
            {{ $t("quickNavigate") || "快速导航" }}
          </div>
          <div class="action-grid">
            <button class="action-btn" @click="cc.jumpTo('Everest')">
              <i class="btn-icon icon-everest"></i>
              <span class="btn-text">{{ $t("jumpToEverest") }}</span>
              <span class="btn-subtext">8848m</span>
            </button>
            <button class="action-btn" @click="cc.jumpTo('HalfDome')">
              <i class="btn-icon icon-dome"></i>
              <span class="btn-text">{{ $t("jumpToHalfDome") }}</span>
              <span class="btn-subtext">2693m</span>
            </button>
          </div>
        </div>
      </div>
    </div>
    <div id="toolbarRight">
      <language-switcher />
      <button v-tooltip="$t('toggleUI')" type="button" class="cesium-button cesium-toolbar-button" @click="toggleUI">
        <i class="icon svg-eye"></i>
      </button>
    </div>
    <!-- Orbit Legend -->
    <div v-if="showOrbitLegend" id="orbitLegend" class="orbit-legend">
      <div class="legend-title">{{ $t("orbitLegend") }}</div>
      <div class="legend-item">
        <span class="legend-line past"></span>
        <span class="legend-text">{{ $t("pastOrbit") }}</span>
      </div>
      <div class="legend-item">
        <span class="legend-line future"></span>
        <span class="legend-text">{{ $t("futureOrbit") }}</span>
      </div>
    </div>
  </div>
</template>

<script>
import { mapWritableState } from "pinia";
import { useCesiumStore } from "../stores/cesium";
import { useSatStore } from "../stores/sat";

import { DeviceDetect } from "../modules/util/DeviceDetect";
import SatelliteSelect from "./SatelliteSelect.vue";
import LanguageSwitcher from "./LanguageSwitcher.vue";
import CustomSatellite from "./CustomSatellite.vue";

export default {
  components: {
    "satellite-select": SatelliteSelect,
    LanguageSwitcher,
    CustomSatellite,
  },
  data() {
    return {
      menu: {
        cat: false,
        sat: false,
        gs: false,
        map: false,
        ios: false,
        dbg: false,
        custom: false,
      },
      showUI: true,
    };
  },
  computed: {
    ...mapWritableState(useCesiumStore, ["layers", "terrainProvider", "sceneMode", "cameraMode", "qualityPreset", "showFps", "background", "pickMode"]),
    ...mapWritableState(useSatStore, ["enabledComponents", "groundStations", "overpassMode", "dataLinkEnabled", "dataLinkDistanceThreshold"]),
    showOrbitLegend() {
      return this.enabledComponents.includes("Orbit");
    },
    currentDataLinkDistance() {
      if (!cc.sats.selectedSatellite) return "--";
      const distance = cc.sats.getSatelliteDataLinkDistance(cc.sats.selectedSatellite);
      if (distance === null) return "--";
      return distance.toFixed(0);
    },
    currentConnectedStation() {
      if (!cc.sats.selectedSatellite) return null;
      return cc.sats.getCurrentConnectedStation(cc.sats.selectedSatellite);
    },
    // 基础显示组件
    basicComponents() {
      return ["Point", "Label"];
    },
    // 轨道组件
    orbitComponents() {
      return ["Orbit", "Orbit track", "Ground track"];
    },
    // 高级组件
    advancedComponents() {
      return ["Sensor cone", "3D model"];
    },
    // 链路组件
    linkComponents() {
      return ["Ground station link", "Data link"];
    },
  },
  watch: {
    layers: {
      handler(newLayers, oldLayers) {
        // Ensure only a single base layer is active
        const newBaseLayers = newLayers.filter((layer) => cc.baseLayers.includes(layer));
        if (newBaseLayers.length > 1) {
          const oldBaseLayers = new Set(oldLayers.filter((layer) => cc.baseLayers.includes(layer)));
          this.layers = newBaseLayers.filter((layer) => !oldBaseLayers.has(layer));
          return;
        }
        cc.imageryLayers = newLayers;
      },
      deep: true,
    },
    terrainProvider(newProvider) {
      cc.terrainProvider = newProvider;
    },
    sceneMode(newMode) {
      cc.sceneMode = newMode;
    },
    cameraMode(newMode) {
      cc.cameraMode = newMode;
    },
    qualityPreset: {
      handler(value) {
        cc.qualityPreset = value;
      },
      immediate: true,
    },
    showFps(value) {
      cc.showFps = value;
    },
    background(value) {
      cc.background = value;
    },
    enabledComponents: {
      handler(newComponents) {
        cc.sats.enabledComponents = newComponents;
      },
      deep: true,
    },
    groundStations(newGroundStations, oldGroundStations) {
      // Ignore if new and old positions are identical
      if (oldGroundStations.length === newGroundStations.length) {
        return;
      }
      cc.setGroundStations(newGroundStations);
    },
    overpassMode(newMode) {
      cc.sats.overpassMode = newMode;
    },
    dataLinkEnabled(enabled) {
      cc.sats.dataLinkEnabled = enabled;
    },
    dataLinkDistanceThreshold(distance) {
      // Skip update while dragging - will be applied on drag end
      if (this._isDraggingDistanceSlider) return;
      cc.sats.dataLinkDistanceThreshold = distance;
    },
  },
  mounted() {
    if (this.$route.query.time) {
      cc.setTime(this.$route.query.time);
    }
    this.showUI = !DeviceDetect.inIframe();
  },
  methods: {
    toggleMenu(name) {
      const oldState = this.menu[name];
      Object.keys(this.menu).forEach((k) => {
        this.menu[k] = false;
      });
      this.menu[name] = !oldState;
    },
    toggleUI() {
      this.showUI = !this.showUI;
      if (!cc.minimalUI) {
        cc.showUI = this.showUI;
      }
    },
    getComponentIcon(componentName) {
      const iconMap = {
        "Point": "point",
        "Label": "label",
        "Orbit": "orbit",
        "Orbit track": "orbit-track",
        "Ground track": "ground-track",
        "Sensor cone": "sensor",
        "3D model": "model",
        "Ground station link": "ground-link",
        "Data link": "data-link",
      };
      return iconMap[componentName] || "default";
    },
    onDistanceSliderInput() {
      // Mark as dragging to prevent threshold updates during drag
      this._isDraggingDistanceSlider = true;
    },
    onDistanceSliderChange() {
      // Apply the threshold update after dragging ends
      this._isDraggingDistanceSlider = false;
      cc.sats.dataLinkDistanceThreshold = this.dataLinkDistanceThreshold;
    },
  },
};
</script>

<style scoped>
.orbit-legend {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background-color: rgba(48, 51, 54, 0.9);
  border-radius: 6px;
  padding: 10px 14px;
  z-index: 1000;
  font-size: 12px;
}

.legend-title {
  color: #edffff;
  font-weight: bold;
  margin-bottom: 8px;
  text-align: center;
}

.legend-item {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
}

.legend-item:last-child {
  margin-bottom: 0;
}

.legend-line {
  width: 24px;
  height: 3px;
  margin-right: 8px;
  border-radius: 2px;
}

.legend-line.past {
  background-color: rgba(255, 77, 77, 0.8);
}

.legend-line.future {
  background-color: rgba(77, 153, 255, 0.8);
}

.legend-text {
  color: #a0a0a0;
}

.data-link-distance {
  margin-top: 8px;
}

.data-link-distance .toolbarSwitch {
  flex-direction: column;
  align-items: flex-start;
  height: auto;
  padding: 8px;
}

.data-link-distance input[type="number"] {
  width: 80px;
  margin-top: 4px;
  padding: 4px 8px;
  background-color: #303336;
  border: 1px solid #5a5a5a;
  border-radius: 4px;
  color: #edffff;
  font-size: 12px;
}

.data-link-status {
  margin-top: 8px;
  padding: 8px;
  background-color: rgba(48, 51, 54, 0.8);
  border-radius: 6px;
}

.data-link-info {
  color: #4caf50;
  font-size: 12px;
  font-weight: bold;
}

/* 地面站模块美化样式 */
.ground-station-panel {
  width: 280px;
  max-height: calc(100vh - 120px);
  padding: 12px;
  background: linear-gradient(135deg, rgba(48, 51, 54, 0.95), rgba(35, 38, 41, 0.95));
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow-y: auto;
  overflow-x: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 12px;
  margin-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.panel-icon {
  width: 24px;
  height: 24px;
  filter: brightness(1.5) drop-shadow(0 0 6px rgba(79, 172, 254, 0.5));
}

.panel-title {
  font-size: 16px;
  font-weight: 600;
  color: #edffff;
  letter-spacing: 0.5px;
}

/* 卡片通用样式 */
.gs-card {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 10px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.3s ease;
}

.gs-card:last-child {
  margin-bottom: 0;
}

.gs-card:hover {
  border-color: rgba(79, 172, 254, 0.3);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.gs-card.card-active {
  border-color: rgba(79, 172, 254, 0.5);
  background: linear-gradient(135deg, rgba(79, 172, 254, 0.1), rgba(0, 0, 0, 0.3));
}

.gs-card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #a0d2ff;
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.card-icon {
  width: 18px;
  height: 18px;
  opacity: 0.9;
}

.gs-card-content {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* 操作按钮样式 */
.gs-action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: linear-gradient(135deg, rgba(79, 172, 254, 0.2), rgba(79, 172, 254, 0.1));
  border: 1px solid rgba(79, 172, 254, 0.3);
  border-radius: 8px;
  color: #edffff;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  flex: 1;
  min-width: 110px;
  justify-content: center;
}

.gs-action-btn:hover {
  background: linear-gradient(135deg, rgba(79, 172, 254, 0.35), rgba(79, 172, 254, 0.2));
  border-color: rgba(79, 172, 254, 0.6);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(79, 172, 254, 0.2);
}

.gs-action-btn:active {
  transform: translateY(0);
}

.btn-icon {
  width: 14px;
  height: 14px;
}

/* 开关样式 */
.gs-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  margin-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.toggle-label {
  font-size: 12px;
  color: #c0c0c0;
}

.gs-switch {
  position: relative;
  width: 40px;
  height: 20px;
  cursor: pointer;
}

.gs-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.gs-slider {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(100, 100, 100, 0.5);
  border-radius: 20px;
  transition: all 0.3s ease;
}

.gs-slider::before {
  content: "";
  position: absolute;
  height: 14px;
  width: 14px;
  left: 3px;
  bottom: 3px;
  background-color: #888;
  border-radius: 50%;
  transition: all 0.3s ease;
}

.gs-switch input:checked + .gs-slider {
  background: linear-gradient(135deg, #4caf50, #45a049);
  box-shadow: 0 0 10px rgba(76, 175, 80, 0.4);
}

.gs-switch input:checked + .gs-slider::before {
  transform: translateX(20px);
  background-color: #fff;
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.5);
}

/* 单选按钮组 */
.gs-radio-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.gs-radio-label {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 12px;
  color: #c0c0c0;
}

.gs-radio-label:hover {
  background: rgba(79, 172, 254, 0.1);
  color: #edffff;
}

.gs-radio-label input {
  display: none;
}

.gs-radio-custom {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  position: relative;
  transition: all 0.2s ease;
}

.gs-radio-label input:checked + .gs-radio-custom {
  border-color: #4facfe;
  background: rgba(79, 172, 254, 0.2);
}

.gs-radio-label input:checked + .gs-radio-custom::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 8px;
  height: 8px;
  background: #4facfe;
  border-radius: 50%;
  box-shadow: 0 0 6px rgba(79, 172, 254, 0.8);
}

.gs-radio-label input:checked ~ .radio-icon,
.gs-radio-label:has(input:checked) .radio-icon {
  filter: drop-shadow(0 0 4px rgba(79, 172, 254, 0.6));
}

.gs-radio-label input:checked ~ span:not(.gs-radio-custom) {
  color: #4facfe;
  font-weight: 500;
}

.radio-icon {
  width: 16px;
  height: 16px;
  opacity: 0.7;
  transition: all 0.2s ease;
}

/* 状态徽章 */
.status-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  margin-left: auto;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-badge.active {
  background: linear-gradient(135deg, #4caf50, #45a049);
  color: #fff;
  box-shadow: 0 0 8px rgba(76, 175, 80, 0.4);
}

/* 扩展内容区域 */
.gs-expanded-content {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  animation: slideDown 0.3s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 距离滑块控制 */
.gs-distance-control {
  margin-bottom: 12px;
}

.distance-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #a0a0a0;
  margin-bottom: 8px;
}

.control-icon {
  width: 14px;
  height: 14px;
  opacity: 0.7;
}

.distance-slider-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.distance-slider {
  flex: 1;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(100, 100, 100, 0.5);
  border-radius: 3px;
  outline: none;
}

.distance-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  background: linear-gradient(135deg, #4facfe, #00f2fe);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 0 8px rgba(79, 172, 254, 0.5);
  transition: all 0.2s ease;
}

.distance-slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
  box-shadow: 0 0 12px rgba(79, 172, 254, 0.7);
}

.distance-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: linear-gradient(135deg, #4facfe, #00f2fe);
  border-radius: 50%;
  cursor: pointer;
  border: none;
  box-shadow: 0 0 8px rgba(79, 172, 254, 0.5);
}

.distance-value {
  font-size: 13px;
  font-weight: 600;
  color: #4facfe;
  min-width: 60px;
  text-align: right;
}

/* 链路状态 */
.gs-link-status {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  padding: 12px;
  border: 1px solid rgba(79, 172, 254, 0.2);
}

.status-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  color: #4facfe;
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-icon {
  width: 14px;
  height: 14px;
}

.status-detail {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
}

.status-detail:not(:last-child) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.detail-label {
  font-size: 11px;
  color: #888;
}

.detail-value {
  font-size: 12px;
  font-weight: 500;
  color: #c0c0c0;
}

.detail-value.in-range {
  color: #4caf50;
  text-shadow: 0 0 6px rgba(76, 175, 80, 0.4);
}

.detail-value.connected {
  color: #4facfe;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 虚拟图标样式 (使用CSS伪元素) */
.icon-target::before { content: "◎"; }
.icon-location::before { content: "📍"; }
.icon-focus::before { content: "🎯"; }
.icon-orbit::before { content: "🛰️"; }
.icon-link::before { content: "📡"; }
.icon-satellite::before { content: "🛸"; }
.icon-elevation::before { content: "📐"; }
.icon-swath::before { content: "🗺️"; }
.icon-distance::before { content: "📏"; }

/* ===================== 卫星元素模块样式 ===================== */
.satellite-elements-panel {
  width: 300px;
  max-height: calc(100vh - 120px);
  padding: 12px;
  background: linear-gradient(135deg, rgba(48, 51, 54, 0.95), rgba(35, 38, 41, 0.95));
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow-y: auto;
  overflow-x: hidden;
}

/* 元素区块 */
.elem-section {
  background: rgba(0, 0, 0, 0.25);
  border-radius: 10px;
  padding: 10px;
  margin-bottom: 10px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.3s ease;
}

.elem-section:last-child {
  margin-bottom: 0;
}

.elem-section:hover {
  border-color: rgba(79, 172, 254, 0.2);
}

.elem-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 600;
  color: #7eb8e8;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  text-transform: uppercase;
  letter-spacing: 0.8px;
}

.section-icon {
  width: 14px;
  height: 14px;
  opacity: 0.8;
}

.icon-basic::before { content: "◉"; color: #4facfe; }
.icon-orbit::before { content: "◎"; color: #a78bfa; }
.icon-advanced::before { content: "★"; color: #f59e0b; }
.icon-link::before { content: "📡"; }

/* 元素网格 */
.elem-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

/* 单个元素项 */
.elem-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.25s ease;
  position: relative;
  overflow: hidden;
}

.elem-item::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, transparent, rgba(79, 172, 254, 0.1));
  opacity: 0;
  transition: opacity 0.25s ease;
}

.elem-item:hover {
  background: rgba(79, 172, 254, 0.08);
  border-color: rgba(79, 172, 254, 0.3);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.elem-item:hover::before {
  opacity: 1;
}

.elem-item.active {
  background: linear-gradient(135deg, rgba(79, 172, 254, 0.15), rgba(79, 172, 254, 0.05));
  border-color: rgba(79, 172, 254, 0.5);
  box-shadow: 0 0 15px rgba(79, 172, 254, 0.2), inset 0 0 20px rgba(79, 172, 254, 0.1);
}

.elem-item input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

/* 元素图标 */
.elem-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.3);
  transition: all 0.25s ease;
}

.elem-item:hover .elem-icon {
  transform: scale(1.1);
}

.elem-item.active .elem-icon {
  background: linear-gradient(135deg, rgba(79, 172, 254, 0.3), rgba(79, 172, 254, 0.1));
  box-shadow: 0 0 12px rgba(79, 172, 254, 0.3);
}

/* 图标样式 */
.icon-point::before { content: "●"; color: #ffffff; }
.icon-label::before { content: "T"; color: #ffffff; font-weight: bold; font-size: 18px; font-family: Arial; }
.icon-orbit::before { content: "◯"; color: #a78bfa; font-size: 26px; }
.icon-orbit-track::before { content: "◇"; color: #fbbf24; }
.icon-ground-track::before { content: "⬡"; color: #f87171; }
.icon-sensor::before { content: "◠"; color: #34d399; }
.icon-model::before { content: "◆"; color: #60a5fa; }
.icon-ground-link::before { content: "⬢"; color: #a3e635; }
.icon-data-link::before { content: "≈"; color: #22d3ee; }
.icon-default::before { content: "○"; color: #9ca3af; }

/* 元素名称 */
.elem-name {
  font-size: 11px;
  color: #b0b0b0;
  text-align: center;
  line-height: 1.2;
  transition: color 0.25s ease;
}

.elem-item:hover .elem-name {
  color: #d0d0d0;
}

.elem-item.active .elem-name {
  color: #4facfe;
  font-weight: 500;
}

/* 激活指示器 */
.elem-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  transition: all 0.25s ease;
}

.elem-item.active .elem-indicator {
  background: #4facfe;
  box-shadow: 0 0 8px #4facfe;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.2);
  }
}

/* 响应式优化 */
@media (max-width: 768px) {
  .satellite-elements-panel {
    width: 280px;
  }

  .elem-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }

  .elem-item {
    padding: 10px 6px;
  }

  .elem-icon {
    width: 28px;
    height: 28px;
    font-size: 20px;
  }
}

/* ===================== 地图模块样式 ===================== */
.map-panel {
  width: 280px;
  max-height: calc(100vh - 120px);
  padding: 12px;
  background: linear-gradient(135deg, rgba(48, 51, 54, 0.95), rgba(35, 38, 41, 0.95));
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  overflow-y: auto;
  overflow-x: hidden;
}

.map-panel .panel-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 12px;
  margin-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.map-panel .panel-icon {
  width: 24px;
  height: 24px;
  filter: brightness(1.5) drop-shadow(0 0 6px rgba(79, 172, 254, 0.5));
}

.map-panel .panel-title {
  font-size: 16px;
  font-weight: 600;
  color: #edffff;
  letter-spacing: 0.5px;
}

.map-panel .settings-section {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  padding: 10px;
  margin-bottom: 10px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.3s ease;
}

.map-panel .settings-section:last-child {
  margin-bottom: 0;
}

.map-panel .settings-section:hover {
  border-color: rgba(79, 172, 254, 0.2);
}

.map-panel .section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 600;
  color: #7eb8e8;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  text-transform: uppercase;
  letter-spacing: 0.8px;
}

.map-panel .section-icon {
  width: 14px;
  height: 14px;
  opacity: 0.8;
}

.icon-layers::before { content: "◫"; color: #4facfe; }
.icon-terrain::before { content: "⛰"; color: #a78bfa; }
.icon-view::before { content: "◉"; color: #f59e0b; }
.icon-camera::before { content: "📷"; }

.map-panel .option-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.map-panel .option-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.25s ease;
  position: relative;
  overflow: hidden;
}

.map-panel .option-item::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, transparent, rgba(79, 172, 254, 0.08));
  opacity: 0;
  transition: opacity 0.25s ease;
}

.map-panel .option-item:hover {
  background: rgba(79, 172, 254, 0.08);
  border-color: rgba(79, 172, 254, 0.3);
  transform: translateX(2px);
}

.map-panel .option-item:hover::before {
  opacity: 1;
}

.map-panel .option-item input {
  display: none;
}

.map-panel .option-text {
  flex: 1;
  font-size: 12px;
  color: #c0c0c0;
  transition: color 0.25s ease;
}

.map-panel .option-item:hover .option-text {
  color: #edffff;
}

.map-panel .option-item:has(input:checked) .option-text {
  color: #4facfe;
  font-weight: 500;
}

/* 开关样式 */
.map-panel .option-toggle {
  width: 36px;
  height: 18px;
  background: rgba(100, 100, 100, 0.4);
  border-radius: 10px;
  position: relative;
  transition: all 0.3s ease;
}

.map-panel .option-toggle::before {
  content: "";
  position: absolute;
  width: 14px;
  height: 14px;
  left: 2px;
  top: 2px;
  background: #888;
  border-radius: 50%;
  transition: all 0.3s ease;
}

.map-panel .option-item:has(input:checked) .option-toggle {
  background: linear-gradient(135deg, #4facfe, #00f2fe);
  box-shadow: 0 0 10px rgba(79, 172, 254, 0.4);
}

.map-panel .option-item:has(input:checked) .option-toggle::before {
  transform: translateX(18px);
  background: #fff;
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.5);
}

/* 单选样式 */
.map-panel .option-radio {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  position: relative;
  transition: all 0.25s ease;
}

.map-panel .option-item.radio:hover .option-radio {
  border-color: rgba(79, 172, 254, 0.6);
}

.map-panel .option-item:has(input:checked) .option-radio {
  border-color: #4facfe;
  background: rgba(79, 172, 254, 0.2);
}

.map-panel .option-item:has(input:checked) .option-radio::after {
  content: "";
  position: absolute;
  width: 8px;
  height: 8px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #4facfe;
  border-radius: 50%;
  box-shadow: 0 0 6px rgba(79, 172, 254, 0.8);
}

/* 激活指示器 */
.map-panel .option-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  transition: all 0.25s ease;
}

.map-panel .option-item:has(input:checked) .option-indicator {
  background: #4facfe;
  box-shadow: 0 0 8px #4facfe;
  animation: indicatorPulse 2s infinite;
}

@keyframes indicatorPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.2); }
}

/* ===================== 调试模块样式 ===================== */
.debug-panel {
  width: 290px;
  max-height: calc(100vh - 120px);
  padding: 12px;
  background: linear-gradient(135deg, rgba(48, 51, 54, 0.95), rgba(35, 38, 41, 0.95));
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  overflow-y: auto;
  overflow-x: hidden;
}

.debug-panel .panel-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 12px;
  margin-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.debug-panel .panel-icon {
  width: 24px;
  height: 24px;
  filter: brightness(1.5) drop-shadow(0 0 6px rgba(79, 172, 254, 0.5));
}

.debug-panel .panel-title {
  font-size: 16px;
  font-weight: 600;
  color: #edffff;
  letter-spacing: 0.5px;
}

.debug-panel .settings-section {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  padding: 10px;
  margin-bottom: 10px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.3s ease;
}

.debug-panel .settings-section:last-child {
  margin-bottom: 0;
}

.debug-panel .settings-section:hover {
  border-color: rgba(79, 172, 254, 0.2);
}

.debug-panel .section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 600;
  color: #7eb8e8;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  text-transform: uppercase;
  letter-spacing: 0.8px;
}

.debug-panel .section-icon {
  width: 14px;
  height: 14px;
  opacity: 0.8;
}

.icon-performance::before { content: "⚡"; color: #fbbf24; }
.icon-visual::before { content: "✨"; color: #a78bfa; }
.icon-location::before { content: "📍"; color: #4facfe; }

.debug-panel .option-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.debug-panel .option-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.25s ease;
  position: relative;
  overflow: hidden;
}

.debug-panel .option-item::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, transparent, rgba(79, 172, 254, 0.08));
  opacity: 0;
  transition: opacity 0.25s ease;
}

.debug-panel .option-item:hover {
  background: rgba(79, 172, 254, 0.08);
  border-color: rgba(79, 172, 254, 0.3);
}

.debug-panel .option-item:hover::before {
  opacity: 1;
}

.debug-panel .option-item input {
  display: none;
}

.debug-panel .option-text {
  flex: 1;
  font-size: 12px;
  color: #c0c0c0;
  transition: color 0.25s ease;
}

.debug-panel .option-item:hover .option-text {
  color: #edffff;
}

.debug-panel .option-item:has(input:checked) .option-text {
  color: #4facfe;
  font-weight: 500;
}

/* 开关样式 */
.debug-panel .option-toggle {
  width: 36px;
  height: 18px;
  background: rgba(100, 100, 100, 0.4);
  border-radius: 10px;
  position: relative;
  transition: all 0.3s ease;
}

.debug-panel .option-toggle::before {
  content: "";
  position: absolute;
  width: 14px;
  height: 14px;
  left: 2px;
  top: 2px;
  background: #888;
  border-radius: 50%;
  transition: all 0.3s ease;
}

.debug-panel .option-item:has(input:checked) .option-toggle {
  background: linear-gradient(135deg, #4facfe, #00f2fe);
  box-shadow: 0 0 10px rgba(79, 172, 254, 0.4);
}

.debug-panel .option-item:has(input:checked) .option-toggle::before {
  transform: translateX(18px);
  background: #fff;
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.5);
}

/* 状态徽章 */
.debug-panel .option-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: rgba(100, 100, 100, 0.3);
  color: #888;
  transition: all 0.3s ease;
}

.debug-panel .option-item:has(input:checked) .option-badge {
  background: linear-gradient(135deg, #4facfe, #00f2fe);
  color: #fff;
  box-shadow: 0 0 8px rgba(79, 172, 254, 0.4);
}

.debug-panel .option-badge.quality {
  font-size: 8px;
  letter-spacing: 1px;
}

.debug-panel .option-item:has(input:checked) .option-badge.quality {
  background: linear-gradient(135deg, #f59e0b, #fbbf24);
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.4);
}

/* 激活指示器 */
.debug-panel .option-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  transition: all 0.25s ease;
}

.debug-panel .option-item:has(input:checked) .option-indicator {
  background: #4facfe;
  box-shadow: 0 0 8px #4facfe;
  animation: indicatorPulse 2s infinite;
}

/* 操作按钮网格 */
.debug-panel .action-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.debug-panel .action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 10px;
  background: linear-gradient(135deg, rgba(79, 172, 254, 0.15), rgba(79, 172, 254, 0.05));
  border: 1px solid rgba(79, 172, 254, 0.3);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.25s ease;
  position: relative;
  overflow: hidden;
}

.debug-panel .action-btn::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(79, 172, 254, 0.2), rgba(0, 0, 0, 0.2));
  opacity: 0;
  transition: opacity 0.25s ease;
}

.debug-panel .action-btn:hover {
  background: linear-gradient(135deg, rgba(79, 172, 254, 0.3), rgba(79, 172, 254, 0.1));
  border-color: rgba(79, 172, 254, 0.6);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3), 0 0 20px rgba(79, 172, 254, 0.2);
}

.debug-panel .action-btn:hover::before {
  opacity: 1;
}

.debug-panel .action-btn:active {
  transform: translateY(0);
}

.debug-panel .btn-icon {
  font-size: 28px;
  transition: transform 0.25s ease;
}

.debug-panel .action-btn:hover .btn-icon {
  transform: scale(1.15);
}

.icon-everest::before { content: "🏔"; }
.icon-dome::before { content: "🗻"; }

.debug-panel .btn-text {
  font-size: 11px;
  font-weight: 600;
  color: #edffff;
  text-align: center;
  transition: color 0.25s ease;
}

.debug-panel .btn-subtext {
  font-size: 10px;
  color: #4facfe;
  font-weight: 500;
}

/* 响应式优化 */
@media (max-width: 768px) {
  .map-panel,
  .debug-panel {
    width: 270px;
    padding: 10px;
  }

  .debug-panel .action-grid {
    grid-template-columns: 1fr;
  }
}

/* ===================== 自定义滚动条样式 ===================== */
/* WebKit 内核浏览器（Chrome、Safari、Edge） */
.satellite-elements-panel::-webkit-scrollbar,
.map-panel::-webkit-scrollbar,
.debug-panel::-webkit-scrollbar,
.ground-station-panel::-webkit-scrollbar {
  width: 6px;
}

.satellite-elements-panel::-webkit-scrollbar-track,
.map-panel::-webkit-scrollbar-track,
.debug-panel::-webkit-scrollbar-track,
.ground-station-panel::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.satellite-elements-panel::-webkit-scrollbar-thumb,
.map-panel::-webkit-scrollbar-thumb,
.debug-panel::-webkit-scrollbar-thumb,
.ground-station-panel::-webkit-scrollbar-thumb {
  background: rgba(79, 172, 254, 0.4);
  border-radius: 3px;
  transition: background 0.2s ease;
}

.satellite-elements-panel::-webkit-scrollbar-thumb:hover,
.map-panel::-webkit-scrollbar-thumb:hover,
.debug-panel::-webkit-scrollbar-thumb:hover,
.ground-station-panel::-webkit-scrollbar-thumb:hover {
  background: rgba(79, 172, 254, 0.7);
}

.satellite-elements-panel::-webkit-scrollbar-corner,
.map-panel::-webkit-scrollbar-corner,
.debug-panel::-webkit-scrollbar-corner,
.ground-station-panel::-webkit-scrollbar-corner {
  background: transparent;
}

/* Firefox 浏览器 */
.satellite-elements-panel,
.map-panel,
.debug-panel,
.ground-station-panel {
  scrollbar-width: thin;
  scrollbar-color: rgba(79, 172, 254, 0.4) rgba(0, 0, 0, 0.2);
}

/* 滚动条悬停时的平滑过渡 */
.satellite-elements-panel::-webkit-scrollbar-thumb:active,
.map-panel::-webkit-scrollbar-thumb:active,
.debug-panel::-webkit-scrollbar-thumb:active,
.ground-station-panel::-webkit-scrollbar-thumb:active {
  background: rgba(79, 172, 254, 0.9);
  box-shadow: 0 0 8px rgba(79, 172, 254, 0.5);
}
</style>
