import {
  Cartesian3,
  ExtrapolationType,
  JulianDate,
  LagrangePolynomialApproximation,
  Matrix3,
  ReferenceFrame,
  SampledPositionProperty,
  TimeInterval,
  TimeIntervalCollection,
  Transforms,
  defined,
} from "@cesium/engine";

const deg2rad = Math.PI / 180;

import Orbit from "./Orbit";
import "./util/CesiumSampledPositionRawValueAccess";

import { CesiumCallbackHelper } from "./util/CesiumCallbackHelper";

export class SatelliteProperties {
  constructor(tle, tags = []) {
    if (tle) {
      this.name = tle.split("\n")[0].trim();
      if (tle.startsWith("0 ")) {
        this.name = this.name.substring(2);
      }
      this.orbit = new Orbit(this.name, tle);
      this.satnum = this.orbit.satnum;
    }
    this.tags = tags;
    this.overpassMode = "elevation";

    this.groundStations = [];
    this.passes = [];
    this.passInterval = undefined;
    this.passIntervals = new TimeIntervalCollection();

    // Data link simulation properties
    this.dataLinkEnabled = false;
    this.dataLinkDistanceThreshold = 800; // km
    this.dataLinkPasses = [];
    this.dataLinkIntervals = new TimeIntervalCollection();
    this.dataLinkInterval = undefined;
    this.currentDataLinkDistance = undefined; // For real-time distance display
  }

  /**
   * Initialize satellite from Keplerian orbital elements
   * @param {Object} elements - Keplerian orbital elements
   * @param {string} elements.name - Satellite name
   * @param {number} elements.a - Semi-major axis in km
   * @param {number} elements.e - Eccentricity
   * @param {number} elements.i - Inclination in degrees
   * @param {number} elements.omega - Right ascension of ascending node (RAAN) in degrees
   * @param {number} elements.w - Argument of perigee in degrees
   * @param {number} elements.nu - True anomaly in degrees
   * @param {Date} epoch - Epoch time
   */
  initFromKeplerianElements(elements, epoch = new Date()) {
    this.name = elements.name;
    this.orbit = Orbit.fromKeplerianElements(this.name, elements, epoch);
    this.satnum = this.orbit.satrec.satnum;
  }

  hasTag(tag) {
    return this.tags.includes(tag);
  }

  addTags(tags) {
    this.tags = [...new Set(this.tags.concat(tags))];
  }

  position(time) {
    return this.sampledPosition.fixed.getValue(time);
  }

  getSampledPositionsForNextOrbit(start, reference = "inertial", loop = true) {
    const end = JulianDate.addSeconds(start, this.orbit.orbitalPeriod * 60, new JulianDate());
    const positions = this.sampledPosition[reference].getRawValues(start, end);
    if (loop) {
      // Readd the first position to the end of the array to close the loop
      return [...positions, positions[0]];
    }
    return positions;
  }

  getSampledPositionsForOrbitPeriod(start) {
    // Get positions for half orbit backwards and half orbit forwards
    const halfOrbit = this.orbit.orbitalPeriod * 30; // seconds
    const startTime = JulianDate.addSeconds(start, -halfOrbit, new JulianDate());
    const endTime = JulianDate.addSeconds(start, halfOrbit, new JulianDate());

    const positions = this.sampledPosition.inertial.getRawValues(startTime, endTime);
    if (positions.length > 0) {
      // Close the loop
      return [...positions, positions[0]];
    }
    return positions;
  }

  createSampledPosition(viewer, callback) {
    this.updateSampledPosition(viewer.clock.currentTime);
    callback(this.sampledPosition);

    const samplingRefreshRate = (this.orbit.orbitalPeriod * 60) / 4;
    const removeCallback = CesiumCallbackHelper.createPeriodicTimeCallback(viewer, samplingRefreshRate, (time) => {
      this.updateSampledPosition(time);
      callback(this.sampledPosition);
    });
    return () => {
      removeCallback();
      this.sampledPosition = undefined;
    };
  }

