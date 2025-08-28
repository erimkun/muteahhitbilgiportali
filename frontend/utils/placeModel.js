import * as Cesium from 'cesium';

/**
 * Load a glTF model with georeferenced placement and optional heading + local vertical adjust.
 * @param {Cesium.Viewer} viewer
 * @param {Object} opts
 * @param {string} opts.url - Relative URL (from public root) to glTF.
 * @param {number} opts.lon - Longitude in degrees (WGS84).
 * @param {number} opts.lat - Latitude in degrees.
 * @param {number} opts.height - Height in meters (ellipsoidal or terrain-sample).
 * @param {number} [opts.headingDeg=0]
 * @param {number} [opts.pitchDeg=0]
 * @param {number} [opts.rollDeg=0]
 * @param {number} [opts.verticalAdjust=0] - Additional meters to raise/lower.
 * @param {number} [opts.modelBaseOffset=0] - Local ENU Z translation to align model origin to base.
 * @param {number} [opts.scale=1]
 * @returns {Cesium.Model}
 */
export function loadGeoreferencedModel(viewer, opts){
  const {
    url,
    lon,lat,height,
    headingDeg=0,pitchDeg=0,rollDeg=0,
    verticalAdjust=0,
    modelBaseOffset=0,
    scale=1
  } = opts;
  if(!viewer) throw new Error('Viewer required');
  const position = Cesium.Cartesian3.fromDegrees(lon, lat, height + verticalAdjust);
  let matrix = Cesium.Transforms.eastNorthUpToFixedFrame(position);
  if(headingDeg!==0||pitchDeg!==0||rollDeg!==0){
    const hpr = new Cesium.HeadingPitchRoll(
      Cesium.Math.toRadians(headingDeg),
      Cesium.Math.toRadians(pitchDeg),
      Cesium.Math.toRadians(rollDeg)
    );
    const rot = Cesium.Matrix3.fromHeadingPitchRoll(hpr);
    matrix = Cesium.Matrix4.multiplyByMatrix3(matrix, rot, new Cesium.Matrix4());
  }
  if(modelBaseOffset!==0){
    matrix = Cesium.Matrix4.multiplyByTranslation(matrix, new Cesium.Cartesian3(0,0,modelBaseOffset), new Cesium.Matrix4());
  }
  const model = viewer.scene.primitives.add(Cesium.Model.fromGltf({
    url,
    modelMatrix: matrix,
    scale,
    incrementallyLoadTextures: false,
    runAnimations: false,
  }));
  return model;
}

/** Quick centroid of lon/lat array */
export function centroidLonLat(pairs){
  if(!pairs||!pairs.length) return null;
  let sx=0, sy=0; pairs.forEach(([lo,la])=>{ sx+=lo; sy+=la; });
  return { lon: sx/pairs.length, lat: sy/pairs.length };
}
