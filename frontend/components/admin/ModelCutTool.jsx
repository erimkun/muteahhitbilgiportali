import React, { useEffect, useState, useCallback } from 'react';
import * as Cesium from 'cesium';
import { useCesiumCtx } from '../../context/CesiumContext';

/*
 ModelCutTool
 - activeTool === 'modelCut' iken model (buildingEntity) ve tileset'e aynı clipping polygon(lar)ı uygular.
 - Kaynak olarak mevcut selection.positions veya /area.md (fallback) kullanır.
 - Ayrı koleksiyon korumak için tileset.clippingPolygons içine ekler, model için model.clippingPlanes set eder.
*/
export default function ModelCutTool(){
  const { activeTool, selection, modelSelection, buildingEntity, setModelClipHistory } = useCesiumCtx();
  const isActive = activeTool === 'modelCut';
  const [status,setStatus] = useState('idle');
  const [applied,setApplied] = useState(false);
  // keepInside: seçilen poligonun içi kalsın (default). removeInside: seçilen alan kesilsin (çıkarılsın)
  const [mode,setMode] = useState('keepInside');

  const buildPlanesFromPositions = useCallback((positions, invert)=>{
    if(!positions || positions.length < 3) return null;
    // 1) Local ENU projeksiyonu
    const originCarto = Cesium.Cartographic.fromCartesian(positions[0]);
    const origin = Cesium.Cartesian3.fromRadians(originCarto.longitude, originCarto.latitude, originCarto.height);
    const enuFrame = Cesium.Transforms.eastNorthUpToFixedFrame(origin);
    const inv = Cesium.Matrix4.inverseTransformation(enuFrame, new Cesium.Matrix4());
    const localPts = positions.map(p=>{
      const lp = Cesium.Matrix4.multiplyByPoint(inv, p, new Cesium.Cartesian3());
      return lp;
    });
    // 1.5) Poligon yönü (shoelace) belirle (XY düzleminde)
    let area = 0;
    for(let i=0;i<localPts.length;i++){
      const a = localPts[i];
      const b = localPts[(i+1)%localPts.length];
      area += (a.x * b.y - b.x * a.y);
    }
    // area > 0 => CCW, area < 0 => CW
    const isCCW = area > 0;
    // Kenar düzlemi oluştur: polygonun DIŞINA bakan normal; böylece keepInside modunda iç kısım korunur.
    // CCW ise outward = rotate 90° CW. CW ise rotate 90° CCW.
    // 2) Z değerleri ile bastırma: model clipping planes için dikey extrude varsayımı
    // Planes: polygonun her kenarı için dikey bir plane + bir taban plane (opsiyonel değil) + bir tavan plane (opsiyonel).
    // Kenar düzlemi oluştur: normal = (edgeDir 2D rotated outward) cross Up
    function edgePlane(a,b){
      const dir = Cesium.Cartesian3.subtract(b,a,new Cesium.Cartesian3());
      dir.z = 0;
      if(Cesium.Cartesian3.magnitude(dir) < 1e-6) return null;
      Cesium.Cartesian3.normalize(dir,dir);
      let outward2D;
      if(isCCW){
        // rotate 90° CW: (dx,dy)->(dy,-dx)
        outward2D = new Cesium.Cartesian3(dir.y, -dir.x, 0);
      } else {
        // rotate 90° CCW: (dx,dy)->(-dy,dx)
        outward2D = new Cesium.Cartesian3(-dir.y, dir.x, 0);
      }
      // invert (removeInside) ise normalı ters çevir (iç taraf pozitif olup kesilsin)
      if(invert){
        outward2D.x *= -1; outward2D.y *= -1; outward2D.z *= -1;
      }
      const normalLocal = outward2D;
      Cesium.Cartesian3.normalize(normalLocal, normalLocal);
      const distance = -Cesium.Cartesian3.dot(normalLocal, a);
      const rot = Cesium.Matrix4.getMatrix3(enuFrame,new Cesium.Matrix3());
      const normalWorld = Cesium.Matrix3.multiplyByVector(rot, normalLocal, new Cesium.Cartesian3());
      Cesium.Cartesian3.normalize(normalWorld, normalWorld);
      return new Cesium.ClippingPlane(normalWorld, distance);
    }
    const planes = [];
    for(let i=0;i<localPts.length;i++){
      const a = localPts[i];
      const b = localPts[(i+1)%localPts.length];
      const pl = edgePlane(a,b);
      if(pl) planes.push(pl);
    }
    if(planes.length === 0) return null;
    return { planes };
  },[]);

  const applyClip = useCallback(async ()=>{
    if(!buildingEntity) { setStatus('model yok'); return; }
    // Öncelik: modelSelection -> normal selection -> fallback area.md
    let positions = modelSelection?.positions || selection?.positions;
    if(!positions || positions.length < 3){
      // fallback area.md
      try {
        const res = await fetch('/area.md', { cache:'no-cache'});
        if(res.ok){
          const text = await res.text();
          const regex = /new\s+Cesium\.Cartesian3\(([-0-9.]+),\s*([-0-9.]+),\s*([-0-9.]+)\)/g;
          const arr = []; let m;
          while((m=regex.exec(text))!==null){
            const x=+m[1],y=+m[2],z=+m[3];
            if([x,y,z].every(isFinite)) arr.push(new Cesium.Cartesian3(x,y,z));
          }
          if(arr.length>=3) positions = arr;
        }
  } catch { /* area.md okunamadı */ }
    }
    if(!positions || positions.length < 3){ setStatus('geçerli alan yok'); return; }
    const invert = mode === 'removeInside';
    const result = buildPlanesFromPositions(positions, invert);
    if(!result){ setStatus('plane üretilemedi'); return; }
    try {
      // Eski clipping kaydet (undo için)
      if(buildingEntity.model.clippingPlanes){
        const prev = buildingEntity.model.clippingPlanes.planes.map(p=>({ normal:{ x:p.normal.x, y:p.normal.y, z:p.normal.z }, distance:p.distance }));
        setModelClipHistory(h=>[...h, { planes: prev, mode }]);
      } else {
        setModelClipHistory(h=>[...h, { planes: null, mode:null }]);
      }
      buildingEntity.model.clippingPlanes = new Cesium.ClippingPlaneCollection({
        planes: result.planes,
        unionClippingRegions: true,
        edgeColor: Cesium.Color.CYAN,
        edgeWidth: 1.0
      });
      setApplied(true); setStatus('uygulandı');
    } catch { setStatus('model clip başarısız'); }
  },[buildPlanesFromPositions, buildingEntity, selection, modelSelection, mode, setModelClipHistory]);

  const undoClip = useCallback(()=>{
    if(!buildingEntity) return;
    setModelClipHistory(h=>{
      if(h.length === 0) { setStatus('undo yok'); return h; }
      const copy = [...h];
      const last = copy.pop();
      try {
        if(!last.planes){
          buildingEntity.model.clippingPlanes = undefined;
        } else {
          const restored = last.planes.map(pl=> new Cesium.ClippingPlane(new Cesium.Cartesian3(pl.normal.x, pl.normal.y, pl.normal.z), pl.distance));
          buildingEntity.model.clippingPlanes = new Cesium.ClippingPlaneCollection({
            planes: restored,
            unionClippingRegions: true,
            edgeColor: Cesium.Color.CYAN,
            edgeWidth: 1.0
          });
        }
        setStatus('undo yapıldı');
  } catch{ setStatus('undo hata'); }
      return copy;
    });
  },[buildingEntity, setModelClipHistory]);

  useEffect(()=>{ if(isActive) setStatus(applied ? 'uygulandı' : 'hazır'); },[isActive, applied]);
  if(!isActive) return null;
  return (
    <div className="mt-2 p-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60">
      <strong className="block mb-1 text-white/70">Model Cut</strong>
  <p className="mb-1">Sadece modeli keser. Öncelik: Model Select çokgeni.</p>
      <div className="flex gap-2 mb-2 text-[10px]">
        <label className="flex items-center gap-1 cursor-pointer">
          <input type="radio" name="modelCutMode" value="keepInside" checked={mode==='keepInside'} onChange={()=>setMode('keepInside')} />
          İç Kalsın
        </label>
        <label className="flex items-center gap-1 cursor-pointer">
          <input type="radio" name="modelCutMode" value="removeInside" checked={mode==='removeInside'} onChange={()=>setMode('removeInside')} />
          İç Kesilsin
        </label>
      </div>
      <div className="flex gap-1 mb-1">
        <button onClick={applyClip} className="flex-1 text-[10px] px-2 py-1 rounded bg-purple-600/80 hover:bg-purple-500 text-white">Uygula</button>
        <button onClick={undoClip} className="flex-1 text-[10px] px-2 py-1 rounded bg-gray-600/70 hover:bg-gray-500 text-white">Undo</button>
      </div>
      <p className="text-[10px] text-emerald-300">Durum: {status}</p>
    </div>
  );
}