  updateSampledPosition(time) {
    // Determine sampling interval based on sampled positions per orbit and orbital period
    // 120 samples per orbit seems to be a good compromise between performance and accuracy
    const samplingPointsPerOrbit = 120;
    const orbitalPeriod = this.orbit.orbitalPeriod * 60;
    const samplingInterval = orbitalPeriod / samplingPointsPerOrbit;
    // console.log("updateSampledPosition", this.name, this.orbit.orbitalPeriod, samplingInterval.toFixed(2));

    // Always keep half an orbit backwards and 1.5 full orbits forward in the sampled position
    const request = new TimeInterval({
      start: JulianDate.addSeconds(time, -orbitalPeriod / 2, new JulianDate()),
      stop: JulianDate.addSeconds(time, orbitalPeriod * 1.5, new JulianDate()),
    });

    // (Re)create sampled position if it does not exist or if it does not contain the current time
    if (!this.sampledPosition || !TimeInterval.contains(this.sampledPosition.interval, time)) {
      this.initSampledPosition(request.start);
    }

    // Determine which parts of the requested interval are missing
    const intersect = TimeInterval.intersect(this.sampledPosition.interval, request);
    const missingSecondsEnd = JulianDate.secondsDifference(request.stop, intersect.stop);
    const missingSecondsStart = JulianDate.secondsDifference(intersect.start, request.start);
    // console.log(`updateSampledPosition ${this.name}`,
    //   `Missing ${missingSecondsStart.toFixed(2)}s ${missingSecondsEnd.toFixed(2)}s`,
    //   `Request ${Cesium.TimeInterval.toIso8601(request, 0)}`,
    //   `Current ${Cesium.TimeInterval.toIso8601(this.sampledPosition.interval, 0)}`,
    //   `Intersect ${Cesium.TimeInterval.toIso8601(intersect, 0)}`,
    // );

    if (missingSecondsStart > 0) {
      const samplingStart = JulianDate.addSeconds(intersect.start, -missingSecondsStart, new JulianDate());
      const samplingStop = this.sampledPosition.interval.start;
      this.addSamples(samplingStart, samplingStop, samplingInterval);
    }
    if (missingSecondsEnd > 0) {
      const samplingStart = this.sampledPosition.interval.stop;
      const samplingStop = JulianDate.addSeconds(intersect.stop, missingSecondsEnd, new JulianDate());
      this.addSamples(samplingStart, samplingStop, samplingInterval);
    }

    // Remove no longer needed samples
    const removeBefore = new TimeInterval({
      start: JulianDate.fromIso8601("1957"),
      stop: request.start,
      isStartIncluded: false,
      isStopIncluded: false,
    });
    const removeAfter = new TimeInterval({
      start: request.stop,
      stop: JulianDate.fromIso8601("2100"),
      isStartIncluded: false,
      isStopIncluded: false,
    });
    this.sampledPosition.fixed.removeSamples(removeBefore);
    this.sampledPosition.inertial.removeSamples(removeBefore);
    this.sampledPosition.fixed.removeSamples(removeAfter);
    this.sampledPosition.inertial.removeSamples(removeAfter);

    this.sampledPosition.interval = request;
  }

  initSampledPosition(currentTime) {
    this.sampledPosition = {};
    this.sampledPosition.interval = new TimeInterval({
      start: currentTime,
      stop: currentTime,
      isStartIncluded: false,
      isStopIncluded: false,
    });
    this.sampledPosition.fixed = new SampledPositionProperty();
    this.sampledPosition.fixed.backwardExtrapolationType = ExtrapolationType.HOLD;
    this.sampledPosition.fixed.forwardExtrapolationType = ExtrapolationType.HOLD;
    this.sampledPosition.fixed.setInterpolationOptions({
      interpolationDegree: 5,
      interpolationAlgorithm: LagrangePolynomialApproximation,
    });
    this.sampledPosition.inertial = new SampledPositionProperty(ReferenceFrame.INERTIAL);
    this.sampledPosition.inertial.backwardExtrapolationType = ExtrapolationType.HOLD;
    this.sampledPosition.inertial.forwardExtrapolationType = ExtrapolationType.HOLD;
    this.sampledPosition.inertial.setInterpolationOptions({
      interpolationDegree: 5,
      interpolationAlgorithm: LagrangePolynomialApproximation,
    });
    this.sampledPosition.valid = true;
  }

