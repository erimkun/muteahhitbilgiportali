import React, { useEffect, useCallback, useState, useRef } from 'react';
import * as Cesium from 'cesium';
import { useCesiumCtx } from '../../context/CesiumContext';

/*
CuttingTool
Behavior:
  - When activeTool === 'cut' and tileset is ready, it applies a clipping polygon.
  - Prefers current selection (from AreaSelectTool). If selection has >=3 verts, uses those.
  - If no selection, tries to fetch /area.md and parse (same logic style as AutoAreaClipper).
  - Re-applies automatically whenever selection changes while tool remains active.
  - Cleans duplicate trailing / closure vertices (almostEqual) before applying.
  - Clears clipping when tool deactivates.
Panel UI:
  - Shows status, vertex count, buttons: Reapply, Clear, Force area.md.
*/

export default function CuttingTool() {
  const { activeTool, selection, tileset, setClipping, clipping } = useCesiumCtx();
  const [status, setStatus] = useState('idle');
  const [toolPolys, setToolPolys] = useState([]); // polygons added via this tool
  const selectionIdsRef = useRef(new Set()); // track selection ids already applied
  const isActive = activeTool === 'cut';

  const addClipPolygon = useCallback((rawPositions) => {
    if (!tileset || !rawPositions || rawPositions.length < 3) return false;
    let positions = [...rawPositions];
    // cleanup duplicates & closure
    if (positions.length >= 2) {
      const last = positions[positions.length - 1];
      const prev = positions[positions.length - 2];
      if (almostEqual(last, prev)) positions.pop();
      const first = positions[0];
      if (positions.length >= 3 && almostEqual(positions[positions.length - 1], first)) positions.pop();
    }
    if (positions.length < 3) return false;
    if (!Cesium.ClippingPolygon || !Cesium.ClippingPolygonCollection) {
      console.warn('[CuttingTool] ClippingPolygon API not available');
      return false;
    }
    try {
      const clipPoly = new Cesium.ClippingPolygon({ positions });
      if (!tileset.clippingPolygons) {
        tileset.clippingPolygons = new Cesium.ClippingPolygonCollection({
          polygons: [clipPoly],
          unionClippingRegions: true,
          edgeColor: Cesium.Color.YELLOW,
          edgeWidth: 1.0
        });
      } else {
        // add to existing collection without replacing (preserve AutoAreaClipper polygon)
        try { tileset.clippingPolygons.add(clipPoly); }
        catch {
          // fallback: rebuild collection with existing + new
          try {
            const existing = [];
            for (let i = 0; i < tileset.clippingPolygons.length; i++) {
              existing.push(tileset.clippingPolygons.get(i));
            }
            tileset.clippingPolygons = new Cesium.ClippingPolygonCollection({
              polygons: [...existing, clipPoly],
              unionClippingRegions: true,
              edgeColor: Cesium.Color.YELLOW,
              edgeWidth: 1.0
            });
          } catch (e) { console.warn('Rebuild clipping collection failed', e); }
        }
      }
      setToolPolys(p => [...p, clipPoly]);
      setClipping(c => ({ ...c, applied: true, usePoly: true }));
      console.log(`[CuttingTool] Added clipping polygon (total in collection may be larger).`);
      return true;
    } catch (e) {
      console.error('[CuttingTool] Failed to add clipping polygon', e);
      return false;
    }
  }, [tileset, setClipping]);

  const fetchAreaMdAndAdd = useCallback(async () => {
    try {
      setStatus('fetching /area.md');
      const res = await fetch('/area.md', { cache: 'no-cache' });
      if (!res.ok) { setStatus('area.md not found'); return; }
      const text = await res.text();
      let positions = parseCartesian(text);
      if (!positions.length) positions = parseDegrees(text);
      if (!positions.length) { setStatus('no valid vertices in area.md'); return; }
      const ok = addClipPolygon(positions);
      setStatus(ok ? 'added from area.md' : 'failed (area.md)');
    } catch (e) {
      console.error('[CuttingTool] area.md error', e);
      setStatus('error reading area.md');
    }
  }, [addClipPolygon]);

  // Auto-add when tool becomes active or a new selection (new id) appears
  useEffect(() => {
    if (!isActive) return;
    if (selection && selection.positions?.length >= 3 && !selectionIdsRef.current.has(selection.id)) {
      const ok = addClipPolygon(selection.positions);
      if (ok) {
        selectionIdsRef.current.add(selection.id);
        setStatus('added from selection');
      } else {
        setStatus('failed (selection)');
      }
    } else if ((!selection || selection.positions?.length < 3) && toolPolys.length === 0 && !tileset?.clippingPolygons) {
      // first activation fallback if nothing present
      fetchAreaMdAndAdd();
    }
  }, [isActive, selection, addClipPolygon, fetchAreaMdAndAdd, toolPolys.length, tileset]);

  // Do NOT clear polygons automatically on deactivate; user handles via buttons.

  if (!isActive) return null;
  const selVerts = selection?.positions?.length || 0;
  const toolPolyCount = toolPolys.length;

  function undoLast() {
    if (!tileset?.clippingPolygons || toolPolys.length === 0) return;
    const last = toolPolys[toolPolys.length - 1];
    let removed = false;
    try {
      if (tileset.clippingPolygons.contains && tileset.clippingPolygons.contains(last)) {
        removed = tileset.clippingPolygons.remove(last);
      } else if (tileset.clippingPolygons.remove) {
        removed = tileset.clippingPolygons.remove(last);
      }
  } catch { /* ignore remove errors */ }
    if (!removed) {
      // fallback rebuild without last
      try {
        const keep = [];
        for (let i=0;i<tileset.clippingPolygons.length;i++) {
          const p = tileset.clippingPolygons.get(i);
          if (p !== last) keep.push(p);
        }
        tileset.clippingPolygons = keep.length ? new Cesium.ClippingPolygonCollection({ polygons: keep, unionClippingRegions: true, edgeColor: Cesium.Color.YELLOW, edgeWidth: 1.0 }) : undefined;
  } catch { /* ignore rebuild errors */ }
    }
    setToolPolys(tp => tp.slice(0, -1));
    setStatus('undo last');
    if (!tileset.clippingPolygons) setClipping(c=>({ ...c, applied:false }));
  }

  function clearAll() {
    if (tileset) {
      try {
        tileset.clippingPolygons = new Cesium.ClippingPolygonCollection({ polygons: [], unionClippingRegions: true });
      } catch { tileset.clippingPolygons = undefined; }
    }
    setToolPolys([]);
    selectionIdsRef.current.clear();
    setClipping(c=>({ ...c, applied:false }));
    setStatus('cleared');
  }
  return (
    <div className="text-xs text-white/70 space-y-2">
      <p className="leading-snug">Automatically applies clipping from current area selection. If no selection, tries area.md.</p>
      <div className="flex flex-col gap-1">
        <button
          onClick={() => selection?.positions && addClipPolygon(selection.positions)}
          disabled={selVerts < 3}
          className={`w-full text-[10px] px-2 py-1 rounded ${selVerts>=3 ? 'bg-indigo-600/80 hover:bg-indigo-500 text-white' : 'bg-white/10 text-white/40 cursor-not-allowed'}`}
        >Add From Selection ({selVerts})</button>
        <button
          onClick={fetchAreaMdAndAdd}
          className="w-full text-[10px] px-2 py-1 rounded bg-blue-600/80 hover:bg-blue-500 text-white"
        >Add From area.md</button>
        <div className="flex gap-1">
          <button
            onClick={undoLast}
            disabled={toolPolyCount === 0}
            className={`flex-1 text-[10px] px-2 py-1 rounded ${toolPolyCount>0 ? 'bg-amber-600/80 hover:bg-amber-500 text-white' : 'bg-white/10 text-white/40 cursor-not-allowed'}`}
          >Undo ({toolPolyCount})</button>
          <button
            onClick={clearAll}
            className="flex-1 text-[10px] px-2 py-1 rounded bg-red-600/70 hover:bg-red-500 text-white"
          >Reset</button>
        </div>
      </div>
      <p className="text-[10px] text-emerald-300">Status: {status} {clipping?.applied && '(active)'} | Tool polys: {toolPolyCount}</p>
    </div>
  );
}

