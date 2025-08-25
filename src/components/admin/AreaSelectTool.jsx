import { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import { useCesiumCtx } from '../../context/CesiumContext';

/*
Area Selection Tool (MVP)
- Left click adds vertices.
- Moving mouse shows a dynamic closing edge.
- Double click finishes polygon.
- Right click cancels & clears.
Stores: selection = { positions: Cartesian3[], areaM2, centroid: Cartesian3 }
*/

function computeCentroid(points) {
  if (!points.length) return null;
  const scratch = new Cesium.Cartesian3();
  const sum = points.reduce((acc,p)=> { Cesium.Cartesian3.add(acc,p,acc); return acc; }, new Cesium.Cartesian3(0,0,0));
  return Cesium.Cartesian3.divideByScalar(sum, points.length, scratch);
}

function planarAreaApprox(points) {
  if (points.length < 3) return 0;
  const originCarto = Cesium.Cartographic.fromCartesian(points[0]);
  const enuFrame = Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.Cartesian3.fromRadians(originCarto.longitude, originCarto.latitude, originCarto.height));
  const inv = Cesium.Matrix4.inverseTransformation(enuFrame, new Cesium.Matrix4());
  const flat = points.map(p => {
    const local = Cesium.Matrix4.multiplyByPoint(inv, p, new Cesium.Cartesian3());
    return { x: local.x, y: local.y };
  });
  let area = 0;
  for (let i=0;i<flat.length;i++) {
    const j = (i+1)%flat.length;
    area += flat[i].x * flat[j].y - flat[j].x * flat[i].y;
  }
  return Math.abs(area/2);
}

