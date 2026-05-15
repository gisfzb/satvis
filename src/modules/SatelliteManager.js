import { useSatStore } from "../stores/sat";
import { SatelliteComponentCollection } from "./SatelliteComponentCollection";
import { GroundStationEntity } from "./GroundStationEntity";

import { CesiumCleanupHelper } from "./util/CesiumCleanupHelper";

import {
  CallbackProperty,
  Color,
  JulianDate,
  PolylineGlowMaterialProperty,
} from "@cesium/engine";

const Cesium = {
  CallbackProperty,
  Color,
  PolylineGlowMaterialProperty,
};

export class SatelliteManager {
  #enabledComponents = ["Point", "Label"];

  #enabledTags = [];

  #enabledSatellites = [];

  #groundStations = [];

  #overpassMode = "elevation";

  #dataLinkEnabled = false;

  #dataLinkDistanceThreshold = 800; // km

  #dataLinkUpdateTimer = null;

  #collisionWarningEnabled = false;

  #collisionWarningThreshold = 200; // km

  #collisionWarningEntities = [];

  #collisionEventListener = null; // Cesium onTick event listener

  #collisionDebounceTimer = null; // Debounce timer for threshold changes

  // Performance optimization: throttle collision updates
  #lastCollisionUpdateTime = null;

  #collisionUpdateInterval = 1.0; // seconds between collision updates

