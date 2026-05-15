<template>
  <div class="custom-satellite">
    <div class="custom-satellite-header">
      <span class="custom-satellite-title">{{ $t("customSatellite") }}</span>
    </div>
    <div class="input-tabs">
      <button :class="{ active: inputMode === 'tle' }" @click="inputMode = 'tle'">
        {{ $t("tleInput") }}
      </button>
      <button :class="{ active: inputMode === 'keplerian' }" @click="inputMode = 'keplerian'">
        {{ $t("keplerianInput") }}
      </button>
    </div>

    <!-- TLE Input Mode -->
    <div v-if="inputMode === 'tle'" class="input-section">
      <div class="input-group">
        <label>{{ $t("satelliteName") }}</label>
        <input v-model="tleName" type="text" :placeholder="$t('enterSatelliteName')" />
      </div>
      <div class="input-group">
        <label>{{ $t("tleData") }}</label>
        <textarea v-model="tleData" rows="3" :placeholder="$t('tlePlaceholder')"></textarea>
      </div>
      <button class="add-button" :disabled="!isValidTle" @click="addSatelliteFromTle">
        {{ $t("addSatellite") }}
      </button>
    </div>

    <!-- Keplerian Elements Input Mode -->
    <div v-if="inputMode === 'keplerian'" class="input-section">
      <div class="input-group">
        <label>{{ $t("satelliteName") }}</label>
        <input v-model="keplerianName" type="text" :placeholder="$t('enterSatelliteName')" />
      </div>
      <div class="keplerian-inputs">
        <div class="input-row">
          <div class="input-group half">
            <label>{{ $t("semiMajorAxis") }} (km)</label>
            <input v-model.number="semiMajorAxis" type="number" step="0.1" min="6578" placeholder="7078" />
          </div>
          <div class="input-group half">
            <label>{{ $t("eccentricity") }} (e)</label>
            <input v-model.number="eccentricity" type="number" step="0.001" min="0" max="0.95" placeholder="0.001" />
          </div>
        </div>
        <div class="input-row">
          <div class="input-group half">
            <label>{{ $t("inclination") }} (i) °</label>
            <input v-model.number="inclination" type="number" step="0.1" min="0" max="180" placeholder="98.5" />
          </div>
          <div class="input-group half">
            <label>{{ $t("raan") }} (Ω) °</label>
            <input v-model.number="raan" type="number" step="0.1" min="0" max="360" placeholder="0" />
          </div>
        </div>
        <div class="input-row">
          <div class="input-group half">
            <label>{{ $t("argPerigee") }} (ω) °</label>
            <input v-model.number="argPerigee" type="number" step="0.1" min="0" max="360" placeholder="0" />
          </div>
          <div class="input-group half">
            <label>{{ $t("trueAnomaly") }} (ν) °</label>
            <input v-model.number="trueAnomaly" type="number" step="0.1" min="0" max="360" placeholder="0" />
          </div>
        </div>
        <div class="input-group">
          <label>{{ $t("epoch") }}</label>
          <input v-model="epoch" type="datetime-local" :placeholder="$t('selectEpoch')" />
        </div>
      </div>
      <button class="add-button" :disabled="!isValidKeplerian" @click="addSatelliteFromKeplerian">
        {{ $t("addSatellite") }}
      </button>
    </div>

    <!-- Added Satellites List -->
    <div v-if="customSatellites.length > 0" class="custom-satellites-list">
      <div class="list-header">{{ $t("addedSatellites") }} ({{ customSatellites.length }})</div>
      <div v-for="sat in customSatellites" :key="sat" class="satellite-item">
        <span>{{ sat }}</span>
        <button class="remove-btn" @click="removeSatellite(sat)">&times;</button>
      </div>
    </div>
  </div>
</template>

<script>
import { mapWritableState } from "pinia";
import { useSatStore } from "../stores/sat";