  addSamples(start, stop, samplingInterval) {
    const times = [];
    const positionsFixed = [];
    const positionsInertial = [];
    for (let time = start; JulianDate.compare(stop, time) >= 0; time = JulianDate.addSeconds(time, samplingInterval, new JulianDate())) {
      const { positionFixed, positionInertial } = this.computePosition(time);
      times.push(time);
      positionsFixed.push(positionFixed);
      positionsInertial.push(positionInertial);
    }
    // Add all samples at once as adding a sorted array avoids searching for the correct position every time
    this.sampledPosition.fixed.addSamples(times, positionsFixed);
    this.sampledPosition.inertial.addSamples(times, positionsInertial);
  }

  computePositionInertialTEME(time) {
    const eci = this.orbit.positionECI(JulianDate.toDate(time));
    if (this.orbit.error) {
      this.sampledPosition.valid = false;
      return Cartesian3.ZERO;
    }
    return new Cartesian3(eci.x * 1000, eci.y * 1000, eci.z * 1000);
  }

  computePosition(timestamp) {
    const positionInertialTEME = this.computePositionInertialTEME(timestamp);

    const temeToFixed = Transforms.computeTemeToPseudoFixedMatrix(timestamp);
    if (!defined(temeToFixed)) {
      console.error("Reference frame transformation data failed to load");
    }
    const positionFixed = Matrix3.multiplyByVector(temeToFixed, positionInertialTEME, new Cartesian3());

    const fixedToIcrf = Transforms.computeFixedToIcrfMatrix(timestamp);
    if (!defined(fixedToIcrf)) {
      console.error("Reference frame transformation data failed to load");
    }
    const positionInertialICRF = Matrix3.multiplyByVector(fixedToIcrf, positionFixed, new Cartesian3());

    // Show computed sampled position
    // window.cc.viewer.entities.add({
    //  //position: positionFixed,
    //  position: new Cesium.ConstantPositionProperty(positionInertialICRF, Cesium.ReferenceFrame.INERTIAL),
    //  point: {
    //    pixelSize: 8,
    //    color: Cesium.Color.TRANSPARENT,
    //    outlineColor: Cesium.Color.YELLOW,
    //    outlineWidth: 2,
    //  }
    // });

    return { positionFixed, positionInertial: positionInertialICRF };
  }

  groundTrack(julianDate, samplesFwd = 1, samplesBwd = 0, interval = 300) {
    const groundTrack = [];

    // Return empty array if sampled position is not valid yet
    if (!this.sampledPosition || !this.sampledPosition.valid) {
      return groundTrack;
    }

    const startTime = -samplesBwd * interval;
    const stopTime = samplesFwd * interval;
    for (let time = startTime; time <= stopTime; time += interval) {
      const timestamp = JulianDate.addSeconds(julianDate, time, new JulianDate());
      groundTrack.push(this.position(timestamp));
    }
    return groundTrack;
  }

  get groundStationAvailable() {
    return this.groundStations.length > 0;
  }

  updatePasses(time) {
    if (!this.groundStationAvailable) {
      return false;
    }
    // Check if still inside of current pass interval
    if (typeof this.passInterval !== "undefined" && TimeInterval.contains(new TimeInterval({ start: this.passInterval.start, stop: this.passInterval.stop }), time)) {
      return false;
    }
    this.passInterval = {
      start: JulianDate.addDays(time, -1, JulianDate.clone(time)),
      stop: JulianDate.addDays(time, 1, JulianDate.clone(time)),
      stopPrediction: JulianDate.addDays(time, 4, JulianDate.clone(time)),
    };

    let allPasses = [];
    this.groundStations.forEach((groundStation) => {
      let passes;
      if (this.overpassMode === "swath") {
        passes = this.orbit.computePassesSwath(groundStation.position, this.swath, JulianDate.toDate(this.passInterval.start), JulianDate.toDate(this.passInterval.stopPrediction));
      } else {
        passes = this.orbit.computePassesElevation(groundStation.position, JulianDate.toDate(this.passInterval.start), JulianDate.toDate(this.passInterval.stopPrediction));
      }
      passes.forEach((pass) => {
        pass.groundStationName = groundStation.name;
      });
      allPasses.push(...passes);
    });

    // Sort passes by time
    allPasses.sort((a, b) => a.start - b.start);

    this.passes = allPasses;
    this.computePassIntervals();
    return true;
  }