  constructor(viewer) {
    this.viewer = viewer;

    this.satellites = [];
    this.availableComponents = ["Point", "Label", "Orbit", "Orbit track", "Ground track", "Sensor cone", "3D model", "Ground station link", "Data link"];

    this.viewer.trackedEntityChanged.addEventListener(() => {
      if (this.trackedSatellite) {
        this.getSatellite(this.trackedSatellite).show(this.#enabledComponents);
      }
      useSatStore().trackedSatellite = this.trackedSatellite;
    });
  }

  addFromTleUrls(urlTagList) {
    // Initiate async download of all TLE URLs and update store afterwards
    const promises = urlTagList.map(([url, tags]) => this.addFromTleUrl(url, tags, false));
    Promise.all(promises).then(() => this.updateStore());
  }

  addFromTleUrl(url, tags, updateStore = true) {
    return fetch(url, {
      mode: "no-cors",
    })
      .then((response) => {
        if (!response.ok) {
          throw Error(response.statusText);
        }
        return response;
      })
      .then((response) => response.text())
      .then((data) => {
        const lines = data.split(/\r?\n/);
        for (let i = 3; i < lines.length; i + 3) {
          const tle = lines.splice(i - 3, i).join("\n");
          this.addFromTle(tle, tags, updateStore);
        }
      })
      .catch((error) => {
        console.log(error);
      });
  }

  addFromTle(tle, tags, updateStore = true) {
    const sat = new SatelliteComponentCollection(this.viewer, tle, tags);
    this.#add(sat);
    if (updateStore) {
      this.updateStore();
    }
  }

  addFromKeplerianElements(elements, epoch = new Date(), tags = [], updateStore = true) {
    const sat = new SatelliteComponentCollection(this.viewer, null, tags);
    // Set up the satellite with Keplerian elements
    sat.props.initFromKeplerianElements(elements, epoch);
    this.#add(sat);
    if (updateStore) {
      this.updateStore();
    }
  }

  #add(newSat) {
    const existingSat = this.satellites.find((sat) => sat.props.satnum === newSat.props.satnum && sat.props.name === newSat.props.name);
    if (existingSat) {
      existingSat.props.addTags(newSat.props.tags);
      if (newSat.props.tags.some((tag) => this.#enabledTags.includes(tag))) {
        existingSat.show(this.#enabledComponents);
      }
      return;
    }
    if (this.groundStationAvailable) {
      newSat.groundStations = this.#groundStations;
    }
    // Set overpass mode for newly added satellite
    newSat.props.overpassMode = this.#overpassMode;
    this.satellites.push(newSat);

    if (this.satIsActive(newSat)) {
      newSat.show(this.#enabledComponents);
      if (this.pendingTrackedSatellite === newSat.props.name) {
        this.trackedSatellite = newSat.props.name;
      }
    }
  }

  updateStore() {
    const satStore = useSatStore();
    satStore.availableTags = this.tags;
    satStore.availableSatellitesByTag = this.taglist;
  }

  get taglist() {
    const taglist = {};
    this.satellites.forEach((sat) => {
      sat.props.tags.forEach((tag) => {
        (taglist[tag] = taglist[tag] || []).push(sat.props.name);
      });
    });
    Object.values(taglist).forEach((tag) => {
      tag.sort();
    });
    return taglist;
  }

  get selectedSatellite() {
    const satellite = this.satellites.find((sat) => sat.isSelected);
    return satellite ? satellite.props.name : "";
  }

  get trackedSatellite() {
    const satellite = this.satellites.find((sat) => sat.isTracked);
    return satellite ? satellite.props.name : "";
  }

  set trackedSatellite(name) {
    if (!name) {
      if (this.trackedSatellite) {
        this.viewer.trackedEntity = undefined;
      }
      return;
    }
    if (name === this.trackedSatellite) {
      return;
    }

    const sat = this.getSatellite(name);
    if (sat) {
      sat.track();
      this.pendingTrackedSatellite = undefined;
    } else {
      // Satellite does not exist (yet?)
      this.pendingTrackedSatellite = name;
    }
  }

  get visibleSatellites() {
    return this.satellites.filter((sat) => sat.created);
  }

  get satelliteNames() {
    return this.satellites.map((sat) => sat.props.name);
  }

  getSatellite(name) {
    return this.satellites.find((sat) => sat.props.name === name);
  }

  get enabledSatellites() {
    return this.#enabledSatellites;
  }

  set enabledSatellites(newSats) {
    this.#enabledSatellites = newSats;
    this.showEnabledSatellites();

    const satStore = useSatStore();
    satStore.enabledSatellites = newSats;
  }

  get tags() {
    const tags = this.satellites.map((sat) => sat.props.tags);
    return [...new Set([].concat(...tags))];
  }

  getSatellitesWithTag(tag) {
    return this.satellites.filter((sat) => sat.props.hasTag(tag));
  }

  /**
   * Returns true if the satellite is enabled by tag or name
   * @param {SatelliteComponentCollection} sat
   * @returns {boolean} true if the satellite is enabled
   */
  satIsActive(sat) {
    const enabledByTag = this.#enabledTags.some((tag) => sat.props.hasTag(tag));
    const enabledByName = this.#enabledSatellites.includes(sat.props.name);
    return enabledByTag || enabledByName;
  }

  get activeSatellites() {
    return this.satellites.filter((sat) => this.satIsActive(sat));
  }

  showEnabledSatellites() {
    this.satellites.forEach((sat) => {
      if (this.satIsActive(sat)) {
        sat.show(this.#enabledComponents);
      } else {
        sat.hide();
      }
    });
    if (this.visibleSatellites.length === 0) {
      CesiumCleanupHelper.cleanup(this.viewer);
    }
  }

  get enabledTags() {
    return this.#enabledTags;
  }

  set enabledTags(newTags) {
    this.#enabledTags = newTags;
    this.showEnabledSatellites();

    const satStore = useSatStore();
    satStore.enabledTags = newTags;
  }

  get components() {
    const components = this.satellites.map((sat) => sat.components);
    return [...new Set([].concat(...components))];
  }

  get enabledComponents() {
    return this.#enabledComponents;
  }

  set enabledComponents(newComponents) {
    const oldComponents = this.#enabledComponents;
    const add = newComponents.filter((x) => !oldComponents.includes(x));
    const del = oldComponents.filter((x) => !newComponents.includes(x));
    add.forEach((component) => {
      this.enableComponent(component);
    });
    del.forEach((component) => {
      this.disableComponent(component);
    });
  }

  enableComponent(componentName) {
    if (!this.#enabledComponents.includes(componentName)) {
      this.#enabledComponents.push(componentName);
    }

    this.activeSatellites.forEach((sat) => {
      sat.enableComponent(componentName);
    });
  }

  disableComponent(componentName) {
    this.#enabledComponents = this.#enabledComponents.filter((name) => name !== componentName);

    this.activeSatellites.forEach((sat) => {
      sat.disableComponent(componentName);
    });
  }

  get groundStationAvailable() {
    return this.#groundStations.length > 0;
  }

  focusGroundStation() {
    if (this.groundStationAvailable) {
      this.#groundStations[0].track();
    }
  }

  createGroundstation(position, name) {
    const groundStation = new GroundStationEntity(this.viewer, this, position, name);
    groundStation.show();
    return groundStation;
  }

  addGroundStation(position, name) {
    if (position.height < 1) {
      position.height = 0;
    }
    const groundStation = this.createGroundstation(position, name);
    this.groundStations = [...this.#groundStations, groundStation];
  }

  get groundStations() {
    return this.#groundStations;
  }

  set groundStations(newGroundStations) {
    this.#groundStations = newGroundStations;

    // Set groundstation for all satellites
    this.satellites.forEach((sat) => {
      sat.groundStations = this.#groundStations;
    });

    // Update store for url state
    const satStore = useSatStore();
    // TODO Store all groundsations in url param with name
    satStore.groundStations = this.#groundStations.map((gs) => ({
      lat: gs.position.latitude,
      lon: gs.position.longitude,
      name: gs.hasName ? gs.name : undefined,
    }));
  }

  get overpassMode() {
    return this.#overpassMode;
  }

  set overpassMode(newMode) {
    this.#overpassMode = newMode;
    // Update overpass mode for all satellites
    this.satellites.forEach((sat) => {
      sat.props.overpassMode = newMode;
    });
    // Clear and update passes for all satellites with ground stations to force recalculation
    this.satellites.forEach((sat) => {
      if (sat.props.groundStationAvailable) {
        sat.props.clearPasses();
        sat.props.updatePasses(this.viewer.clock.currentTime);
      }
    });
  }

  get pendingUpdate() {
    return SatelliteComponentCollection.primitivePendingUpdate;
  }

  /**
   * Get data link enabled state
   */
  get dataLinkEnabled() {
    return this.#dataLinkEnabled;
  }

  /**
   * Set data link enabled state for all satellites
   * @param {boolean} enabled
   */
  set dataLinkEnabled(enabled) {
    this.#dataLinkEnabled = enabled;
    this.satellites.forEach((sat) => {
      sat.props.setDataLinkEnabled(enabled);
      if (enabled && sat.created) {
        sat.enableComponent("Data link");
        sat.props.updateDataLinkPasses(this.viewer.clock.currentTime);
      } else if (!enabled && sat.created) {
        sat.disableComponent("Data link");
      }
    });
  }

  /**
   * Get data link distance threshold
   */
  get dataLinkDistanceThreshold() {
    return this.#dataLinkDistanceThreshold;
  }

  /**
   * Set data link distance threshold for all satellites
   * @param {number} distanceKm - Distance threshold in kilometers
   */
  set dataLinkDistanceThreshold(distanceKm) {
    this.#dataLinkDistanceThreshold = distanceKm;
    this.satellites.forEach((sat) => {
      sat.props.setDataLinkDistanceThreshold(distanceKm);
    });

    // Debounce the expensive recalculation of data link passes
    // to prevent UI freeze when slider is being dragged
    if (this.#dataLinkUpdateTimer) {
      clearTimeout(this.#dataLinkUpdateTimer);
    }
    this.#dataLinkUpdateTimer = setTimeout(() => {
      this.satellites.forEach((sat) => {
        if (this.#dataLinkEnabled && sat.props.groundStationAvailable) {
          sat.props.clearDataLinkPasses();
          sat.props.updateDataLinkPasses(this.viewer.clock.currentTime);
        }
      });
    }, 100);
  }

  /**
   * Get current data link distance for a satellite
   * @param {string} satName - Satellite name
   * @returns {number|null} Distance in km or null
   */
  getSatelliteDataLinkDistance(satName) {
    const sat = this.getSatellite(satName);
    if (!sat) return null;
    return sat.props.getCurrentDataLinkDistance(this.viewer.clock.currentTime);
  }

  /**
   * Get the name of the currently connected ground station for a satellite
   * @param {string} satName - Satellite name
   * @returns {string|null} Ground station name or null if not connected
   */
  getCurrentConnectedStation(satName) {
    const sat = this.getSatellite(satName);
    if (!sat) return null;
    const closest = sat.props.getClosestGroundStationInRange(this.viewer.clock.currentTime);
    if (closest && sat.props.dataLinkEnabled) {
      return closest.groundStation.name;
    }
    return null;
  }

  /**
   * Get collision warning enabled state
   */
  get collisionWarningEnabled() {
    return this.#collisionWarningEnabled;
  }

  /**
   * Set collision warning enabled state
   * @param {boolean} enabled
   */
  set collisionWarningEnabled(enabled) {
    this.#collisionWarningEnabled = enabled;
    if (enabled) {
      this.startCollisionMonitoring();
    } else {
      this.stopCollisionMonitoring();
    }
  }

  /**
   * Get collision warning distance threshold
   */
  get collisionWarningThreshold() {
    return this.#collisionWarningThreshold;
  }

  /**
   * Set collision warning distance threshold
   * @param {number} distanceKm - Distance threshold in kilometers
   */
  set collisionWarningThreshold(distanceKm) {
    this.#collisionWarningThreshold = distanceKm;
    // Debounce the collision check
    if (this.#collisionDebounceTimer) {
      clearTimeout(this.#collisionDebounceTimer);
    }
    this.#collisionDebounceTimer = setTimeout(() => {
      this.updateCollisionWarnings();
    }, 100);
  }

