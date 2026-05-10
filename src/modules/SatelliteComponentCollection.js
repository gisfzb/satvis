import {
  ArcType,
  BoxGraphics,
  CallbackProperty,
  Cartesian2,
  Cartesian3,
  Color,
  ColorGeometryInstanceAttribute,
  CornerType,
  CorridorGraphics,
  DistanceDisplayCondition,
  Entity,
  GeometryInstance,
  HeadingPitchRoll,
  HeightReference,
  HorizontalOrigin,
  JulianDate,
  LabelGraphics,
  LabelStyle,
  Math as CesiumMath,
  Matrix4,
  ModelGraphics,
  NearFarScalar,
  PathGraphics,
  PointGraphics,
  PolylineColorAppearance,
  PolylineGeometry,
  PolylineGlowMaterialProperty,
  PolylineGraphics,
  Primitive,
  SceneMode,
  Transforms,
  VelocityOrientationProperty,
  defined,
} from "@cesium/engine";
import CesiumSensorVolumes from "cesium-sensor-volumes";

import { SatelliteProperties } from "./SatelliteProperties";
import { CesiumComponentCollection } from "./util/CesiumComponentCollection";
import { CesiumTimelineHelper } from "./util/CesiumTimelineHelper";
import { DescriptionHelper } from "./util/DescriptionHelper";
import { CesiumCallbackHelper } from "./util/CesiumCallbackHelper";

export class SatelliteComponentCollection extends CesiumComponentCollection {
  constructor(viewer, tle, tags) {
    super(viewer);
    this.props = new SatelliteProperties(tle, tags);
    this.eventListeners = {};
  }

  enableComponent(name) {
    if (!this.created) {
      this.init();
    }
    if (!this.props.sampledPosition.valid) {
      console.error(`No valid position data available for ${this.props.name}`);
      return;
    }
    if (!(name in this.components)) {
      this.createComponent(name);
      this.updatedSampledPositionForComponents();
    }

    super.enableComponent(name);

    if (name === "3D model") {
      // Adjust label offset to avoid overlap with model
      if (this.components.Label) {
        this.components.Label.label.pixelOffset = new Cartesian2(20, 0);
      }
    } else if (name === "Orbit" && this.components[name] instanceof Primitive) {
      // Update the model matrix periodically to keep the orbit in the inertial frame
      if (!this.orbitPrimitiveUpdater) {
        this.orbitPrimitiveUpdater = CesiumCallbackHelper.createPeriodicTimeCallback(this.viewer, 0.5, (time) => {
          if (!this.components.Orbit) {
            // Remove callback if orbit is disabled
            this.orbitPrimitiveUpdater();
            return;
          }
          const icrfToFixed = Transforms.computeIcrfToFixedMatrix(time);
          if (defined(icrfToFixed)) {
            this.components.Orbit.modelMatrix = Matrix4.fromRotationTranslation(icrfToFixed);
          }
        });
      }
    } else if (name === "Orbit" && this.components[name] instanceof GeometryInstance) {
      // Update the model matrix of the primitive containing all orbit geometries periodically to keep the orbit in the inertial frame
      if (!this.constructor.geometryPrimitiveUpdater) {
        if (!this.components.Orbit) {
          // Remove callback if orbit is disabled
          this.geometryPrimitiveUpdater();
          return;
        }
        this.constructor.geometryPrimitiveUpdater = CesiumCallbackHelper.createPeriodicTimeCallback(this.viewer, 0.5, (time) => {
          const icrfToFixed = Transforms.computeIcrfToFixedMatrix(time);
          if (defined(icrfToFixed) && this.constructor.primitive) {
            this.constructor.primitive.modelMatrix = Matrix4.fromRotationTranslation(icrfToFixed);
          }
        });
      }
    }
  }

  disableComponent(name) {
    if (name === "3D model") {
      // Restore old label offset
      if (this.components.Label) {
        this.components.Label.label.pixelOffset = new Cartesian2(10, 0);
      }
    }
    super.disableComponent(name);

    if (this.componentNames.length === 0) {
      // Remove event listeners when no components are enabled
      this.deinit();
    }
  }