function parseCartesian(md) {
  const regex = /new\s+Cesium\.Cartesian3\(([-0-9.]+),\s*([-0-9.]+),\s*([-0-9.]+)\)/g;
  const arr = []; let m;
  while ((m = regex.exec(md)) !== null) {
    const x = parseFloat(m[1]); const y = parseFloat(m[2]); const z = parseFloat(m[3]);
    if ([x,y,z].every(isFinite)) arr.push(new Cesium.Cartesian3(x,y,z));
  }
  return arr;
}
function parseDegrees(md) {
  const degSection = md.match(/Degrees Array[\s\S]*?\n([0-9.,\s-]+)/);
  if (!degSection) return [];
  const nums = degSection[1].split(/[.,\s]+/).map(n=>n.trim()).filter(Boolean).map(parseFloat);
  const arr = [];
  for (let i=0; i<nums.length-1; i+=2) {
    const lon = nums[i]; const lat = nums[i+1];
    if (isFinite(lon) && isFinite(lat)) arr.push(Cesium.Cartesian3.fromDegrees(lon, lat));
  }
  return arr;
}
function almostEqual(a,b,eps=1e-6){ if(!a||!b) return false; return Math.abs(a.x-b.x)<eps && Math.abs(a.y-b.y)<eps && Math.abs(a.z-b.z)<eps; }