export default function AreaSelectTool() {
  const { viewer, tileset, activeTool, setSelection, areaMode } = useCesiumCtx();
  const handlerRef = useRef(null);
  const stateRef = useRef({ points: [], tempPoint: null, polygonEntity: null, outlineEntity: null, pointEntities: [], dragging: false, dragStartCartesian: null, basePlane: null, box: null, boxEntity: null });

  useEffect(() => {
    if (!viewer) return;
    if (activeTool !== 'area') { cleanup(); return; }

    activate();
    // listener for imported area from markdown
    const imported = (e) => {
      const { positions, centroid, areaM2 } = e.detail || {};
      if (!positions?.length) return;
      const sel = { id: Date.now(), positions, centroid, areaM2, imported: true };
      setSelection(sel);
      logSelection(sel);
    };
    window.addEventListener('area-imported', imported);
    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer, activeTool]);

  function activate() {
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handlerRef.current = handler;
  // prevent default context menu so right-click works reliably
  const canvas = viewer.scene.canvas;
  const contextMenuBlock = (e) => e.preventDefault();
  canvas.addEventListener('contextmenu', contextMenuBlock);

    if (areaMode === 'polygon') {
      handler.setInputAction((movement) => {
        const pos = pickPosition(movement.position);
        if (!pos) return;
        stateRef.current.points.push(pos);
        redraw();
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    } else if (areaMode === 'rectangle') {
      // rectangle mode: mousedown start, mousemove dynamic rectangle, mouseup finish
      handler.setInputAction((movement) => {
        const pos = pickPosition(movement.position);
        if (!pos) return;
        stateRef.current.dragging = true;
        stateRef.current.dragStartCartesian = pos;
        stateRef.current.points = [pos];
      }, Cesium.ScreenSpaceEventType.LEFT_DOWN);
      handler.setInputAction((movement) => {
        if (!stateRef.current.dragging) return;
        const pos = pickPosition(movement.endPosition);
        stateRef.current.tempPoint = pos || null;
        redraw();
      }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
      handler.setInputAction(() => {
        if (!stateRef.current.dragging) return;
        stateRef.current.dragging = false;
        finishRectangle();
      }, Cesium.ScreenSpaceEventType.LEFT_UP);
    } else if (areaMode === 'box') {
      // (Legacy inline box mode removed; dedicated BoxSelectionTool now handles box interactions.)
    }

    if (areaMode === 'polygon') {
      handler.setInputAction((movement) => {
        // mouse move preview
        if (stateRef.current.points.length === 0) return;
        const pos = pickPosition(movement.endPosition);
        stateRef.current.tempPoint = pos || null;
        redraw();
      }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    }

  if (areaMode === 'polygon') handler.setInputAction(() => finishPolygon(), Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
  // Right click still resets (legacy), CTRL+Right also resets explicitly
  handler.setInputAction(() => { reset(); }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
  handler.setInputAction(() => { reset(); }, Cesium.ScreenSpaceEventType.RIGHT_CLICK, Cesium.KeyboardEventModifier.CTRL);

  // External reset event (from toolbox button)
  window.addEventListener('area-selection-reset', reset);

  // store for cleanup
  stateRef.current._contextCleanup = () => canvas.removeEventListener('contextmenu', contextMenuBlock);
  }

  function pickPosition(windowPos) {
    if (!viewer) return null;
    const scene = viewer.scene;
    let cartesian = scene.pickPosition(windowPos);
    if (!cartesian) {
      const ray = viewer.camera.getPickRay(windowPos);
      if (ray) cartesian = scene.globe.pick(ray, scene) || null;
      // Fallback: if still nothing and we already have a first point, project onto a local horizontal plane through first point
      if (!cartesian && stateRef.current.points.length > 0 && ray) {
        const origin = stateRef.current.points[0];
        if (!stateRef.current.basePlane) {
          // Geodetic surface normal for a stable horizontal plane
            const carto = Cesium.Cartographic.fromCartesian(origin);
            const normal = Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, carto.height), new Cesium.Cartesian3());
          stateRef.current.basePlane = Cesium.Plane.fromPointNormal(origin, normal);
        }
        const t = Cesium.IntersectionTests.rayPlane(ray, stateRef.current.basePlane);
        if (Cesium.defined(t) && t > 0) {
          cartesian = Cesium.Ray.getPoint(ray, t);
        }
      }
    }
    return cartesian || null;
  }

  function redraw() {
    if (!viewer) return;
  const { points, tempPoint } = stateRef.current; // box (legacy) removed

  let all = tempPoint ? [...points, tempPoint] : points;
    if (areaMode === 'rectangle' && points.length === 1 && tempPoint) {
      // Build rectangle corners from drag start + current temp in local ENU plane
      const rect = buildRectangle(points[0], tempPoint);
      all = rect;
    }
  // legacy inline box mode removed

    // Remove existing entities
    removeEntities();

    // Draw outline polyline (dynamic)
    if (all.length > 1) {
      stateRef.current.outlineEntity = viewer.entities.add({
        polyline: { positions: all, width: 2, material: Cesium.Color.YELLOW }
      });
    }

    // Draw point markers
  stateRef.current.pointEntities = all.map((p, idx) => viewer.entities.add({
      position: p,
      point: { pixelSize: idx === points.length-1 ? 10 : 8, color: Cesium.Color.YELLOW, outlineColor: Cesium.Color.BLACK, outlineWidth: 1, disableDepthTestDistance: Number.POSITIVE_INFINITY },
      label: { text: `V${idx+1}`, font: '12px sans-serif', fillColor: Cesium.Color.WHITE, pixelOffset: new Cesium.Cartesian2(0,-18), outlineWidth:2, style: Cesium.LabelStyle.FILL_AND_OUTLINE, disableDepthTestDistance: Number.POSITIVE_INFINITY }
    }));
  }
  // legacy inline box helpers removed

  function finishPolygon() {
    const { points } = stateRef.current;
    if (points.length < 3) return; // need at least triangle
    // Clear temp preview
    stateRef.current.tempPoint = null;
    // Remove dynamic entities
    removeEntities();
    // Create filled polygon
    stateRef.current.polygonEntity = viewer.entities.add({
      polygon: {
        hierarchy: points,
        material: Cesium.Color.YELLOW.withAlpha(0.25),
        // outline disabled to avoid terrain outline warnings
      }
    });
    // Mark selection in context
    const areaM2 = planarAreaApprox(points);
    const centroid = computeCentroid(points);
    const selectionObj = { id: Date.now(), positions: [...points], areaM2, centroid };
    setSelection(selectionObj);
    logSelection(selectionObj);
  }

  function finishRectangle() {
    const { points, tempPoint, dragStartCartesian } = stateRef.current;
    if (points.length !== 1 || !dragStartCartesian || !tempPoint) { reset(); return; }
    const rectCorners = buildRectangle(dragStartCartesian, tempPoint, true); // closed polygon
    removeEntities();
    stateRef.current.polygonEntity = viewer.entities.add({
      polygon: { hierarchy: rectCorners, material: Cesium.Color.YELLOW.withAlpha(0.25) }
    });
    const areaM2 = planarAreaApprox(rectCorners);
    const centroid = computeCentroid(rectCorners);
    const metrics = rectangleMetrics(rectCorners);
    const selectionObj = { id: Date.now(), positions: rectCorners, areaM2, centroid, metrics, mode: 'rectangle' };
    setSelection(selectionObj);
    logSelection(selectionObj);
  }

  function buildRectangle(a, b, close=false) {
    // Project both points to cartographic, build axis-aligned rectangle in lon/lat space
    const cartoA = Cesium.Cartographic.fromCartesian(a);
    const cartoB = Cesium.Cartographic.fromCartesian(b);
    const minLon = Math.min(cartoA.longitude, cartoB.longitude);
    const maxLon = Math.max(cartoA.longitude, cartoB.longitude);
    const minLat = Math.min(cartoA.latitude, cartoB.latitude);
    const maxLat = Math.max(cartoA.latitude, cartoB.latitude);
    const h = (cartoA.height + cartoB.height) / 2;
    const corners = [
      Cesium.Cartesian3.fromRadians(minLon, minLat, h),
      Cesium.Cartesian3.fromRadians(maxLon, minLat, h),
      Cesium.Cartesian3.fromRadians(maxLon, maxLat, h),
      Cesium.Cartesian3.fromRadians(minLon, maxLat, h)
    ];
    return close ? corners : corners; // polygon drawing logic expects open list; we don't duplicate first point
  }

  function rectangleMetrics(corners) {
    if (!corners || corners.length !== 4) return null;
    const c = corners;
    const width = Cesium.Cartesian3.distance(c[0], c[1]);
    const height = Cesium.Cartesian3.distance(c[1], c[2]);
    const diag = Cesium.Cartesian3.distance(c[0], c[2]);
    // 2D ENU metrics at corner 0
    const originCarto = Cesium.Cartographic.fromCartesian(c[0]);
    const enu = Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.Cartesian3.fromRadians(originCarto.longitude, originCarto.latitude, originCarto.height));
    const inv = Cesium.Matrix4.inverseTransformation(enu, new Cesium.Matrix4());
    const local = corners.map(p => Cesium.Matrix4.multiplyByPoint(inv, p, new Cesium.Cartesian3()));
    const width2D = Math.hypot(local[1].x - local[0].x, local[1].y - local[0].y);
    const height2D = Math.hypot(local[2].x - local[1].x, local[2].y - local[1].y);
    const diagonal2D = Math.hypot(local[2].x - local[0].x, local[2].y - local[0].y);
    return { width3D: width, height3D: height, diagonal3D: diag, width2D, height2D, diagonal2D };
  }

  // Pretty-print selection coordinates in multiple reference frames
  function logSelection(sel) {
    if (!sel || !sel.positions?.length) return;
    const { positions, areaM2, centroid } = sel;
    const toDeg = Cesium.Math.toDegrees;
    const modelMatrix = (tileset?.root && tileset.root.transform && !Cesium.Matrix4.equals(tileset.root.transform, Cesium.Matrix4.IDENTITY))
      ? tileset.root.transform
      : (tileset?.modelMatrix || Cesium.Matrix4.IDENTITY);
    let invModel;
    try { invModel = Cesium.Matrix4.inverseTransformation(modelMatrix, new Cesium.Matrix4()); } catch { invModel = Cesium.Matrix4.IDENTITY; }

    const vertices = positions.map((p, i) => {
      const carto = Cesium.Cartographic.fromCartesian(p);
      const local = Cesium.Matrix4.multiplyByPoint(invModel, p, new Cesium.Cartesian3());
      return {
        index: i,
        cartesian: { x: +p.x.toFixed(3), y: +p.y.toFixed(3), z: +p.z.toFixed(3) },
        cartographic: { lonDeg: +toDeg(carto.longitude).toFixed(8), latDeg: +toDeg(carto.latitude).toFixed(8), height: +carto.height.toFixed(3) },
        tilesetLocal: { x: +local.x.toFixed(3), y: +local.y.toFixed(3), z: +local.z.toFixed(3) }
      };
    });

    const centroidCarto = Cesium.Cartographic.fromCartesian(centroid);
    const centroidLocal = Cesium.Matrix4.multiplyByPoint(invModel, centroid, new Cesium.Cartesian3());

    const report = {
      type: 'AreaSelection',
      timestamp: new Date().toISOString(),
      vertexCount: vertices.length,
      area_m2: +areaM2.toFixed(3),
      centroid: {
        cartesian: { x: +centroid.x.toFixed(3), y: +centroid.y.toFixed(3), z: +centroid.z.toFixed(3) },
        cartographic: {
          lonDeg: +toDeg(centroidCarto.longitude).toFixed(8),
          latDeg: +toDeg(centroidCarto.latitude).toFixed(8),
          height: +centroidCarto.height.toFixed(3)
        },
        tilesetLocal: { x: +centroidLocal.x.toFixed(3), y: +centroidLocal.y.toFixed(3), z: +centroidLocal.z.toFixed(3) }
      },
      vertices,
      tilesetInfo: tileset ? {
        url: tileset.url || undefined,
        ready: !!tileset.ready,
        rootTransformNonIdentity: modelMatrix !== Cesium.Matrix4.IDENTITY
      } : null
    };

  // Generate helper code snippets for Cesium.ClippingPolygon usage
  const cartesianSnippet = `const clipPoly = new Cesium.ClippingPolygon({\n  positions: [\n${vertices.map(v => `    new Cesium.Cartesian3(${v.cartesian.x}, ${v.cartesian.y}, ${v.cartesian.z}),`).join('\n')}\n  ]\n});`;
  const degreesFlat = vertices.map(v => `${v.cartographic.lonDeg}, ${v.cartographic.latDeg}`).join(', ');
  const degreesSnippet = `// Lon/Lat (degrees) array (height optional if needed with fromDegreesArrayHeights)\nconst degPositions = Cesium.Cartesian3.fromDegreesArray([ ${degreesFlat} ]);\nconst clipPolyFromDeg = new Cesium.ClippingPolygon({ positions: degPositions });`;
  report.clippingPolygon = { cartesianSnippet, degreesSnippet };

    try {
      // Collapsed group for cleanliness
      console.groupCollapsed(`🟡 Area Selection (${vertices.length} verts, ${(areaM2).toFixed(2)} m²)`);
      console.table(vertices.map(v => ({
        i: v.index,
        lon: v.cartographic.lonDeg,
        lat: v.cartographic.latDeg,
        h: v.cartographic.height,
        X: v.cartesian.x,
        Y: v.cartesian.y,
        Z: v.cartesian.z,
        localX: v.tilesetLocal.x,
        localY: v.tilesetLocal.y,
        localZ: v.tilesetLocal.z
      })));
      console.log('Centroid:', report.centroid);
      console.log('Area m²:', report.area_m2);
      if (report.tilesetInfo) console.log('Tileset:', report.tilesetInfo);
      console.log('JSON (copy):', JSON.stringify(report, null, 2));
  console.log('ClippingPolygon (Cartesian) snippet:\n' + cartesianSnippet);
  console.log('ClippingPolygon (Degrees) snippet:\n' + degreesSnippet);
      console.groupEnd();
    } catch (e) {
      console.error('[AreaSelect] Failed to log selection', e, report);
    }
  }

  function reset() {
    setSelection(null);
    removeEntities(true); // remove BEFORE wiping refs
  stateRef.current = { points: [], tempPoint: null, polygonEntity: null, outlineEntity: null, pointEntities: [], dragging: false, dragStartCartesian: null, basePlane: null, box: null, boxEntity: null, _contextCleanup: stateRef.current._contextCleanup };
  }

  function removeEntities(includePolygon=false) {
    if (!viewer || viewer.isDestroyed()) return;
    const { outlineEntity, pointEntities, polygonEntity } = stateRef.current;
    if (outlineEntity) viewer.entities.remove(outlineEntity);
    pointEntities.forEach(e => viewer.entities.remove(e));
    if (includePolygon && polygonEntity) viewer.entities.remove(polygonEntity);
    stateRef.current.outlineEntity = null;
    stateRef.current.pointEntities = [];
    if (includePolygon) stateRef.current.polygonEntity = null;
  }

  function cleanup() {
    removeEntities(true);
    if (handlerRef.current) { handlerRef.current.destroy(); handlerRef.current = null; }
  if (stateRef.current._contextCleanup) stateRef.current._contextCleanup();
  stateRef.current = { points: [], tempPoint: null, polygonEntity: null, outlineEntity: null, pointEntities: [], dragging: false, dragStartCartesian: null, basePlane: null, box: null, boxEntity: null };
  window.removeEventListener('area-selection-reset', reset);
  window.removeEventListener('area-imported', () => {});
  }

  return null;
}