  init() {
    this.createDescription();

    this.eventListeners.sampledPosition = this.props.createSampledPosition(this.viewer, () => {
      this.updatedSampledPositionForComponents(true);
    });

    // Set up event listeners
    this.eventListeners.selectedEntity = this.viewer.selectedEntityChanged.addEventListener((entity) => {
      if (!entity || entity?.name === "Ground station") {
        CesiumTimelineHelper.clearHighlightRanges(this.viewer);
        return;
      }
      if (this.isSelected) {
        this.props.updatePasses(this.viewer.clock.currentTime);
        this.props.updateDataLinkPasses(this.viewer.clock.currentTime);
        CesiumTimelineHelper.updateHighlightRanges(this.viewer, this.props.passes);
      }
    });

    this.eventListeners.trackedEntity = this.viewer.trackedEntityChanged.addEventListener(() => {
      if (this.isTracked) {
        this.artificiallyTrack();
        this.props.updateDataLinkPasses(this.viewer.clock.currentTime);
      }
      if ("Orbit" in this.components && !this.isCorrectOrbitComponent()) {
        // Recreate Orbit to change visualisation type
        this.disableComponent("Orbit");
        this.enableComponent("Orbit");
      }
    });
  }

  deinit() {
    // Remove event listeners
    this.eventListeners.sampledPosition();
    this.eventListeners.selectedEntity();
    this.eventListeners.trackedEntity();
  }

  updatedSampledPositionForComponents(update = false) {
    const { fixed, inertial } = this.props.sampledPosition;

    Object.entries(this.components).forEach(([type, component]) => {
      if (type === "Orbit") {
        component.position = inertial;
        if (update && (component instanceof Primitive || component instanceof GeometryInstance)) {
          // Primitives need to be recreated to update the geometry
          this.disableComponent("Orbit");
          this.enableComponent("Orbit");
        }
      } else if (type === "Sensor cone") {
        component.position = fixed;
        component.orientation = new CallbackProperty((time) => {
          const position = this.props.position(time);
          const hpr = new HeadingPitchRoll(0, CesiumMath.toRadians(180), 0);
          return Transforms.headingPitchRollQuaternion(position, hpr);
        }, false);
      } else {
        component.position = fixed;
        component.orientation = new VelocityOrientationProperty(fixed);
      }
    });
    // Request a single frame after satellite position updates when the clock is paused
    if (!this.viewer.clock.shouldAnimate) {
      const removeCallback = this.viewer.clock.onTick.addEventListener(() => {
        this.viewer.scene.requestRender();
        removeCallback();
      });
    }
  }

  createComponent(name) {
    switch (name) {
      case "Point":
        this.createPoint();
        break;
      case "Label":
        this.createLabel();
        break;
      case "Orbit":
        this.createOrbit();
        break;
      case "Orbit track":
        this.createOrbitTrack();
        break;
      case "Ground track":
        this.createGroundTrack();
        break;
      case "Sensor cone":
        this.createCone();
        break;
      case "3D model":
        this.createModel();
        break;
      case "Ground station link":
        this.createGroundStationLink();
        break;
      case "Data link":
        this.createDataLink();
        break;
      default:
        console.error("Unknown component");
    }
  }

  createDescription() {
    this.description = DescriptionHelper.cachedCallbackProperty((time) => {
      const cartographic = this.props.orbit.positionGeodetic(JulianDate.toDate(time), true);
      const content = DescriptionHelper.renderSatelliteDescription(time, cartographic, this.props);
      return content;
    });
  }

  createCesiumSatelliteEntity(entityName, entityKey, entityValue) {
    this.createCesiumEntity(entityName, entityKey, entityValue, this.props.name, this.description, this.props.sampledPosition.fixed, true);
  }

  createPoint() {
    const point = new PointGraphics({
      pixelSize: 6,
      color: Color.WHITE,
      outlineColor: Color.DIMGREY,
      outlineWidth: 1,
    });
    this.createCesiumSatelliteEntity("Point", "point", point);
  }