export default {
  name: "CustomSatellite",
  data() {
    return {
      inputMode: "tle",
      // TLE inputs
      tleName: "西电一号",
      tleData: `1 99999U 99999A   25129.50000000  .00010000  00000-0  10000-3 0  9999
2 99999  55.0000  45.0000 0010000  90.0000 270.0000 15.11234567  99999`,
      // Keplerian inputs
      keplerianName: "",
      semiMajorAxis: null,
      eccentricity: null,
      inclination: null,
      raan: null,
      argPerigee: null,
      trueAnomaly: null,
      epoch: "",
      // Track added satellites
      customSatellites: [],
    };
  },
  computed: {
    ...mapWritableState(useSatStore, ["enabledSatellites"]),
    isValidTle() {
      if (!this.tleName.trim() || !this.tleData.trim()) return false;
      const lines = this.tleData.trim().split("\n");
      return lines.length >= 2 && lines[0].length > 0 && lines[1].length >= 68;
    },
    isValidKeplerian() {
      return (
        this.keplerianName.trim() &&
        this.semiMajorAxis !== null &&
        this.semiMajorAxis > 6578 &&
        this.eccentricity !== null &&
        this.eccentricity >= 0 &&
        this.eccentricity < 1 &&
        this.inclination !== null &&
        this.inclination >= 0 &&
        this.inclination <= 180 &&
        this.raan !== null &&
        this.raan >= 0 &&
        this.raan <= 360 &&
        this.argPerigee !== null &&
        this.argPerigee >= 0 &&
        this.argPerigee <= 360 &&
        this.trueAnomaly !== null &&
        this.trueAnomaly >= 0 &&
        this.trueAnomaly <= 360
      );
    },
  },
  methods: {
    addSatelliteFromTle() {
      if (!this.isValidTle) return;

      const tle = `${this.tleName.trim()}\n${this.tleData.trim()}`;
      const satName = this.tleName.trim();

      if (this.customSatellites.includes(satName)) {
        alert(this.$t("satelliteAlreadyExists"));
        return;
      }

      // Add satellite via global cc object
      if (window.cc && window.cc.sats) {
        window.cc.sats.addFromTle(tle, ["Custom"], true);
        this.customSatellites.push(satName);
        this.enabledSatellites = [...this.enabledSatellites, satName];
        this.resetTleForm();
      }
    },
    addSatelliteFromKeplerian() {
      if (!this.isValidKeplerian) return;

      const satName = this.keplerianName.trim();
      if (this.customSatellites.includes(satName)) {
        alert(this.$t("satelliteAlreadyExists"));
        return;
      }

      // Add satellite via global cc object
      if (window.cc && window.cc.sats) {
        window.cc.sats.addFromKeplerianElements(
          {
            name: satName,
            a: this.semiMajorAxis,
            e: this.eccentricity,
            i: this.inclination,
            omega: this.raan,
            w: this.argPerigee,
            nu: this.trueAnomaly,
          },
          this.epoch ? new Date(this.epoch) : new Date(),
          ["Custom"],
          true
        );
        this.customSatellites.push(satName);
        this.enabledSatellites = [...this.enabledSatellites, satName];
        this.resetKeplerianForm();
      }
    },
    removeSatellite(satName) {
      this.customSatellites = this.customSatellites.filter((s) => s !== satName);
      // Remove from enabled satellites list
      this.enabledSatellites = this.enabledSatellites.filter((s) => s !== satName);
      // Note: The actual satellite entity removal would need to be handled by the SatelliteManager
    },
    resetTleForm() {
      this.tleName = "";
      this.tleData = "";
    },
    resetKeplerianForm() {
      this.keplerianName = "";
      this.semiMajorAxis = null;
      this.eccentricity = null;
      this.inclination = null;
      this.raan = null;
      this.argPerigee = null;
      this.trueAnomaly = null;
      this.epoch = "";
    },
  },
};
</script>

<style scoped>
.custom-satellite {
  background-color: #30333680;
  border-radius: 8px;
  padding: 10px;
  margin-top: 5px;
}

.custom-satellite-header {
  text-align: center;
  margin-bottom: 10px;
}

.custom-satellite-title {
  font-size: 14px;
  font-weight: bold;
  color: #edffff;
}

.input-tabs {
  display: flex;
  gap: 5px;
  margin-bottom: 10px;
}

.input-tabs button {
  flex: 1;
  padding: 6px 8px;
  border: none;
  border-radius: 4px;
  background-color: #3a3d42;
  color: #edffff;
  cursor: pointer;
  font-size: 12px;
  transition: background-color 0.2s;
}

.input-tabs button:hover {
  background-color: #4a4d52;
}

.input-tabs button.active {
  background-color: #0077b6;
}

.input-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.input-group label {
  font-size: 11px;
  color: #a0a0a0;
}

.input-group input,
.input-group textarea {
  padding: 6px 8px;
  border: 1px solid #555;
  border-radius: 4px;
  background-color: #1a1a1a;
  color: #edffff;
  font-size: 12px;
}

.input-group input:focus,
.input-group textarea:focus {
  outline: none;
  border-color: #0077b6;
}

.input-group textarea {
  resize: vertical;
  font-family: monospace;
}

.keplerian-inputs {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-row {
  display: flex;
  gap: 8px;
}

.input-group.half {
  flex: 1;
}

.add-button {
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  background-color: #0077b6;
  color: #ffffff;
  cursor: pointer;
  font-size: 13px;
  font-weight: bold;
  transition: background-color 0.2s;
}

.add-button:hover:not(:disabled) {
  background-color: #005a8c;
}

.add-button:disabled {
  background-color: #555;
  cursor: not-allowed;
}

.custom-satellites-list {
  margin-top: 12px;
  border-top: 1px solid #555;
  padding-top: 10px;
}

.list-header {
  font-size: 12px;
  color: #a0a0a0;
  margin-bottom: 8px;
}

.satellite-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px;
  background-color: #3a3d42;
  border-radius: 4px;
  margin-bottom: 4px;
  font-size: 12px;
}

.remove-btn {
  background: none;
  border: none;
  color: #ff6b6b;
  cursor: pointer;
  font-size: 16px;
  padding: 0 4px;
}

.remove-btn:hover {
  color: #ff4444;
}
</style>
