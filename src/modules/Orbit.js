import * as satellitejs from "satellite.js";
import dayjs from "dayjs";

const deg2rad = Math.PI / 180;
const rad2deg = 180 / Math.PI;

export default class Orbit {
  constructor(name, tle) {
    this.name = name;
    this.tle = tle.split("\n");
    this.satrec = satellitejs.twoline2satrec(this.tle[1], this.tle[2]);
  }

  /**
   * Create an Orbit from Keplerian elements
   * @param {string} name - Satellite name
   * @param {Object} elements - Keplerian elements (a, e, i, omega, w, nu)
   * @param {number} elements.a - Semi-major axis in km
   * @param {number} elements.e - Eccentricity
   * @param {number} elements.i - Inclination in degrees
   * @param {number} elements.omega - Right ascension of ascending node (RAAN) in degrees
   * @param {number} elements.w - Argument of perigee in degrees
   * @param {number} elements.nu - True anomaly in degrees
   * @param {Date} epoch - Epoch time
   */
  static fromKeplerianElements(name, elements, epoch = new Date()) {
    const orbit = new Orbit(name, null);
    orbit.isCustomOrbit = true;
    orbit.customElements = {
      ...elements,
      epoch: epoch,
    };
    orbit.initSatrecFromKeplerian(elements, epoch);
    return orbit;
  }

  initSatrecFromKeplerian(elements, epoch) {
    const { a, e, i, omega, w, nu } = elements;

    // Convert degrees to radians
    const inclinationRad = i * deg2rad;
    const raanRad = omega * deg2rad;
    const argPerigeeRad = w * deg2rad;
    const trueAnomalyRad = nu * deg2rad;

    // Calculate mean motion (n) from semi-major axis using Kepler's third law
    // n = sqrt(GM/a^3) where GM for Earth is approximately 398600.4418 km^3/s^2
    const GM = 398600.4418; // km^3/s^2
    const meanMotion = Math.sqrt(GM / Math.pow(a, 3)); // rad/s
    const meanMotionDegPerSec = meanMotion * rad2deg;
    const meanMotionRevPerDay = meanMotionDegPerSec * 240; // revolutions per day (360 * 240 = 86400 seconds per day)

    // Calculate mean anomaly from true anomaly
    const M = satellitejs.trueToMeanAnomalyEclipse(trueAnomalyRad, e);

    // Create a satrec-like object for position calculation
    // This mimics the structure returned by twoline2satrec
    this.satrec = {
      satnum: Math.floor(Math.random() * 100000),
      epoch: epoch.getTime(),
      epochday: satellitejs.julianDateToJ2000(satellitejs.dateToJulianDate(epoch)),
      // Mean motion in rad/s
      no: meanMotion,
      // Mean motion in deg/s
      ndot: 0,
      nddot: 0,
      // Eccentricity
      ecco: e,
      // Argument of perigee in radians
      argpo: argPerigeeRad,
      // Inclination in radians
      inclo: inclinationRad,
      // Mean anomaly in radians
      mo: M,
      // Right ascension of ascending node in radians
      nodeo: raanRad,
    };
  }

  get satnum() {
    return this.satrec.satnum;
  }

  get error() {
    return this.satrec.error;
  }

  get julianDate() {
    return this.satrec.jdsatepoch;
  }

  get orbitalPeriod() {
    const meanMotionRad = this.satrec.no;
    const period = (2 * Math.PI) / meanMotionRad;
    return period;
  }

  positionECI(time) {
    const result = satellitejs.propagate(this.satrec, time);
    return result ? result.position : null;
  }

  positionECF(time) {
    const positionEci = this.positionECI(time);
    if (!positionEci) return null;
    const gmst = satellitejs.gstime(time);
    const positionEcf = satellitejs.eciToEcf(positionEci, gmst);
    return positionEcf;
  }

  positionGeodetic(timestamp, calculateVelocity = false) {
    const result = satellitejs.propagate(this.satrec, timestamp);
    if (!result) return null;
    const { position: positionEci, velocity: velocityVector } = result;
    const gmst = satellitejs.gstime(timestamp);
    const positionGd = satellitejs.eciToGeodetic(positionEci, gmst);

    return {
      longitude: positionGd.longitude * rad2deg,
      latitude: positionGd.latitude * rad2deg,
      height: positionGd.height * 1000,
      ...(calculateVelocity && {
        velocity: Math.sqrt(velocityVector.x * velocityVector.x + velocityVector.y * velocityVector.y + velocityVector.z * velocityVector.z),
      }),
    };
  }