  createBox() {
    const size = 1000;
    const box = new BoxGraphics({
      dimensions: new Cartesian3(size, size, size),
      material: Color.WHITE,
    });
    this.createCesiumSatelliteEntity("Box", "box", box);
  }

  createModel() {
    const modelName = this.props.name.split(" ").join("-");
    const modelUri = `./data/models/${modelName}.glb`;
    const defaultBoxSize = 2000;

    // Check if model file exists before creating model entity
    fetch(modelUri, { method: "HEAD" })
      .then((response) => {
        if (response.ok) {
          // Model exists, use it
          const modelGraphics = new ModelGraphics({
            uri: modelUri,
            minimumPixelSize: 30,
            maximumScale: 5000,
            incrementally: true,
          });
          this.updateComponentGraphics("3D model", "model", modelGraphics);
        } else {
          // Model doesn't exist, use box fallback
          this.createModelFallback();
        }
      })
      .catch(() => {
        // Network error or model not found, use box fallback
        this.createModelFallback();
      });
  }

  createModelFallback() {
    // Create a simple box as a placeholder for the satellite
    const box = new BoxGraphics({
      dimensions: new Cartesian3(2000, 2000, 2000),
      material: Color.LIGHTGREY.withAlpha(0.8),
      fill: true,
      outline: true,
      outlineColor: Color.WHITE,
    });
    this.createCesiumSatelliteEntity("3D model", "box", box);
  }

  updateComponentGraphics(componentName, key, value) {
    const component = this.components[componentName];
    if (component) {
      component[key] = value;
    }
  }

  createLabel() {
    const label = new LabelGraphics({
      text: this.props.name,
      font: "15px Arial",
      style: LabelStyle.FILL_AND_OUTLINE,
      outlineColor: Color.DIMGREY,
      outlineWidth: 2,
      horizontalOrigin: HorizontalOrigin.LEFT,
      pixelOffset: new Cartesian2(10, 0),
      distanceDisplayCondition: new DistanceDisplayCondition(2000, 8e7),
      translucencyByDistance: new NearFarScalar(6e7, 1.0, 8e7, 0.0),
    });
    this.createCesiumSatelliteEntity("Label", "label", label);
  }

  createOrbit() {
    if (this.usePathGraphicForOrbit) {
      this.createOrbitPath();
    } else {
      this.createOrbitPolylineGeometry();
    }
  }

  isCorrectOrbitComponent() {
    return this.usePathGraphicForOrbit ? this.components.Orbit instanceof Entity : this.components.Orbit instanceof Primitive;
  }

  get usePathGraphicForOrbit() {
    const sceneModeSupportsPrimitive = this.viewer.scene.mode === SceneMode.SCENE3D;
    if (this.isTracked || !sceneModeSupportsPrimitive) {
      // Use a path graphic to visualize the currently tracked satellite's orbit or when the scene mode doesn't support primitive modelmatrix updates
      return true;
    }
    // For all other satellites use a polyline geometry to visualize the orbit for significantly improved performance.
    // A polyline geometry is used instead of a polyline graphic as entities don't support adjusting the model matrix
    // in order to display the orbit in the inertial frame.
    return false;
  }

  createOrbitPath() {
    const path = new PathGraphics({
      leadTime: (this.props.orbit.orbitalPeriod * 60) / 2 + 5,
      trailTime: (this.props.orbit.orbitalPeriod * 60) / 2 + 5,
      material: Color.WHITE.withAlpha(0.15),
      resolution: 600,
      width: 2,
    });
    this.createCesiumEntity("Orbit", "path", path, this.props.name, this.description, this.props.sampledPosition.inertial, true);
  }

