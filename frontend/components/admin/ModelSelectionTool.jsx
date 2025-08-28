import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as Cesium from 'cesium';
import { useCesiumCtx } from '../../context/CesiumContext';

/*
 ModelSelectionTool
 - Kullanıcı modeli üzerinde çokgen vertexleri toplar (left click)
 - Çift tık (veya Enter) ile finalize eder.
 - Right click veya Esc resetler.
 - Yüzeye projeksiyon: scene.pickPosition, yoksa globe.pick.
 - Sonuç: modelSelection = { positions, centroid, areaM2 }
*/
export default function ModelSelectionTool(){
  const { activeTool, viewer, modelSelection, setModelSelection, buildingEntity } = useCesiumCtx();
  const isActive = activeTool === 'modelSelect';
  const [working, setWorking] = useState([]); // temp positions
  const [status, setStatus] = useState('hazır');
  const handlerRef = useRef(null);
  const polyEntityRef = useRef(null);
  const pointEntitiesRef = useRef([]); // vertex point markers

  // Create / update temp polygon entity & vertex points
  useEffect(()=>{
    if(!viewer) return;
    if(!isActive){
      // cleanup
      if(polyEntityRef.current){ viewer.entities.remove(polyEntityRef.current); polyEntityRef.current=null; }
      pointEntitiesRef.current.forEach(e=>viewer.entities.remove(e));
      pointEntitiesRef.current = [];
      return;
    }
    // polygon entity
    if(!polyEntityRef.current){
      polyEntityRef.current = viewer.entities.add({
        polygon: {
          hierarchy: new Cesium.CallbackProperty(()=> working.length>=3 ? new Cesium.PolygonHierarchy(working) : undefined, false),
          material: Cesium.Color.ORANGE.withAlpha(0.3),
          outline: true,
          outlineColor: Cesium.Color.ORANGE
        }
      });
    }
    // sync point markers
    const pts = pointEntitiesRef.current;
    // remove excess
    while(pts.length > working.length){
      const ent = pts.pop();
      viewer.entities.remove(ent);
    }
    // add new points
    for(let i=pts.length;i<working.length;i++){
      const ent = viewer.entities.add({
        position: working[i],
        point: {
          pixelSize: 7,
          color: i === working.length-1 ? Cesium.Color.RED : Cesium.Color.ORANGE,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 1
        },
        label: {
          text: (i+1).toString(),
            font: '12px sans-serif',
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0,-18),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
        }
      });
      pts.push(ent);
    }
    // update last point color highlight
    pts.forEach((ent, idx)=>{
      if(ent.point){
        ent.point.color = (idx === working.length-1) ? Cesium.Color.RED : Cesium.Color.ORANGE;
      }
    });
  },[viewer, isActive, working]);

  function computeAreaInfo(positions){
    if(positions.length < 3) return { centroid:null, areaM2:0 };
    const originCarto = Cesium.Cartographic.fromCartesian(positions[0]);
    const enuFrame = Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.Cartesian3.fromRadians(originCarto.longitude, originCarto.latitude, originCarto.height));
    const inv = Cesium.Matrix4.inverseTransformation(enuFrame, new Cesium.Matrix4());
    const local = positions.map(p=>Cesium.Matrix4.multiplyByPoint(inv, p, new Cesium.Cartesian3()));
    let area=0; let cx=0; let cy=0; // planar
    for(let i=0;i<local.length;i++){
      const a = local[i]; const b = local[(i+1)%local.length];
      const cross = a.x*b.y - b.x*a.y; area += cross; cx += (a.x + b.x)*cross; cy += (a.y + b.y)*cross;
    }
    area = area/2;
    const areaM2 = Math.abs(area);
    let centroid;
    if(Math.abs(area) > 1e-6){
      cx /= (6*area); cy /=(6*area);
      const cenLocal = new Cesium.Cartesian3(cx, cy, local[0].z);
      centroid = Cesium.Matrix4.multiplyByPoint(enuFrame, cenLocal, new Cesium.Cartesian3());
    } else {
      centroid = positions[0];
    }
    return { centroid, areaM2 };
  }

  const finalize = useCallback(()=>{
    if(working.length < 3){ setStatus('>=3 nokta gerekli'); return; }
    const { centroid, areaM2 } = computeAreaInfo(working);
    setModelSelection({ positions:[...working], centroid, areaM2 });
    setStatus('tamamlandı');
  }, [working, setModelSelection]);
  const reset = useCallback(()=>{
    setWorking([]);
    setModelSelection(null);
    setStatus('reset');
  }, [setModelSelection]);

  useEffect(()=>{
    if(!viewer || !isActive) return;
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handlerRef.current = handler;
    handler.setInputAction((movement)=>{
      const pos = movement.position;
      if(!pos || !buildingEntity) return;
      // First: pick to see if model hit
      const picked = viewer.scene.pick(pos);
      let usePoint = null;
      const ray = viewer.camera.getPickRay(pos);
      if(picked && picked.id === buildingEntity){
        // Direct model surface position
        if(viewer.scene.pickPositionSupported){
          usePoint = viewer.scene.pickPosition(pos);
        }
      }
      if(!usePoint){
        // Fallback: try bounding sphere intersection
        // Locate underlying Cesium.Model primitive (approximate by url match if available)
        let modelPrimitive = null;
        try {
          const prims = viewer.scene.primitives;
          for(let i=0;i<prims.length;i++){
            const prim = prims.get(i);
            if(prim && prim.constructor && prim.constructor.name === 'Model'){ // heuristic
              // Optionally check _resource or _url contains 'a1' etc.
              modelPrimitive = prim; break;
            }
          }
        } catch {
          // ignore primitive scan errors
        }
        if(modelPrimitive && ray){
          const sphere = modelPrimitive.boundingSphere;
          if(sphere && sphere.radius > 0){
            const isect = Cesium.IntersectionTests.raySphere(ray, sphere);
            if(isect){
              const near = Cesium.Ray.getPoint(ray, isect.start);
              usePoint = near;
              setStatus('model dışı tık: küre projeksiyonu');
            }
          }
        }
      }
      if(!usePoint){
        setStatus('model değil (yoksay)');
        return; // ignore click
      }
      setWorking(prev=>[...prev, usePoint]);
      setStatus(`${working.length+1} nokta`);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    handler.setInputAction(()=>{ finalize(); }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    handler.setInputAction(()=>{ reset(); }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

    const keyListener = (e)=>{
      if(!isActive) return;
      if(e.key === 'Escape'){ reset(); }
      if(e.key === 'Enter'){ finalize(); }
      if(e.key === 'z' && (e.ctrlKey||e.metaKey)){
        setWorking(w=>w.slice(0,-1));
      }
    };
    window.addEventListener('keydown', keyListener);
    return ()=>{
      handler.destroy();
      window.removeEventListener('keydown', keyListener);
    };
  },[viewer, isActive, working.length, finalize, reset, buildingEntity]);

  const tempArea = working.length>=3 ? computeAreaInfo(working).areaM2 : 0;
  if(!isActive) return null;
  return (
    <div className="mt-2 p-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60">
      <strong className="block mb-1 text-white/70">Model Selection</strong>
      <p className="mb-1">Model yüzeyine sol tıkla; çift tıkla bitir. Sağ tık reset.</p>
      <p className="text-[10px] mb-1">Vertex: {working.length}{modelSelection && working.length===0 && ` (saved ${modelSelection.positions.length})`}</p>
      {working.length>=3 && (
        <p className="text-[10px] text-amber-300 mb-1">Geçici Alan: {tempArea.toFixed(2)} m²</p>
      )}
      <div className="flex gap-1 mb-1">
        <button onClick={finalize} className="flex-1 text-[10px] px-2 py-1 rounded bg-emerald-600/80 hover:bg-emerald-500 text-white">Bitir</button>
        <button onClick={reset} className="flex-1 text-[10px] px-2 py-1 rounded bg-red-600/70 hover:bg-red-500 text-white">Reset</button>
      </div>
      {modelSelection && (
        <p className="text-[10px] text-emerald-300">Alan: {modelSelection.areaM2.toFixed(2)} m²</p>
      )}
      <p className="text-[10px] text-indigo-300">Durum: {status}</p>
    </div>
  );
}
