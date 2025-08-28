import { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import { useCesiumCtx } from '../../context/CesiumContext';

// Helper to compute geodesic distance between two Cartesians (meters)
function distanceBetween(a, b) {
  const cartoA = Cesium.Cartographic.fromCartesian(a);
  const cartoB = Cesium.Cartographic.fromCartesian(b);
  const geodesic = new Cesium.EllipsoidGeodesic(cartoA, cartoB);
  return geodesic.surfaceDistance; // meters
}

// Compute polygon area on ellipsoid (approx using planar projection for small areas)
function polygonArea(points) {
  if (points.length < 3) return 0;
  // Project to ENU plane around first point
  const origin = points[0];
  const originCarto = Cesium.Cartographic.fromCartesian(origin);
  const enuPoints = points.map(p => {
    const eastNorthUp = Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.Cartesian3.fromRadians(originCarto.longitude, originCarto.latitude, originCarto.height));
    const inv = Cesium.Matrix4.inverseTransformation(eastNorthUp, new Cesium.Matrix4());
    const local = Cesium.Matrix4.multiplyByPoint(inv, p, new Cesium.Cartesian3());
    return { x: local.x, y: local.y };
  });
  let area = 0;
  for (let i=0;i<enuPoints.length;i++) {
    const j = (i+1)%enuPoints.length;
    area += enuPoints[i].x * enuPoints[j].y - enuPoints[j].x * enuPoints[i].y;
  }
  return Math.abs(area/2); // square meters
}

export default function MeasureTool() {
  const { viewer, activeTool, measurement, setMeasurement } = useCesiumCtx();
  const handlerRef = useRef(null);
  const drawRefs = useRef({ polyline: null, pointEntities: [], segmentLabels: [] });
  const pointsRef = useRef([]); // authoritative list of points
  const segmentsRef = useRef([]); // distances per segment

  useEffect(() => {
    if (!viewer) return;

    // Activate only when tool is selected
    if (activeTool !== 'measure') {
      cleanup();
      return;
    }

  // Reset refs when activating tool
  pointsRef.current = measurement.points.length ? [...measurement.points] : [];
  segmentsRef.current = measurement.segments?.length ? [...measurement.segments] : [];

  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handlerRef.current = handler;

    handler.setInputAction((movement) => {
      const earthPos = viewer.scene.pickPosition(movement.position);
      if (!Cesium.defined(earthPos)) return;

      // Append new point
      pointsRef.current.push(earthPos);
      // Compute only last segment incrementally
      if (pointsRef.current.length > 1) {
        const seg = distanceBetween(pointsRef.current[pointsRef.current.length-2], pointsRef.current[pointsRef.current.length-1]);
        segmentsRef.current.push(seg);
      }
      const total = segmentsRef.current.reduce((a,b)=>a+b,0);
      const area = pointsRef.current.length > 2 ? polygonArea(pointsRef.current) : 0;
      const lastSegment = segmentsRef.current[segmentsRef.current.length-1] || 0;
      setMeasurement({ points: [...pointsRef.current], totalDistance: total, lastSegment, segments: [...segmentsRef.current], area });
      draw(pointsRef.current, segmentsRef.current);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // Right click resets
    handler.setInputAction(() => {
  pointsRef.current = [];
  segmentsRef.current = [];
  setMeasurement({ points: [], totalDistance: 0, lastSegment: 0, segments: [], area: 0 });
  clearDrawn();
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer, activeTool]);

  function draw(points, segments) {
    clearDrawn();
    if (!viewer) return;
    // polyline
    drawRefs.current.polyline = viewer.entities.add({
      polyline: { positions: points, width: 2, material: Cesium.Color.CYAN.withAlpha(0.9), clampToGround: true }
    });
    // point markers
    const palette = [
      Cesium.Color.LIME,
      Cesium.Color.YELLOW,
      Cesium.Color.ORANGE,
      Cesium.Color.RED,
      Cesium.Color.CYAN,
      Cesium.Color.MAGENTA,
      Cesium.Color.SPRINGGREEN,
      Cesium.Color.DEEPSKYBLUE
    ];
    drawRefs.current.pointEntities = points.map((p, idx) => {
      const last = idx === points.length - 1;
      const color = last ? Cesium.Color.RED : palette[idx % palette.length];
      return viewer.entities.add({
        position: p,
        point: { pixelSize: last ? 12 : 8, color, outlineColor: Cesium.Color.BLACK, outlineWidth: 1.5, disableDepthTestDistance: Number.POSITIVE_INFINITY },
        label: {
          text: `P${idx + 1}`,
          font: '12px sans-serif',
          pixelOffset: new Cesium.Cartesian2(0, -18),
          fillColor: Cesium.Color.WHITE,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      });
    });
    // segment distance labels (midpoint between two points)
    drawRefs.current.segmentLabels = segments.map((dist, i) => {
      const a = points[i];
      const b = points[i+1];
      const mid = Cesium.Cartesian3.midpoint(a, b, new Cesium.Cartesian3());
      return viewer.entities.add({
        position: mid,
        label: { text: `${dist.toFixed(2)} m`, font: '11px monospace', pixelOffset: new Cesium.Cartesian2(0, -10), fillColor: Cesium.Color.CYAN, outlineColor: Cesium.Color.BLACK, style: Cesium.LabelStyle.FILL_AND_OUTLINE, outlineWidth: 2, disableDepthTestDistance: Number.POSITIVE_INFINITY }
      });
    });
  }

  function clearDrawn() {
    if (!viewer || viewer.isDestroyed()) return;
    const { polyline, pointEntities, segmentLabels } = drawRefs.current;
    if (polyline) viewer.entities.remove(polyline);
    pointEntities.forEach(e => viewer.entities.remove(e));
    segmentLabels.forEach(e => viewer.entities.remove(e));
    drawRefs.current = { polyline: null, pointEntities: [], segmentLabels: [] };
  }

  function cleanup() {
    clearDrawn();
    if (handlerRef.current) { handlerRef.current.destroy(); handlerRef.current = null; }
  }

  return null; // no UI, drawing directly on scene
}