  createOrbitPolylinePrimitive() {
    // Create two separate polylines for past and future orbit
    // Past orbit (trail): Red color
    // Future orbit (lead): Blue color
    const trailColor = new Color(1.0, 0.3, 0.3, 0.5); // Red for past
    const leadColor = new Color(0.3, 0.6, 1.0, 0.5); // Blue for future

    const currentTime = this.viewer.clock.currentTime;
    const halfOrbitTime = (this.props.orbit.orbitalPeriod * 60) / 2;

    // Get sampled positions for the entire orbit period
    const allPositions = this.props.getSampledPositionsForOrbitPeriod(currentTime);
    if (!allPositions || allPositions.length === 0) {
      return;
    }

    // Find the index of current time position
    const currentIndex = this.findCurrentTimeIndex(allPositions, currentTime);

    // Split positions into past (trail) and future (lead) segments
    const trailPositions = allPositions.slice(0, currentIndex + 1);
    const leadPositions = allPositions.slice(currentIndex);

    // Create primitive with both trail and lead polylines
    const geometryInstances = [];

    if (trailPositions.length > 1) {
      geometryInstances.push(
        new GeometryInstance({
          geometry: new PolylineGeometry({
            positions: trailPositions,
            width: 2,
            arcType: ArcType.NONE,
            vertexFormat: PolylineColorAppearance.VERTEX_FORMAT,
          }),
          attributes: {
            color: ColorGeometryInstanceAttribute.fromColor(trailColor),
          },
          id: `${this.props.name}-trail`,
        })
      );
    }

    if (leadPositions.length > 1) {
      geometryInstances.push(
        new GeometryInstance({
          geometry: new PolylineGeometry({
            positions: leadPositions,
            width: 2,
            arcType: ArcType.NONE,
            vertexFormat: PolylineColorAppearance.VERTEX_FORMAT,
          }),
          attributes: {
            color: ColorGeometryInstanceAttribute.fromColor(leadColor),
          },
          id: `${this.props.name}-lead`,
        })
      );
    }

    const primitive = new Primitive({
      geometryInstances,
      appearance: new PolylineColorAppearance(),
      asynchronous: false,
    });

    const icrfToFixed = Transforms.computeIcrfToFixedMatrix(currentTime);
    if (defined(icrfToFixed)) {
      primitive.modelMatrix = Matrix4.fromRotationTranslation(icrfToFixed);
    }
    this.components.Orbit = primitive;
  }

  findCurrentTimeIndex(positions, currentTime) {
    // Find the index closest to current time
    // Positions array covers an entire orbit period, find the middle point as reference
    const totalPositions = positions.length;
    // Assume positions are evenly distributed, find approximate current position
    // Since we don't have time stamps in positions, we estimate based on orbital period
    const halfIndex = Math.floor(totalPositions / 2);
    return halfIndex;
  }

  createOrbitPolylineGeometry() {
    // Currently unused
    const geometryInstance = new GeometryInstance({
      geometry: new PolylineGeometry({
        positions: this.props.getSampledPositionsForNextOrbit(this.viewer.clock.currentTime),
        width: 2,
        arcType: ArcType.NONE,
        // granularity: CesiumMath.RADIANS_PER_DEGREE * 10,
        vertexFormat: PolylineColorAppearance.VERTEX_FORMAT,
      }),
      attributes: {
        color: ColorGeometryInstanceAttribute.fromColor(new Color(1.0, 1.0, 1.0, 0.15)),
      },
      id: this.props.name,
    });
    this.components.Orbit = geometryInstance;
  }

  createOrbitTrack(leadTime = this.props.orbit.orbitalPeriod * 60, trailTime = 0) {
    const path = new PathGraphics({
      leadTime,
      trailTime,
      material: Color.GOLD.withAlpha(0.15),
      resolution: 600,
      width: 2,
    });
    this.createCesiumSatelliteEntity("Orbit track", "path", path);
  }

  createGroundTrack() {
    if (this.props.orbit.orbitalPeriod > 60 * 2) {
      // Ground track unavailable for non-LEO satellites
      return;
    }
    const corridor = new CorridorGraphics({
      cornerType: CornerType.MITERED,
      height: 1000,
      heightReference: HeightReference.CLAMP_TO_GROUND,
      material: Color.DARKRED.withAlpha(0.25),
      positions: new CallbackProperty((time) => this.props.groundTrack(time), false),
      width: this.props.swath * 1000,
    });
    this.createCesiumSatelliteEntity("Ground track", "corridor", corridor);
  }

