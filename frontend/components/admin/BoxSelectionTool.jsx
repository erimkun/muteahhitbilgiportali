import { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import { useCesiumCtx } from '../../context/CesiumContext';

/*
BoxSelectionTool
- Aktivasyon: activeTool === 'box'
- İlk sol tık ile merkez belirlenir.
- Sonraki sürüklemeler (mouse move + left down) genişlik/derinlik ayarlar.
- NOT: Mouse wheel artık yükseklik değiştirmez (istek üzerine devre dışı). Yükseklik yalnızca UI kontrolleri / nudge ile ayarlanır.
- ToolBox üzerinden boyut ve pozisyon butonları ile ayarlanabilir (context'teki boxTool güncellenir).
- Seç butonu çağrıldığında selection objesine footprint poligonu + hacim meta ekler.
*/
export default function BoxSelectionTool() {
  const { viewer, activeTool, boxTool, setBoxTool, setSelection } = useCesiumCtx();
  const handlerRef = useRef(null);
  // dragging disabled (left click should not resize after placement)
  const draggingRef = useRef(false);
  const edgeEntitiesRef = useRef([]); // store polylines for edges

  useEffect(() => {
    if (!viewer) return;
    if (activeTool !== 'box') { cleanup(); return; }
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handlerRef.current = handler;

    handler.setInputAction((movement) => {
      // Single left click sets center only (no drag resize)
      if (boxTool.center) return; // ignore further clicks
      const cart = pickPosition(movement.position);
      if (!cart) return;
      setBoxTool(b => ({ ...b, center: cart }));
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  // Removed mouse wheel height adjustment per request: scrolling should not modify box dimensions.
  // handler.setInputAction((wheel) => {
  //   if (!boxTool.center) return;
  //   const delta = wheel.distance > 0 ? 1 : -1;
  //   setBoxTool(b => ({ ...b, height: Math.max(0.5, b.height + delta) }));
  // }, Cesium.ScreenSpaceEventType.WHEEL);

    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer, activeTool, boxTool.center]);

  // Draw / update entity whenever boxTool changes
  useEffect(() => {
    if (!viewer) return;
    if (!boxTool.center) { removeEntity(); removeEdges(); return; }
    const corners = footprintCorners(boxTool);
    if (boxTool.entity) {
      boxTool.entity.polygon.hierarchy = corners;
    } else {
      const entity = viewer.entities.add({
        polygon: { hierarchy: corners, material: Cesium.Color.ORANGE.withAlpha(0.25) },
        label: { text: 'BOX', font: '14px sans-serif', fillColor: Cesium.Color.ORANGE, pixelOffset: new Cesium.Cartesian2(0,-20), disableDepthTestDistance: Number.POSITIVE_INFINITY },
      });
      setBoxTool(b => ({ ...b, entity }));
    }
    updateEdges(boxTool);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer, boxTool.center, boxTool.width, boxTool.depth, boxTool.height]);

  function footprintCorners(box) {
    const { center, width, depth, rotationDeg = 0 } = box;
    const halfX = width / 2; const halfY = depth / 2;
    const carto = Cesium.Cartographic.fromCartesian(center);
    const base = Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, carto.height);
    const enu = Cesium.Transforms.eastNorthUpToFixedFrame(base);
    const theta = Cesium.Math.toRadians(rotationDeg);
    const cosT = Math.cos(theta), sinT = Math.sin(theta);
    const raw = [
      [-halfX, -halfY],
      [ halfX, -halfY],
      [ halfX,  halfY],
      [-halfX,  halfY],
    ];
    const locals = raw.map(([x,y]) => new Cesium.Cartesian3(x * cosT - y * sinT, x * sinT + y * cosT, 0));
    return locals.map(l => Cesium.Matrix4.multiplyByPoint(enu, l, new Cesium.Cartesian3()));
  }

  function box3DCorners(box) {
    const { center, width, depth, height, rotationDeg = 0 } = box;
    const halfX = width / 2; const halfY = depth / 2; const h = height;
    const carto = Cesium.Cartographic.fromCartesian(center);
    const base = Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, carto.height);
    const enu = Cesium.Transforms.eastNorthUpToFixedFrame(base);
    const theta = Cesium.Math.toRadians(rotationDeg);
    const cosT = Math.cos(theta), sinT = Math.sin(theta);
    const rot = (x,y,z) => Cesium.Matrix4.multiplyByPoint(enu, new Cesium.Cartesian3(x * cosT - y * sinT, x * sinT + y * cosT, z), new Cesium.Cartesian3());
    // bottom (z=0)
    const b0 = rot(-halfX, -halfY, 0);
    const b1 = rot( halfX, -halfY, 0);
    const b2 = rot( halfX,  halfY, 0);
    const b3 = rot(-halfX,  halfY, 0);
    // top (z=height)
    const t0 = rot(-halfX, -halfY, h);
    const t1 = rot( halfX, -halfY, h);
    const t2 = rot( halfX,  halfY, h);
    const t3 = rot(-halfX,  halfY, h);
    return { b0,b1,b2,b3,t0,t1,t2,t3 };
  }

  function updateEdges(box) {
    removeEdges();
    if (!viewer || !box.center) return;
    const { b0,b1,b2,b3,t0,t1,t2,t3 } = box3DCorners(box);
    const lines = [
      [b0,b1,b2,b3,b0], // bottom perimeter
      [t0,t1,t2,t3,t0], // top perimeter
      [b0,t0], [b1,t1], [b2,t2], [b3,t3] // verticals
    ];
    edgeEntitiesRef.current = lines.map(posArr => viewer.entities.add({
      polyline: { positions: posArr, width: 2, material: Cesium.Color.RED }
    }));
  }

  function removeEdges() {
    if (!viewer || !edgeEntitiesRef.current.length) return;
  edgeEntitiesRef.current.forEach(e => { try { viewer.entities.remove(e); } catch { /* ignore */ } });
    edgeEntitiesRef.current = [];
  }

  // resizeFromPoint removed (drag sizing disabled)

  function pickPosition(windowPos) {
    const scene = viewer.scene;
    let cartesian = scene.pickPosition(windowPos);
    if (!cartesian) {
      const ray = viewer.camera.getPickRay(windowPos);
      if (ray) cartesian = scene.globe.pick(ray, scene) || null;
    }
    return cartesian || null;
  }

  function removeEntity() {
    if (boxTool.entity && viewer && !viewer.isDestroyed()) {
      viewer.entities.remove(boxTool.entity);
      setBoxTool(b => ({ ...b, entity: null }));
    }
  }

  function cleanup() {
    removeEntity();
  removeEdges();
    if (handlerRef.current) { handlerRef.current.destroy(); handlerRef.current = null; }
    draggingRef.current = false;
  }

  // Expose a global event for selection finalize (Toolbox button will dispatch 'box-select-finalize')
  useEffect(() => {
    const finalize = () => {
      if (!boxTool.center) return;
      const corners = footprintCorners(boxTool);
      const areaM2 = boxTool.width * boxTool.depth;
      const centroid = corners.reduce((acc,p)=>Cesium.Cartesian3.add(acc,p,acc), new Cesium.Cartesian3(0,0,0));
      Cesium.Cartesian3.divideByScalar(centroid, corners.length, centroid);
  setSelection({ id: Date.now(), mode: 'box', positions: corners, areaM2, centroid, box: { center: boxTool.center, width: boxTool.width, depth: boxTool.depth, height: boxTool.height, rotationDeg: boxTool.rotationDeg } });
    };
    window.addEventListener('box-select-finalize', finalize);
    return () => window.removeEventListener('box-select-finalize', finalize);
  }, [boxTool, setSelection]);

  return null;
}
