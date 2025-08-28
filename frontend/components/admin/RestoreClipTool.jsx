import React from 'react';
import * as Cesium from 'cesium';
import { useCesiumCtx } from '../../context/CesiumContext';

/* RestoreClipTool
 * activeTool === 'restoreClip'
 * - Clear all tileset & model clipping
 * - Optionally reapply /area.md (isteğe bağlı buton)
*/
export default function RestoreClipTool(){
  const { activeTool, tileset, buildingEntity, setClipping, selection } = useCesiumCtx();
  const isActive = activeTool === 'restoreClip';
  if(!isActive) return null;

  function clearAll(){
    if(tileset) tileset.clippingPolygons = undefined;
    if(buildingEntity?.model) buildingEntity.model.clippingPlanes = undefined;
    setClipping(c=>({...c, applied:false}));
  }
  async function reapplyArea(){
    try {
      const res = await fetch('/area.md', { cache:'no-cache' });
      if(!res.ok) return;
      const text = await res.text();
      const regex = /new\s+Cesium\.Cartesian3\(([-0-9.]+),\s*([-0-9.]+),\s*([-0-9.]+)\)/g;
      const arr=[]; let m;
      while((m=regex.exec(text))!==null){
        const x=+m[1],y=+m[2],z=+m[3];
        if([x,y,z].every(isFinite)) arr.push(new Cesium.Cartesian3(x,y,z));
      }
      if(arr.length<3) return;
      const poly = new Cesium.ClippingPolygon({ positions: arr });
      tileset.clippingPolygons = new Cesium.ClippingPolygonCollection({ polygons:[poly], unionClippingRegions:true, edgeColor: Cesium.Color.YELLOW });
      setClipping(c=>({...c, applied:true}));
    } catch {/* ignore */}
  }
  function restoreSelectedArea(){
    if(!tileset || !selection?.positions?.length) return;
    const sel = selection.positions;
    // Eğer hiç clipping yoksa yapılacak yok
    if(!tileset.clippingPolygons){
      if(buildingEntity?.model?.clippingPlanes){
        buildingEntity.model.clippingPlanes = undefined;
      }
      return;
    }
    try {
      const remainPolys = [];
      for(let i=0;i<tileset.clippingPolygons.length;i++){
        const poly = tileset.clippingPolygons.get(i);
        let positions = poly.positions || poly._positions || poly._PolygonHierarchyPositions || [];
        // Basit eşleşme: vertex sayısı eşitse ve tüm noktalar ~ aynıysa (mesafe < 0.05m)
        const same = positions.length === sel.length && positions.every((p,idx)=>{
          const sp = sel[idx];
          return Cesium.Cartesian3.distance(p, sp) < 0.05;
        });
        if(!same) remainPolys.push(positions);
      }
      // Eğer tüm poligonlar kaldırıldıysa property'i temizle, aksi halde yeniden oluştur
      if(remainPolys.length === 0){
        tileset.clippingPolygons = undefined;
        setClipping(c=>({...c, applied:false}));
      } else {
        const newPolys = remainPolys.map(posArr=> new Cesium.ClippingPolygon({ positions: posArr }));
        tileset.clippingPolygons = new Cesium.ClippingPolygonCollection({ polygons:newPolys, unionClippingRegions:true, edgeColor: Cesium.Color.YELLOW, edgeWidth:1 });
        setClipping(c=>({...c, applied:true}));
      }
      // Model için tamamen kaldır (şimdilik tek polygon kabul edildi)
      if(buildingEntity?.model?.clippingPlanes){
        buildingEntity.model.clippingPlanes = undefined;
      }
    } catch { /* ignore restore errors */ }
  }
  return (
    <div className="mt-2 p-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60">
      <strong className="block mb-1 text-white/70">Restore / Clear Clips</strong>
      <div className="flex flex-col gap-1">
        <button onClick={clearAll} className="w-full text-[10px] px-2 py-1 rounded bg-red-600/80 hover:bg-red-500 text-white">Clear All</button>
        <button onClick={reapplyArea} className="w-full text-[10px] px-2 py-1 rounded bg-emerald-600/80 hover:bg-emerald-500 text-white">Reapply area.md</button>
        <button onClick={restoreSelectedArea} disabled={!(selection?.positions?.length)} className={`w-full text-[10px] px-2 py-1 rounded ${selection?.positions?.length ? 'bg-indigo-600/80 hover:bg-indigo-500 text-white':'bg-white/10 text-white/30 cursor-not-allowed'}`}>Restore Selected Area</button>
      </div>
    </div>
  );
}