  /**
   * Get current collision warnings
   * @returns {Array} Array of collision warning objects
   */
  getCollisionWarnings() {
    return this.getCurrentCollisionWarnings();
  }

  /**
   * Get current collision warnings for the current time
   * @returns {Array} Array of { sat1, sat2, distance } objects
   */
  getCurrentCollisionWarnings() {
    if (!this.#collisionWarningEnabled) {
      return [];
    }

    const warnings = [];
    // Use active satellites (enabled by tag or name) for collision detection
    // This includes all satellites that have been enabled in the selection
    const activeSats = this.activeSatellites;
    const len = activeSats.length;

    // Early exit for trivial cases
    if (len < 2) {
      console.log(`[Collision Debug] Not enough satellites: ${len} (need at least 2)`);
      return warnings;
    }

    // DEBUG: Log active satellites and threshold
    console.log(`[Collision Debug] Active sats: ${len}, threshold: ${this.#collisionWarningThreshold} km`);

    // Increase limit to 200 satellites (19,900 pairs) for more comprehensive coverage
    // For larger sets, we'll use a grid-based spatial partitioning approach
    const maxPairs = 19900; // ~200 satellites
    const maxSatsForFullCheck = 200;

    // Pre-fetch positions for all satellites using position() method (safer)
    const time = this.viewer.clock.currentTime;
    const threshold = this.#collisionWarningThreshold;
    const thresholdMeters = threshold * 1000;

    const positions = [];
    for (let i = 0; i < len; i++) {
      const sat = activeSats[i];
      try {
        const pos = sat.props.position(time);
        // Validate position - must have valid x, y, z coordinates (not 0,0,0)
        if (pos && pos.x !== undefined && pos.y !== undefined && pos.z !== undefined) {
          // Skip ZERO Cartesian3 (invalid position)
          if (pos.x === 0 && pos.y === 0 && pos.z === 0) {
            continue;
          }
          positions.push({
            sat: sat,
            name: sat.props.name,
            x: pos.x,
            y: pos.y,
            z: pos.z,
          });
        }
      } catch (e) {
        console.warn(`[Collision] Error getting position for ${sat.props.name}:`, e.message);
      }
    }

    const posLen = positions.length;
    console.log(`[Collision Debug] Positions fetched: ${posLen}/${len}`);

    if (posLen < 2) {
      return warnings;
    }

    // If too many satellites, use spatial grid partitioning for efficiency
    if (posLen > maxSatsForFullCheck) {
      console.log(`[Collision] Using spatial partitioning for ${posLen} satellites`);
      return this._checkCollisionsSpatial(positions, thresholdMeters, threshold);
    }

    // Full pair-wise check for reasonable satellite counts
    let closestDistance = Infinity;
    let closestPair = null;
    let totalPairs = 0;
    let withinThresholdCount = 0;

    for (let i = 0; i < posLen; i++) {
      const pos1 = positions[i];

      for (let j = i + 1; j < posLen; j++) {
        const pos2 = positions[j];

        totalPairs++;

        // Calculate Euclidean distance in meters, convert to km
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        const dz = pos1.z - pos2.z;
        const distSquared = dx * dx + dy * dy + dz * dz;
        const distance = Math.sqrt(distSquared) / 1000;

        // Skip invalid distances (shouldn't happen but be safe)
        if (distance <= 0 || !isFinite(distance)) {
          continue;
        }

        // Track closest pair for debugging
        if (distance < closestDistance) {
          closestDistance = distance;
          closestPair = [pos1.name, pos2.name];
        }

        if (distance <= threshold) {
          withinThresholdCount++;
          warnings.push({
            sat1: pos1.name,
            sat2: pos2.name,
            distance: distance,
          });
        }
      }
    }

    // Log distance statistics for debugging
    console.log(`[Collision Debug] Total pairs: ${totalPairs}, within threshold: ${withinThresholdCount}`);

    // Log closest pair for debugging
    if (closestPair) {
      console.log(`[Collision Debug] Closest pair: ${closestPair[0]} ↔ ${closestPair[1]}: ${closestDistance.toFixed(2)} km (threshold: ${threshold} km)`);
    }

    return warnings;
  }