  clearPasses() {
    this.passInterval = undefined;
    this.passes = [];
    this.passIntervals = new TimeIntervalCollection();
  }

  computePassIntervals() {
    const passIntervalArray = this.passes.map((pass) => {
      const startJulian = JulianDate.fromDate(new Date(pass.start));
      const endJulian = JulianDate.fromDate(new Date(pass.end));
      return new TimeInterval({
        start: startJulian,
        stop: endJulian,
      });
    });
    this.passIntervals = new TimeIntervalCollection(passIntervalArray);
  }

  /**
   * Get pass intervals for a specific ground station
   * @param {string} groundStationName - Name of the ground station
   * @returns {TimeIntervalCollection|null} Pass intervals for the ground station or null
   */
  getPassIntervalsForGroundStation(groundStationName) {
    if (!this.passes || this.passes.length === 0) {
      return null;
    }

    const filteredPasses = this.passes.filter((pass) => pass.groundStationName === groundStationName);
    if (filteredPasses.length === 0) {
      return null;
    }

    const passIntervalArray = filteredPasses.map((pass) => {
      const startJulian = JulianDate.fromDate(new Date(pass.start));
      const endJulian = JulianDate.fromDate(new Date(pass.end));
      return new TimeInterval({
        start: startJulian,
        stop: endJulian,
      });
    });
    return new TimeIntervalCollection(passIntervalArray);
  }

  /**
   * Update data link passes based on distance threshold
   * @param {JulianDate} time - Current time
   */
  updateDataLinkPasses(time) {
    if (!this.dataLinkEnabled || !this.groundStationAvailable) {
      this.dataLinkPasses = [];
      this.dataLinkIntervals = new TimeIntervalCollection();
      return;
    }

    // Check if still inside current data link interval
    if (typeof this.dataLinkInterval !== "undefined" && TimeInterval.contains(new TimeInterval({ start: this.dataLinkInterval.start, stop: this.dataLinkInterval.stop }), time)) {
      return;
    }

    this.dataLinkInterval = {
      start: JulianDate.addDays(time, -1, JulianDate.clone(time)),
      stop: JulianDate.addDays(time, 1, JulianDate.clone(time)),
      stopPrediction: JulianDate.addDays(time, 4, JulianDate.clone(time)),
    };

    let allDataLinkPasses = [];
    this.groundStations.forEach((groundStation) => {
      const passes = this.orbit.computePassesByDistance(
        groundStation.position,
        this.dataLinkDistanceThreshold,
        JulianDate.toDate(this.dataLinkInterval.start),
        JulianDate.toDate(this.dataLinkInterval.stopPrediction)
      );
      passes.forEach((pass) => {
        pass.groundStationName = groundStation.name;
      });
      allDataLinkPasses.push(...passes);
    });

    // Sort passes by time
    allDataLinkPasses.sort((a, b) => a.start - b.start);
    this.dataLinkPasses = allDataLinkPasses;
    this.computeDataLinkIntervals();
  }

  /**
   * Compute data link intervals from passes
   */
  computeDataLinkIntervals() {
    const intervalArray = this.dataLinkPasses.map((pass) => {
      const startJulian = JulianDate.fromDate(new Date(pass.start));
      const endJulian = JulianDate.fromDate(new Date(pass.end));
      return new TimeInterval({
        start: startJulian,
        stop: endJulian,
      });
    });
    this.dataLinkIntervals = new TimeIntervalCollection(intervalArray);
  }

  /**
   * Clear data link passes
   */
  clearDataLinkPasses() {
    this.dataLinkInterval = undefined;
    this.dataLinkPasses = [];
    this.dataLinkIntervals = new TimeIntervalCollection();
  }

  /**
   * Enable or disable data link simulation
   * @param {boolean} enabled
   */
  setDataLinkEnabled(enabled) {
    this.dataLinkEnabled = enabled;
    if (!enabled) {
      this.clearDataLinkPasses();
    }
  }