  computePassesElevation(groundStationPosition, startDate = dayjs().toDate(), endDate = dayjs(startDate).add(7, "day").toDate(), minElevation = 5, maxPasses = 50) {
    const groundStation = { ...groundStationPosition };
    groundStation.latitude *= deg2rad;
    groundStation.longitude *= deg2rad;
    groundStation.height /= 1000;

    const date = new Date(startDate);
    const passes = [];
    let pass = false;
    let ongoingPass = false;
    let lastElevation = 0;
    // eslint-disable-next-line no-unmodified-loop-condition -- date is mutated via setMinutes/setSeconds
    while (date < endDate) {
      const positionEcf = this.positionECF(date);
      if (!positionEcf) {
        date.setMinutes(date.getMinutes() + 1);
        continue;
      }
      const lookAngles = satellitejs.ecfToLookAngles(groundStation, positionEcf);
      const elevation = lookAngles.elevation / deg2rad;

      if (elevation > minElevation) {
        if (!ongoingPass) {
          // Start of new pass
          pass = {
            name: this.name,
            start: date.getTime(),
            azimuthStart: lookAngles.azimuth,
            maxElevation: elevation,
            azimuthApex: lookAngles.azimuth,
          };
          ongoingPass = true;
        } else if (elevation > pass.maxElevation) {
          // Ongoing pass
          pass.maxElevation = elevation;
          pass.apex = date.getTime();
          pass.azimuthApex = lookAngles.azimuth;
        }
        date.setSeconds(date.getSeconds() + 5);
      } else if (ongoingPass) {
        // End of pass
        pass.end = date.getTime();
        pass.duration = pass.end - pass.start;
        pass.azimuthEnd = lookAngles.azimuth;
        pass.azimuthStart /= deg2rad;
        pass.azimuthApex /= deg2rad;
        pass.azimuthEnd /= deg2rad;
        passes.push(pass);
        if (passes.length >= maxPasses) {
          break;
        }
        ongoingPass = false;
        lastElevation = -180;
        date.setMinutes(date.getMinutes() + this.orbitalPeriod * 0.5);
      } else {
        const deltaElevation = elevation - lastElevation;
        lastElevation = elevation;
        if (deltaElevation < 0) {
          date.setMinutes(date.getMinutes() + this.orbitalPeriod * 0.5);
          lastElevation = -180;
        } else if (elevation < -20) {
          date.setMinutes(date.getMinutes() + 5);
        } else if (elevation < -5) {
          date.setMinutes(date.getMinutes() + 1);
        } else if (elevation < -1) {
          date.setSeconds(date.getSeconds() + 5);
        } else {
          date.setSeconds(date.getSeconds() + 2);
        }
      }
    }
    return passes;
  }

  computePassesSwath(groundStationPosition, swathKm, startDate = dayjs().toDate(), endDate = dayjs(startDate).add(7, "day").toDate(), maxPasses = 50) {
    const groundStation = { ...groundStationPosition };
    groundStation.latitude *= deg2rad;
    groundStation.longitude *= deg2rad;
    groundStation.height /= 1000;

    const date = new Date(startDate);
    const passes = [];
    let pass = false;
    let ongoingPass = false;
    let lastDistance = Number.MAX_VALUE;

    // eslint-disable-next-line no-unmodified-loop-condition -- date is mutated via setMinutes/setSeconds
    while (date < endDate) {
      const positionGeodetic = this.positionGeodetic(date);
      if (!positionGeodetic) {
        date.setMinutes(date.getMinutes() + 1);
        continue;
      }

      // Convert satellite position to radians for calculations
      const satLat = positionGeodetic.latitude * deg2rad;
      const satLon = positionGeodetic.longitude * deg2rad;

      // Calculate great circle distance between satellite and ground station
      const deltaLat = satLat - groundStation.latitude;
      const deltaLon = satLon - groundStation.longitude;
      const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) + Math.cos(groundStation.latitude) * Math.cos(satLat) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const earthRadius = 6371; // Earth radius in km
      const distanceKm = earthRadius * c;

      // Check if ground station is within swath
      const halfSwath = swathKm / 2;
      const withinSwath = distanceKm <= halfSwath;

      if (withinSwath) {
        if (!ongoingPass) {
          // Start of new pass
          pass = {
            name: this.name,
            start: date.getTime(),
            minDistance: distanceKm,
            minDistanceTime: date.getTime(),
            swathWidth: swathKm,
          };
          ongoingPass = true;
        } else if (distanceKm < pass.minDistance) {
          // Update minimum distance (closest approach)
          pass.minDistance = distanceKm;
          pass.minDistanceTime = date.getTime();
        }
        date.setSeconds(date.getSeconds() + 30); // 30 second steps during pass
      } else if (ongoingPass) {
        // End of pass
        pass.end = date.getTime();
        pass.duration = pass.end - pass.start;
        passes.push(pass);
        if (passes.length >= maxPasses) {
          break;
        }
        ongoingPass = false;
        lastDistance = Number.MAX_VALUE;
        // Skip ahead to avoid immediate re-entry
        date.setMinutes(date.getMinutes() + Math.max(5, this.orbitalPeriod * 0.1));
      } else {
        // Not in pass, adjust time step based on distance and previous distance
        const deltaDistance = distanceKm - lastDistance;
        lastDistance = distanceKm;

        if (deltaDistance > 0 && distanceKm > halfSwath * 3) {
          // Moving away and far from swath, skip ahead more
          date.setMinutes(date.getMinutes() + Math.max(10, this.orbitalPeriod * 0.2));
        } else if (distanceKm > halfSwath * 2) {
          // Moderately far from swath
          date.setMinutes(date.getMinutes() + 5);
        } else {
          // Getting closer to swath, use smaller time steps
          date.setMinutes(date.getMinutes() + 1);
        }
      }
    }