  /**
   * Spatial grid-based collision check for large satellite sets
   * Divides 3D space into grid cells and only checks satellites in same/adjacent cells
   * @param {Array} positions - Array of satellite position objects
   * @param {number} thresholdMeters - Distance threshold in meters
   * @param {number} thresholdKm - Distance threshold in km
   * @returns {Array} Array of collision warnings
   */
  _checkCollisionsSpatial(positions, thresholdMeters, thresholdKm) {
    const warnings = [];
    const cellSize = thresholdMeters * 2.5; // Cell size ~2.5x threshold

    // Build spatial grid
    const grid = new Map();
    for (const pos of positions) {
      const cx = Math.floor(pos.x / cellSize);
      const cy = Math.floor(pos.y / cellSize);
      const cz = Math.floor(pos.z / cellSize);
      const key = `${cx},${cy},${cz}`;
      if (!grid.has(key)) {
        grid.set(key, []);
      }
      grid.get(key).push(pos);
    }

    console.log(`[Collision Spatial] Grid cells: ${grid.size}`);

    // Check satellites in same and adjacent cells
    const checked = new Set();
    let totalPairs = 0;
    let withinThresholdCount = 0;
    let closestDistance = Infinity;
    let closestPair = null;

    for (const [cellKey, cellSatellites] of grid) {
      const [cx, cy, cz] = cellKey.split(",").map(Number);

      // Check all adjacent cells (3x3x3 neighborhood)
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dz = -1; dz <= 1; dz++) {
            const neighborKey = `${cx + dx},${cy + dy},${cz + dz}`;
            const neighborSatellites = grid.get(neighborKey);
            if (!neighborSatellites) continue;

            for (const sat1 of cellSatellites) {
              for (const sat2 of neighborSatellites) {
                // Avoid double-checking same pair
                const pairKey = sat1.name < sat2.name ? `${sat1.name}|${sat2.name}` : `${sat2.name}|${sat1.name}`;
                if (checked.has(pairKey)) continue;
                checked.add(pairKey);

                totalPairs++;

                const distX = sat1.x - sat2.x;
                const distY = sat1.y - sat2.y;
                const distZ = sat1.z - sat2.z;
                const distSquared = distX * distX + distY * distY + distZ * distZ;
                const distance = Math.sqrt(distSquared) / 1000;

                // Skip invalid distances
                if (distance <= 0 || !isFinite(distance)) {
                  continue;
                }

                if (distance < closestDistance) {
                  closestDistance = distance;
                  closestPair = [sat1.name, sat2.name];
                }

                if (distance <= thresholdKm) {
                  withinThresholdCount++;
                  warnings.push({
                    sat1: sat1.name,
                    sat2: sat2.name,
                    distance: distance,
                  });
                }
              }
            }
          }
        }
      }
    }

    console.log(`[Collision Spatial] Total pairs: ${totalPairs}, within threshold: ${withinThresholdCount}`);
    if (closestPair) {
      console.log(`[Collision Spatial] Closest pair: ${closestPair[0]} ↔ ${closestPair[1]}: ${closestDistance.toFixed(2)} km`);
    }

    return warnings;
  }

  /**
   * Start collision monitoring
   */
  startCollisionMonitoring() {
    console.log("[Collision] startCollisionMonitoring called");
    // Add throttled update listener to clock
    if (this.#collisionEventListener) {
      console.log("[Collision] Already running, skipping");
      return; // Already running
    }

    console.log("[Collision] Starting monitoring...");
    // Initial collision check immediately when enabled
    this.updateCollisionWarnings();

    const self = this;
    this.#collisionUpdateInterval = 2.0; // Increase to 2 seconds to reduce CPU load
    this.#collisionEventListener = this.viewer.clock.onTick.addEventListener(() => {
      const time = self.viewer.clock.currentTime;
      const currentSeconds = JulianDate.toDate(time).getTime() / 1000;

      // Throttle updates
      if (self.#lastCollisionUpdateTime !== null) {
        if (currentSeconds - self.#lastCollisionUpdateTime < self.#collisionUpdateInterval) {
          return;
        }
      }
      self.#lastCollisionUpdateTime = currentSeconds;

      // Run collision check
      try {
        self.updateCollisionWarnings();
      } catch (e) {
        console.error("[Collision] Error during collision update:", e);
      }
    });
  }

  /**
   * Stop collision monitoring and remove warning lines
   */
  stopCollisionMonitoring() {
    if (this.#collisionEventListener) {
      this.viewer.clock.onTick.removeEventListener(this.#collisionEventListener);
      this.#collisionEventListener = null;
    }
    if (this.#collisionDebounceTimer) {
      clearTimeout(this.#collisionDebounceTimer);
      this.#collisionDebounceTimer = null;
    }
    this.#lastCollisionUpdateTime = null;
    this.clearCollisionWarnings();
  }

  /**
   * Update collision warnings and manage warning line entities
   */
  updateCollisionWarnings() {
    if (!this.#collisionWarningEnabled) {
      return;
    }

    const warnings = this.getCurrentCollisionWarnings();

    console.log(`[Collision Update] Found ${warnings.length} warnings`);

    // Update store every time (remove the hasChanged optimization)
    const satStore = useSatStore();
    satStore.collisionWarnings = warnings;

    // Log collision warnings
    if (warnings.length > 0) {
      console.warn("⚠️ [碰撞预警] 检测到卫星接近风险:");
      warnings.forEach((w) => {
        console.warn(`  🚨 ${w.sat1} ↔ ${w.sat2}: 距离 ${w.distance.toFixed(2)} km`);
        // Verify satellites exist
        const sat1 = this.getSatellite(w.sat1);
        const sat2 = this.getSatellite(w.sat2);
        console.log(`[Collision] Verify: ${w.sat1} exists: ${!!sat1}, ${w.sat2} exists: ${!!sat2}`);
      });
    }

    // Update warning line entities
    this.updateCollisionWarningEntities(warnings);
  }

  /**
   * Clear all collision warning entities
   */
  clearCollisionWarnings() {
    this.#collisionWarningEntities.forEach((entity) => {
      this.viewer.entities.remove(entity);
    });
    this.#collisionWarningEntities = [];
    const satStore = useSatStore();
    satStore.collisionWarnings = [];
  }

  /**
   * Update collision warning line entities
   * @param {Array} warnings - Array of warning objects
   */
  updateCollisionWarningEntities(warnings) {
    // Build a set of current warning keys for quick lookup
    const currentKeys = new Set(warnings.map((w) => `${w.sat1}||${w.sat2}`));

    // Remove entities that are no longer needed
    const toRemove = this.#collisionWarningEntities.filter((entity) => {
      const key = entity.warningKey;
      return !currentKeys.has(key);
    });
    toRemove.forEach((entity) => {
      this.viewer.entities.remove(entity);
      console.log(`[Collision] Removed warning line: ${entity.warningKey}`);
    });
    this.#collisionWarningEntities = this.#collisionWarningEntities.filter((e) => !toRemove.includes(e));

    // Add new entities for new warnings
    const existingKeys = new Set(this.#collisionWarningEntities.map((e) => e.warningKey));

    warnings.forEach((warning) => {
      const key = `${warning.sat1}||${warning.sat2}`;
      if (existingKeys.has(key)) {
        return; // Already exists
      }

      const sat1 = this.getSatellite(warning.sat1);
      const sat2 = this.getSatellite(warning.sat2);

      if (!sat1 || !sat2) {
        console.warn(`[Collision] Could not find satellites: ${warning.sat1} or ${warning.sat2}`);
        return;
      }

      // Create entity with unique ID for debugging
      const entityId = `collision-warning-${warning.sat1}-${warning.sat2}`;
      const entity = this.viewer.entities.add({
        id: entityId,
        polyline: {
          positions: new Cesium.CallbackProperty((time) => {
            try {
              const pos1 = sat1.props.position(time);
              const pos2 = sat2.props.position(time);
              // Return array only if both positions are valid
              if (pos1 && pos2 && pos1.x !== 0 && pos1.y !== 0 && pos1.z !== 0 && pos2.x !== 0 && pos2.y !== 0 && pos2.z !== 0) {
                return [pos1, pos2];
              }
            } catch (e) {
              console.warn(`[Collision] Position error: ${e.message}`);
            }
            return [];
          }, false),
          followSurface: false,
          material: Cesium.Color.RED.withAlpha(0.8),
          width: 4,
          clampToGround: false,
        },
      });

      // Store key for later comparison
      entity.warningKey = key;
      this.#collisionWarningEntities.push(entity);
      console.log(`[Collision] Created warning line: ${warning.sat1} ↔ ${warning.sat2} (distance: ${warning.distance.toFixed(2)} km)`);
    });

    // Log current entity count
    console.log(`[Collision] Active warning lines: ${this.#collisionWarningEntities.length}`);
  }
}
