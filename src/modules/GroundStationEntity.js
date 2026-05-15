import {
  BillboardGraphics,
  Color,
  HorizontalOrigin,
  LabelGraphics,
  LabelStyle,
  NearFarScalar,
  VerticalOrigin,
} from "@cesium/engine";
import dayjs from "dayjs";
import icon from "../images/icons/dish.svg?url";
import { CesiumComponentCollection } from "./util/CesiumComponentCollection";
import { DescriptionHelper } from "./util/DescriptionHelper";

export class GroundStationEntity extends CesiumComponentCollection {
  constructor(viewer, sats, position, givenName = "") {
    super(viewer);
    this.sats = sats;
    this.position = position;
    this.givenName = givenName;
    // Use the data link distance threshold from SatelliteManager
    this.coverageRadius = (sats.dataLinkDistanceThreshold || 800) * 1000;

    this.createEntities();
  }

  createEntities() {
    this.createDescription();
    this.createCoverageCircle();
    this.createGroundStation();
    this.createLabel();
  }

  /**
   * Create coverage range circle around ground station
   */
  createCoverageCircle() {
    const circle = {
      semiMajorAxis: this.coverageRadius,
      semiMinorAxis: this.coverageRadius,
      height: 0,
      material: Color.CYAN.withAlpha(0.1),
      outline: true,
      outlineColor: Color.CYAN.withAlpha(0.4),
      outlineWidth: 1,
      fill: true,
      closeTop: true,
      closeBottom: true,
    };
    this.createCesiumEntity("Coverage", "ellipsoid", circle, this.name + " Coverage", null, this.position.cartesian, false);
  }

  createGroundStation() {
    // Enhanced billboard with better visibility
    const billboard = new BillboardGraphics({
      image: icon,
      horizontalOrigin: HorizontalOrigin.CENTER,
      verticalOrigin: VerticalOrigin.BOTTOM,
      scaleByDistance: new NearFarScalar(1e2, 0.4, 1e7, 0.15),
      color: Color.WHITE,
      scale: 1.5,
    });
    this.createCesiumEntity("Groundstation", "billboard", billboard, this.name, this.description, this.position.cartesian, false);
  }

  /**
   * Create always-visible label for ground station name
   */
  createLabel() {
    const label = new LabelGraphics({
      text: this.name,
      font: "16px Microsoft YaHei",
      fillColor: Color.WHITE,
      outlineColor: Color.CYAN,
      outlineWidth: 2,
      style: LabelStyle.FILL_AND_OUTLINE,
      horizontalOrigin: HorizontalOrigin.CENTER,
      verticalOrigin: VerticalOrigin.TOP,
      pixelOffsetScaleByDistance: new NearFarScalar(1e2, 1.5, 1e7, 0.5),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    });
    this.createCesiumEntity("GroundstationLabel", "label", label, this.name + " Label", null, this.position.cartesian, false);
  }

  createDescription() {
    this.description = DescriptionHelper.cachedCallbackProperty((time) => {
      const passes = this.passes(time);
      const content = DescriptionHelper.renderGroundstationDescription(time, this.name, this.position, passes, this.sats.overpassMode);
      return content;
    });
  }

  get hasName() {
    return this.givenName !== "";
  }

  get name() {
    if (this.givenName) {
      return this.givenName;
    }
    return `${this.position.latitude.toFixed(2)}°, ${this.position.longitude.toFixed(2)}°`;
  }

  passes(time, deltaHours = 48) {
    let passes = [];
    // Aggregate passes from all visible satellites
    this.sats.visibleSatellites.forEach((sat) => {
      sat.props.updatePasses(this.viewer.clock.currentTime);
      passes.push(...sat.props.passes);
    });

    // Filter passes based on time
    passes = passes.filter((pass) => dayjs(pass.start).diff(time, "hours") < deltaHours);

    // Filter passes based on groundstation
    passes = passes.filter((pass) => pass.groundStationName === this.name);

    // Sort passes by time
    passes.sort((a, b) => a.start - b.start);
    return passes;
  }
}