  /**
   * Set data link distance threshold
   * @param {number} distanceKm - Distance threshold in kilometers
   */
  setDataLinkDistanceThreshold(distanceKm) {
    this.dataLinkDistanceThreshold = distanceKm;
    if (this.dataLinkEnabled) {
      this.clearDataLinkPasses();
    }
  }

  /**
   * Calculate current distance to nearest ground station
   * @param {JulianDate} time - Current time
   * @returns {number|null} Distance in km or null if no ground station
   */
  getCurrentDataLinkDistance(time) {
    if (!this.groundStationAvailable) {
      return null;
    }

    const positionGeodetic = this.orbit.positionGeodetic(JulianDate.toDate(time));
    if (!positionGeodetic) {
      return null;
    }

    let minDistance = Infinity;
    this.groundStations.forEach((groundStation) => {
      const gs = { ...groundStation.position };
      gs.latitude *= deg2rad;
      gs.longitude *= deg2rad;
      gs.height /= 1000;

      const satLat = positionGeodetic.latitude * deg2rad;
      const satLon = positionGeodetic.longitude * deg2rad;
      const satHeight = positionGeodetic.height / 1000;

      // Calculate great circle distance
      const deltaLat = satLat - gs.latitude;
      const deltaLon = satLon - gs.longitude;
      const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) + Math.cos(gs.latitude) * Math.cos(satLat) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const earthRadius = 6371;
      const surfaceDistance = earthRadius * c;
      const heightDiff = satHeight - gs.height;
      const distance3D = Math.sqrt(Math.pow(surfaceDistance, 2) + Math.pow(heightDiff, 2));

      if (distance3D < minDistance) {
        minDistance = distance3D;
      }
    });

    return minDistance === Infinity ? null : minDistance;
  }

  /**
   * Get the closest ground station within data link range
   * @param {JulianDate} time - Current time
   * @returns {Object|null} { groundStation, distance } or null if none in range
   */
  getClosestGroundStationInRange(time) {
    if (!this.groundStationAvailable) {
      return null;
    }

    const positionGeodetic = this.orbit.positionGeodetic(JulianDate.toDate(time));
    if (!positionGeodetic) {
      return null;
    }

    let closest = null;
    let minDistance = Infinity;

    this.groundStations.forEach((groundStation) => {
      const gs = { ...groundStation.position };
      gs.latitude *= deg2rad;
      gs.longitude *= deg2rad;
      gs.height /= 1000;

      const satLat = positionGeodetic.latitude * deg2rad;
      const satLon = positionGeodetic.longitude * deg2rad;
      const satHeight = positionGeodetic.height / 1000;

      // Calculate great circle distance
      const deltaLat = satLat - gs.latitude;
      const deltaLon = satLon - gs.longitude;
      const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) + Math.cos(gs.latitude) * Math.cos(satLat) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const earthRadius = 6371;
      const surfaceDistance = earthRadius * c;
      const heightDiff = satHeight - gs.height;
      const distance3D = Math.sqrt(Math.pow(surfaceDistance, 2) + Math.pow(heightDiff, 2));

      // Only consider ground stations within data link range
      if (distance3D <= this.dataLinkDistanceThreshold && distance3D < minDistance) {
        minDistance = distance3D;
        closest = groundStation;
      }
    });

    return closest ? { groundStation: closest, distance: minDistance } : null;
  }

  get swath() {
    // Hardcoded swath for certain satellites
    if (["SUOMI NPP", "NOAA 20 (JPSS-1)", "NOAA 21 (JPSS-2)"].includes(this.name)) {
      return 3000;
    }
    if (["AQUA", "TERRA"].includes(this.name)) {
      return 2330;
    }
    if (this.name.includes("SENTINEL-2")) {
      return 290;
    }
    if (this.name.includes("SENTINEL-3")) {
      return 740;
    }
    if (this.name.includes("LANDSAT")) {
      return 185;
    }
    if (this.name.includes("FENGYUN")) {
      return 2900;
    }
    if (this.name.includes("METOP")) {
      return 2900;
    }
    return 200;
  }
}