    return passes;
  }

  /**
   * Compute passes based on distance threshold (for data link simulation)
   * @param {Object} groundStationPosition - Ground station position {latitude, longitude, height}
   * @param {number} distanceKm - Distance threshold in kilometers
   * @param {Date} startDate - Start date for calculation
   * @param {Date} endDate - End date for calculation
   * @param {number} maxPasses - Maximum number of passes to return
   * @returns {Array} Array of pass objects
   */
  computePassesByDistance(groundStationPosition, distanceKm = 800, startDate = dayjs().toDate(), endDate = dayjs(startDate).add(7, "day").toDate(), maxPasses = 50) {
    const groundStation = { ...groundStationPosition };
    groundStation.latitude *= deg2rad;
    groundStation.longitude *= deg2rad;
    groundStation.height /= 1000;

    const date = new Date(startDate);
    const passes = [];
    let pass = false;
    let ongoingPass = false;
    let lastDistance = Number.MAX_VALUE;

    while (date < endDate) {
      const positionGeodetic = this.positionGeodetic(date);
      if (!positionGeodetic) {
        date.setMinutes(date.getMinutes() + 1);
        continue;
      }

      // Calculate 3D distance between satellite and ground station
      const satHeight = positionGeodetic.height / 1000; // Convert to km
      const satLat = positionGeodetic.latitude * deg2rad;
      const satLon = positionGeodetic.longitude * deg2rad;

      // Calculate great circle distance on Earth's surface
      const deltaLat = satLat - groundStation.latitude;
      const deltaLon = satLon - groundStation.longitude;
      const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) + Math.cos(groundStation.latitude) * Math.cos(satLat) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const earthRadius = 6371; // Earth radius in km
      const surfaceDistanceKm = earthRadius * c;

      // Calculate 3D distance (accounting for satellite altitude)
      const heightDiff = satHeight - groundStation.height;
      const distance3D = Math.sqrt(Math.pow(surfaceDistanceKm, 2) + Math.pow(heightDiff, 2));

      const withinRange = distance3D <= distanceKm;

      if (withinRange) {
        if (!ongoingPass) {
          // Start of new pass
          pass = {
            name: this.name,
            start: date.getTime(),
            minDistance: distance3D,
            minDistanceTime: date.getTime(),
            maxDistance: distance3D,
            distanceThreshold: distanceKm,
          };
          ongoingPass = true;
        } else if (distance3D < pass.minDistance) {
          // Update minimum distance (closest approach)
          pass.minDistance = distance3D;
          pass.minDistanceTime = date.getTime();
        } else if (distance3D > pass.maxDistance) {
          pass.maxDistance = distance3D;
        }
        date.setSeconds(date.getSeconds() + 10); // 10 second steps during pass for better precision
      } else if (ongoingPass) {
        // End of pass
        pass.end = date.getTime();
        pass.duration = pass.end - pass.start;
        passes.push(pass);
        if (passes.length >= maxPasses) {
          break;
        }
        ongoingPass = false;
        lastDistance = Number.MAX_VALUE;
        // Skip ahead to avoid immediate re-entry
        date.setMinutes(date.getMinutes() + Math.max(5, this.orbitalPeriod * 0.1));
      } else {
        // Not in pass, adjust time step based on distance
        const deltaDistance = distance3D - lastDistance;
        lastDistance = distance3D;

        if (deltaDistance > 0 && distance3D > distanceKm * 3) {
          // Moving away and far from range, skip ahead more
          date.setMinutes(date.getMinutes() + Math.max(10, this.orbitalPeriod * 0.2));
        } else if (distance3D > distanceKm * 2) {
          // Moderately far from range
          date.setMinutes(date.getMinutes() + 5);
        } else {
          // Getting closer to range, use smaller time steps
          date.setMinutes(date.getMinutes() + 1);
        }
      }
    }

    return passes;
  }
}