  createCone(fov = 10) {
    if (this.props.orbit.orbitalPeriod > 60 * 2) {
      // Cone graphic unavailable for non-LEO satellites
      return;
    }
    const entity = new Entity();
    entity.addProperty("conicSensor");
    entity.conicSensor = new CesiumSensorVolumes.ConicSensorGraphics({
      radius: 1000000,
      innerHalfAngle: CesiumMath.toRadians(0),
      outerHalfAngle: CesiumMath.toRadians(fov),
      lateralSurfaceMaterial: Color.GOLD.withAlpha(0.15),
      intersectionColor: Color.GOLD.withAlpha(0.3),
      intersectionWidth: 1,
    });
    this.components["Sensor cone"] = entity;
  }

  createGroundStationLink() {
    if (!this.props.groundStationAvailable) {
      return;
    }

    const self = this;

    // Dynamically connect to the ground station with an active pass
    const polyline = new PolylineGraphics({
      followSurface: false,
      material: new PolylineGlowMaterialProperty({
        glowPower: 0.5,
        color: Color.FORESTGREEN,
      }),
      positions: new CallbackProperty((time) => {
        // Find the ground station with an active pass
        const activeGroundStation = self.props.groundStations.find((gs) => {
          const passIntervals = self.props.getPassIntervalsForGroundStation(gs.name);
          return passIntervals && passIntervals.contains(time);
        });
        if (activeGroundStation) {
          const satPosition = self.props.position(time);
          const groundPosition = activeGroundStation.position.cartesian;
          return [satPosition, groundPosition];
        }
        return [];
      }, false),
      show: new CallbackProperty((time) => {
        return self.props.passIntervals.contains(time);
      }, false),
      width: 5,
    });
    this.createCesiumSatelliteEntity("Ground station link", "polyline", polyline);
  }

  /**
   * Create data link visualization for satellite-ground station communication
   * Shows glowing line when satellite is within data link range of ANY ground station
   * Automatically connects to the closest ground station in range
   */
  createDataLink() {
    if (!this.props.groundStationAvailable) {
      return;
    }

    const self = this;

    // Use a fixed glow material - dynamically find closest ground station in range
    const polyline = new PolylineGraphics({
      followSurface: false,
      material: new PolylineGlowMaterialProperty({
        glowPower: 0.5,
        color: Color.LIME,
      }),
      positions: new CallbackProperty((time) => {
        const closest = self.props.getClosestGroundStationInRange(time);
        if (closest && self.props.dataLinkEnabled) {
          const satPosition = self.props.position(time);
          const groundPosition = closest.groundStation.position.cartesian;
          return [satPosition, groundPosition];
        }
        return [];
      }, false),
      show: new CallbackProperty((time) => {
        if (!self.props.dataLinkEnabled) return false;
        const closest = self.props.getClosestGroundStationInRange(time);
        return closest !== null;
      }, false),
      width: 6,
    });
    this.createCesiumSatelliteEntity("Data link", "polyline", polyline);

    // Update data link passes when selected or tracked
    if (this.isSelected || this.isTracked) {
      this.props.updateDataLinkPasses(this.viewer.clock.currentTime);
    }
  }

  set groundStations(groundStations) {
    // No groundstation calculation for GEO satellites
    if (this.props.orbit.orbitalPeriod > 60 * 12) {
      return;
    }

    this.props.groundStations = groundStations;
    this.props.clearPasses();
    this.props.clearDataLinkPasses();
    if (this.isSelected || this.isTracked) {
      this.props.updatePasses(this.viewer.clock.currentTime);
      this.props.updateDataLinkPasses(this.viewer.clock.currentTime);
      if (this.isSelected) {
        CesiumTimelineHelper.updateHighlightRanges(this.viewer, this.props.passes);
      }
    }
    if (this.created) {
      this.createGroundStationLink();
      if (this.props.dataLinkEnabled) {
        this.createDataLink();
      }
    }
  }
}
