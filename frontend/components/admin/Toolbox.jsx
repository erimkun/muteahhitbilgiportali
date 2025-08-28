import React from 'react';
import * as Cesium from 'cesium';
import { useCesiumCtx } from '../../context/CesiumContext';
import CuttingTool from './CuttingTool';
import ModelCutTool from './ModelCutTool';
import RestoreClipTool from './RestoreClipTool';
import ModelSelectionTool from './ModelSelectionTool';

const tools = [
  { id: 'measure', label: 'Measure' },
  { id: 'area', label: 'Select Area' },
  { id: 'box', label: 'Box Selection' },
  { id: 'cut', label: 'Cutting Tool' },
  { id: 'building', label: 'Building' },
  { id: 'logo', label: 'Logo' },
  { id: 'modelSelect', label: 'Model Select' },
  { id: 'modelCut', label: 'Model Cut' },
  { id: 'restoreClip', label: 'Restore Clips' },
];

export default function Toolbox() {
  const { projectId, activeTool, setActiveTool, measurement, selection, areaMode, setAreaMode, setClipping, boxTool, setBoxTool, viewer, tileset, buildingEntity, buildingTransform, setBuildingTransform, logoTransform } = useCesiumCtx();
  const [pubStatus, setPubStatus] = React.useState(null);
  const [publishLabel, setPublishLabel] = React.useState('');
  const [history, setHistory] = React.useState([]);
  const [expandedHistory, setExpandedHistory] = React.useState(false);

  const fetchHistory = React.useCallback(() => {
    fetch(`http://localhost:3001/api/projects/${projectId}/model/history`)
      .then(res => res.json())
      .then(response => {
        if (response.data) {
          setHistory(response.data);
        }
      })
      .catch(err => console.error('Failed to fetch history', err));
  }, [projectId]);

  React.useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  function applyPublishedToRuntime(snapshot){
    // Apply to existing admin viewer without reload
    try {
      const bt = snapshot?.buildingTransform || buildingTransform;
      if(buildingEntity && bt){
        const pos = Cesium.Cartesian3.fromDegrees(bt.position.lon, bt.position.lat, bt.position.height);
        buildingEntity.position = pos;
        const hpr = new Cesium.HeadingPitchRoll(
          Cesium.Math.toRadians(bt.rotation.heading),
          Cesium.Math.toRadians(bt.rotation.pitch),
          Cesium.Math.toRadians(bt.rotation.roll)
        );
        buildingEntity.orientation = Cesium.Transforms.headingPitchRollQuaternion(pos, hpr);
        if(buildingEntity.model){ buildingEntity.model.scale = bt.scale; buildingEntity.show = bt.visible; }
        setBuildingTransform(bt);
      }
      // Tileset polygons (from snapshot or localStorage)
      const polysSrc = snapshot?.tilesetClips || ( ()=>{ try { return JSON.parse(localStorage.getItem('publishedTilesetClips')||'null'); } catch { return null; } })();
      if(polysSrc && tileset){
        const polygons = polysSrc.map(posArr => new Cesium.ClippingPolygon({ positions: posArr.map(p=> new Cesium.Cartesian3(p.x,p.y,p.z)) }));
        tileset.clippingPolygons = new Cesium.ClippingPolygonCollection({ polygons, unionClippingRegions:true, edgeColor: Cesium.Color.CYAN, edgeWidth:1 });
      }
      // Model clip planes
      const planesSource = snapshot?.modelClipPlanes || ( ()=>{ try { return JSON.parse(localStorage.getItem('publishedModelClipPlanes')||'null'); } catch { return null;} })();
      if(planesSource && buildingEntity && buildingEntity.model){
        buildingEntity.model.clippingPlanes = new Cesium.ClippingPlaneCollection({
          planes: planesSource.map(pl=> new Cesium.ClippingPlane(new Cesium.Cartesian3(pl.normal.x,pl.normal.y,pl.normal.z), pl.distance)),
          unionClippingRegions: true,
          edgeColor: Cesium.Color.CYAN,
          edgeWidth: 1.0
        });
      }
    } catch(e){ console.warn('Apply published runtime fail', e); }
  }

  async function publishState() {
    setPubStatus('publishing');
    try {
      // 1. Consolidate data
      const tilesetClips = (() => {
        if (tileset && tileset.clippingPolygons) {
          const coll = tileset.clippingPolygons;
          const polys = [];
          const len = coll.length || coll._polygons?.length || 0;
          for (let i = 0; i < len; i++) {
            const poly = coll.get ? coll.get(i) : (coll._polygons ? coll._polygons[i] : null);
            if (!poly) continue;
            const positions = poly.positions || poly._positions || [];
            polys.push(positions.map(p => ({ x: p.x, y: p.y, z: p.z })));
          }
          return polys;
        }
        return [];
      })();

      const modelClipPlanes = (() => {
        if (buildingEntity && buildingEntity.model && buildingEntity.model.clippingPlanes) {
          return buildingEntity.model.clippingPlanes.planes.map(pl => ({ normal: { x: pl.normal.x, y: pl.normal.y, z: pl.normal.z }, distance: pl.distance }));
        }
        return [];
      })();

      const dataToSave = {
        building_transform: buildingTransform,
        tileset_clips: tilesetClips,
        model_clip_planes: modelClipPlanes,
        logo_transform: logoTransform,
      };

      // 2. Save to database (create new version)
      const saveResponse = await fetch(`http://localhost:3001/api/projects/${projectId}/model`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave),
      });
      if (!saveResponse.ok) throw new Error('Failed to save model version.');
      const savedData = await saveResponse.json();
      const newVersionId = savedData.data.id;

      // 3. Publish the new version
      const publishResponse = await fetch(`http://localhost:3001/api/projects/${projectId}/model/publish/${newVersionId}`, {
        method: 'PUT',
      });
      if (!publishResponse.ok) throw new Error('Failed to publish model version.');

      setPubStatus('published');
      // Refresh history from backend
      fetchHistory();
      // Apply the newly published state to the runtime
      applyPublishedToRuntime({ ...dataToSave, id: newVersionId, createdAt: new Date().toISOString() });

    } catch (err) {
      console.error('Publish failed', err);
      setPubStatus('error');
    } finally {
      setTimeout(() => setPubStatus(null), 2500);
      setPublishLabel('');
    }
  }

  async function revertTo(id) {
    try {
      const publishResponse = await fetch(`http://localhost:3001/api/projects/${projectId}/model/publish/${id}`, {
        method: 'PUT',
      });
      if (!publishResponse.ok) throw new Error('Failed to publish model version.');

      // Fetch the data for the reverted version to apply it to the runtime
      const modelResponse = await fetch(`http://localhost:3001/api/projects/${projectId}/model/published`);
      if(!modelResponse.ok) throw new Error('Failed to fetch reverted model data.');
      const revertedData = await modelResponse.json();

      applyPublishedToRuntime({
        buildingTransform: JSON.parse(revertedData.data.building_transform),
        tilesetClips: JSON.parse(revertedData.data.tileset_clips),
        modelClipPlanes: JSON.parse(revertedData.data.model_clip_planes),
      });

      setPubStatus('reverted');
      fetchHistory(); // Refresh history to show new published state
    } catch (err) {
      console.error('Revert failed', err);
      setPubStatus('error');
    } finally {
      setTimeout(() => setPubStatus(null), 2000);
    }
  }

  async function fullReset() {
    if (!window.confirm('Tüm yayın geçmişi ve yayınlanmış durum silinecek. Emin misiniz?')) return;
    try {
      const response = await fetch('http://localhost:3001/api/model/reset', {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to reset database.');

      if (tileset) tileset.clippingPolygons = new Cesium.ClippingPolygonCollection({ polygons: [] });
      if (buildingEntity && buildingEntity.model) { buildingEntity.model.clippingPlanes = undefined; }
      
      fetchHistory();
      setPubStatus('reset');
    } catch (err) {
      console.error('Reset failed', err);
      setPubStatus('error');
    } finally {
      setTimeout(() => setPubStatus(null), 2500);
    }
  }

  function nudge(dx, dy, dz) {
  if (!boxTool.center || !viewer) return;
  const step = boxTool.step || 1;
  const carto = Cesium.Cartographic.fromCartesian(boxTool.center);
  const enu = Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, carto.height));
  // ENU axes are columns of matrix (0-3 index) => extract direction vectors
  const east = Cesium.Matrix4.getColumn(enu, 0, new Cesium.Cartesian3());
  const up = Cesium.Matrix4.getColumn(enu, 2, new Cesium.Cartesian3());
  // Reconstruct north = up x east
  const north = Cesium.Cartesian3.cross(up, east, new Cesium.Cartesian3());
  Cesium.Cartesian3.normalize(east, east);
  Cesium.Cartesian3.normalize(north, north);
  Cesium.Cartesian3.normalize(up, up);
  const moveVec = new Cesium.Cartesian3();
  Cesium.Cartesian3.multiplyByScalar(east, dx * step, moveVec);
  const northPart = Cesium.Cartesian3.multiplyByScalar(north, dy * step, new Cesium.Cartesian3());
  Cesium.Cartesian3.add(moveVec, northPart, moveVec);
  const upPart = Cesium.Cartesian3.multiplyByScalar(up, dz * step, new Cesium.Cartesian3());
  Cesium.Cartesian3.add(moveVec, upPart, moveVec);
  setBoxTool(b => ({ ...b, center: Cesium.Cartesian3.add(b.center, moveVec, new Cesium.Cartesian3()) }));
  }

  function resetBox() {
    setBoxTool(b => { if (b.entity && viewer && !viewer.isDestroyed()) viewer.entities.remove(b.entity); return { center: null, width: 10, depth: 10, height: 5, entity: null }; });
  }

  function exportAreaMarkdown(sel) {
    if (!sel) return;
    // Build Cartesian & degrees arrays
    const toDeg = (rad) => (rad * 180/Math.PI);
    const cartesianLines = sel.positions.map((p,i)=>`  - P${i+1}: X ${p.x.toFixed(3)} Y ${p.y.toFixed(3)} Z ${p.z.toFixed(3)}`).join('\n');
    const degreePairs = sel.positions.map(p=>{ const c = Cesium.Cartographic.fromCartesian(p); return `${toDeg(c.longitude).toFixed(8)}, ${toDeg(c.latitude).toFixed(8)}`; }).join(', ');
    const centroidCarto = Cesium.Cartographic.fromCartesian(sel.centroid);
    const md = `# Area Selection\n\nMode: ${sel.mode || 'polygon'}\nVertex Count: ${sel.positions.length}\nArea (m^2): ${sel.areaM2.toFixed(3)}\n\n## Vertices (Cartesian)\n${cartesianLines}\n\n## Degrees Array (lon, lat)\n${degreePairs}\n\n## ClippingPolygon (Cartesian snippet)\n\`\`\`js\nconst clipPoly = new Cesium.ClippingPolygon({\n  positions: [\n${sel.positions.map(p=>`    new Cesium.Cartesian3(${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)}),`).join('\n')}\n  ]\n});\n\`\`\`\n\n## Centroid\n- Lon: ${toDeg(centroidCarto.longitude).toFixed(8)}\n- Lat: ${toDeg(centroidCarto.latitude).toFixed(8)}\n- Height: ${centroidCarto.height.toFixed(3)}\n\n${sel.metrics ? `## Rectangle Metrics (if applicable)\n- Width2D: ${sel.metrics.width2D?.toFixed(3)} m\n- Height2D: ${sel.metrics.height2D?.toFixed(3)} m\n- Diagonal2D: ${sel.metrics.diagonal2D?.toFixed(3)} m\n- Width3D: ${sel.metrics.width3D?.toFixed(3)} m\n- Height3D: ${sel.metrics.height3D?.toFixed(3)} m\n- Diagonal3D: ${sel.metrics.diagonal3D?.toFixed(3)} m\n` : ''}`;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'area.md';
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
  }

  async function loadAreaMarkdown() {
    try {
      const res = await fetch('/area.md', { cache: 'no-cache' });
      if (!res.ok) throw new Error('area.md bulunamadı');
      const text = await res.text();
      const regex = /new\s+Cesium\.Cartesian3\(([-0-9.]+),\s*([-0-9.]+),\s*([-0-9.]+)\)/g;
      const positions = [];
      let m;
      while ((m = regex.exec(text)) !== null) {
        const x = parseFloat(m[1]); const y = parseFloat(m[2]); const z = parseFloat(m[3]);
        if (!isFinite(x) || !isFinite(y) || !isFinite(z)) continue;
        const prev = positions[positions.length-1];
        if (prev && Math.abs(prev.x - x) < 1e-6 && Math.abs(prev.y - y) < 1e-6 && Math.abs(prev.z - z) < 1e-6) continue; // skip duplicate consecutive
        positions.push(new Cesium.Cartesian3(x,y,z));
      }
      if (positions.length < 3) throw new Error('Yeterli vertex yok');
      const centroid = positions.reduce((acc,p)=>Cesium.Cartesian3.add(acc,p,acc), new Cesium.Cartesian3(0,0,0));
      Cesium.Cartesian3.divideByScalar(centroid, positions.length, centroid);
      // planar area approximation (ENU of first point)
      const originCarto = Cesium.Cartographic.fromCartesian(positions[0]);
      const enuFrame = Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.Cartesian3.fromRadians(originCarto.longitude, originCarto.latitude, originCarto.height));
      const inv = Cesium.Matrix4.inverseTransformation(enuFrame, new Cesium.Matrix4());
      const flat = positions.map(p => {
        const local = Cesium.Matrix4.multiplyByPoint(inv, p, new Cesium.Cartesian3());
        return { x: local.x, y: local.y };
      });
      let area = 0; for (let i=0;i<flat.length;i++){ const j=(i+1)%flat.length; area += flat[i].x*flat[j].y - flat[j].x*flat[i].y; }
      const areaM2 = Math.abs(area/2);
      // Put selection into a global custom event to reuse existing setSelection logic (or directly call if context accessible outside) — here we trigger a window event with payload
      const evt = new CustomEvent('area-imported', { detail: { positions, centroid, areaM2 } });
      window.dispatchEvent(evt);
      // Auto-enable clipping poly mode
      setClipping(c => ({ ...c, applied: true, usePoly: true }));
    } catch (e) {
      console.error('[Area Import] Failed:', e);
      alert('area.md yüklenemedi: ' + e.message);
    }
  }

  return (
  <div className="absolute top-1/2 -translate-y-1/2 left-4 z-20 flex flex-col gap-2 bg-black/40 backdrop-blur-md p-3 rounded-xl border border-white/10 shadow-2xl w-60 max-h-[80vh] overflow-auto">
      <h2 className="text-sm font-semibold text-white/80 tracking-wide mb-1">Tools</h2>
      <div className="flex flex-col gap-2">
        {tools.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTool(t.id === activeTool ? null : t.id)}
            className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${activeTool === t.id ? 'bg-indigo-600/80 border-indigo-400 text-white' : 'bg-white/10 hover:bg-white/20 border-white/10 text-white/70'}`}
          >
            {t.label}
          </button>
        ))}
        <div className="mt-1 space-y-1">
          <input value={publishLabel} onChange={e=>setPublishLabel(e.target.value)} placeholder="Versiyon etiketi" className="w-full px-2 py-1 rounded bg-white/10 text-[11px] text-white placeholder-white/40 outline-none focus:bg-white/15" />
          <div className="flex flex-wrap gap-2">
            <button onClick={publishState} className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors border ${pubStatus==='published' ? 'bg-emerald-600/80 border-emerald-400 text-white' : 'bg-gradient-to-r from-indigo-600/70 to-purple-600/70 hover:from-indigo-500 hover:to-purple-500 border-white/10 text-white'}`}>Publish</button>
            <button onClick={fullReset} className="px-3 py-2 rounded-lg text-xs font-semibold bg-red-700/70 hover:bg-red-600/80 text-white border border-red-400/40">Full Reset</button>
          </div>
          {pubStatus && (
            <div className="text-[10px] text-white/70 px-1">
              {pubStatus==='published' && 'Yayınlandı'}
              {pubStatus==='reverted' && 'Geri alındı'}
              {pubStatus==='reset' && 'Reset tamam'}
              {pubStatus==='error' && 'Hata'}
            </div>
          )}
          <div className="mt-1">
            <button onClick={()=>setExpandedHistory(e=>!e)} className="w-full text-left text-[11px] px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white/80">
              Versiyonlar ({history.length}) {expandedHistory ? '▲':'▼'}
            </button>
            {expandedHistory && (
              <div className="mt-1 max-h-48 overflow-auto space-y-1 pr-1 custom-scroll">
                {history.length===0 && <div className="text-[10px] text-white/40">Kayıt yok</div>}
                {history.slice().reverse().map(h=> (
                  <div key={h.id} className="border border-white/10 rounded p-1 text-[10px] bg-white/5 flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-white/80 truncate max-w-[110px]" title={`Version ${h.id}`}>Version {h.id}</span>
                      <button onClick={()=>revertTo(h.id)} className="px-2 py-[2px] rounded bg-indigo-600/70 hover:bg-indigo-500 text-white text-[10px]">Revert</button>
                    </div>
                    <div className="text-white/40">
                      {new Date(h.created_at).toLocaleTimeString()} {h.is_published && '• Published'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {activeTool && (
        <div className="mt-2 p-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60">
          <strong className="block mb-1 text-white/70">{tools.find(t=>t.id===activeTool)?.label}</strong>
          {/* Placeholder help text for each tool */}
          {activeTool === 'measure' && (
            <div>
              <p className="mb-1">Left click add point, right click reset.</p>
              <p className="font-mono text-white/80">Pts: {measurement.points.length}</p>
              <p className="font-mono text-white/80">Last: {measurement.lastSegment.toFixed(2)} m</p>
              <p className="font-mono text-white/80">Total: {measurement.totalDistance.toFixed(2)} m</p>
              {measurement.area > 0 && <p className="font-mono text-white/80">Area: {measurement.area.toFixed(2)} m²</p>}
            </div>
          )}
          {/* move tool removed */}
          {activeTool === 'area' && (
            <div>
              <p className="mb-1">{areaMode === 'polygon' ? 'Çokgen: Sol tık nokta, çift tık bitir.' : 'Dikdörtgen: İlk köşe sol tık, sürükle-bırak.'}</p>
              <div className="flex gap-1 mb-2">
                <button onClick={() => setAreaMode('polygon')} className={`flex-1 text-[10px] px-1 py-1 rounded ${areaMode==='polygon' ? 'bg-indigo-600 text-white' : 'bg-white/10 text-white/60'}`}>Polygon</button>
                <button onClick={() => setAreaMode('rectangle')} className={`flex-1 text-[10px] px-1 py-1 rounded ${areaMode==='rectangle' ? 'bg-indigo-600 text-white' : 'bg-white/10 text-white/60'}`}>Rect</button>
                <button onClick={() => setAreaMode('box')} className={`flex-1 text-[10px] px-1 py-1 rounded ${areaMode==='box' ? 'bg-indigo-600 text-white' : 'bg-white/10 text-white/60'}`}>Box</button>
              </div>
              {selection && (
                <div className="font-mono text-white/80 space-y-1">
                  <p>Verts: {selection.positions.length}</p>
                  <p>Area: {selection.areaM2.toFixed(2)} m²</p>
                  {selection.metrics && (
                    <>
                      <p>W:{selection.metrics.width2D?.toFixed(2)}m H:{selection.metrics.height2D?.toFixed(2)}m</p>
                      <p>Diag:{selection.metrics.diagonal2D?.toFixed(2)}m</p>
                    </>
                  )}
                  <div className="pt-1">
                    <button
                      onClick={() => exportAreaMarkdown(selection)}
                      className="w-full text-[10px] px-2 py-1 rounded bg-emerald-600/80 hover:bg-emerald-500 text-white tracking-wide"
                      title="area.md dosyası olarak indir"
                    >Export MD</button>
                    <button
                      onClick={loadAreaMarkdown}
                      className="mt-1 w-full text-[10px] px-2 py-1 rounded bg-blue-600/80 hover:bg-blue-500 text-white tracking-wide"
                      title="/area.md dosyasını yükle ve clipping uygula"
                    >Import MD</button>
                  </div>
                </div>
              )}
              <div className="mt-2 flex justify-between items-center">
                <button
                  onClick={() => window.dispatchEvent(new Event('area-selection-reset'))}
                  className="text-[10px] text-red-300 hover:text-red-200 underline"
                  title="Reset all vertices and selection"
                >Reset</button>
                <span className="text-[9px] text-white/40">Ctrl+Right</span>
              </div>
            </div>
          )}
          {activeTool === 'box' && (
            <div className="space-y-2">
              <p className="mb-1">1) Left click sets center. 2) Use controls (W/D/H/Rot/Nudge) then Select.</p>
              <div className="grid grid-cols-3 gap-1 text-[10px]">
                <button onClick={()=>setBoxTool(b=>({...b,width:Math.max(1,(b.width||1)-1)}))} className="bg-white/10 hover:bg-white/20 rounded px-1 py-1">W-</button>
                <span className="text-center py-1 bg-white/5 rounded">W:{Math.round(boxTool.width)}</span>
                <button onClick={()=>setBoxTool(b=>({...b,width:(b.width||1)+1}))} className="bg-white/10 hover:bg-white/20 rounded px-1 py-1">W+</button>
                <button onClick={()=>setBoxTool(b=>({...b,depth:Math.max(1,(b.depth||1)-1)}))} className="bg-white/10 hover:bg-white/20 rounded px-1 py-1">D-</button>
                <span className="text-center py-1 bg-white/5 rounded">D:{Math.round(boxTool.depth)}</span>
                <button onClick={()=>setBoxTool(b=>({...b,depth:(b.depth||1)+1}))} className="bg-white/10 hover:bg-white/20 rounded px-1 py-1">D+</button>
                <button onClick={()=>setBoxTool(b=>({...b,height:Math.max(1,(b.height||1)-1)}))} className="bg-white/10 hover:bg-white/20 rounded px-1 py-1">H-</button>
                <span className="text-center py-1 bg-white/5 rounded">H:{Math.round(boxTool.height)}</span>
                <button onClick={()=>setBoxTool(b=>({...b,height:(b.height||1)+1}))} className="bg-white/10 hover:bg-white/20 rounded px-1 py-1">H+</button>
              </div>
              <div className="mt-1 grid grid-cols-4 gap-1 text-[10px]">
                <input type="number" min={0.1} step={0.1} value={boxTool.width}
                  onChange={e=>setBoxTool(b=>({...b,width:Math.max(0.1,parseFloat(e.target.value)||b.width)}))}
                  className="bg-white/10 rounded px-1 py-[2px] focus:bg-white/20 outline-none" placeholder="W" />
                <input type="number" min={0.1} step={0.1} value={boxTool.depth}
                  onChange={e=>setBoxTool(b=>({...b,depth:Math.max(0.1,parseFloat(e.target.value)||b.depth)}))}
                  className="bg-white/10 rounded px-1 py-[2px] focus:bg-white/20 outline-none" placeholder="D" />
                <input type="number" min={0.1} step={0.1} value={boxTool.height}
                  onChange={e=>setBoxTool(b=>({...b,height:Math.max(0.1,parseFloat(e.target.value)||b.height)}))}
                  className="bg-white/10 rounded px-1 py-[2px] focus:bg-white/20 outline-none" placeholder="H" />
                <input type="number" step={1} value={boxTool.rotationDeg || 0}
                  onChange={e=>setBoxTool(b=>({...b,rotationDeg:((parseFloat(e.target.value)||0)%360+360)%360}))}
                  className="bg-white/10 rounded px-1 py-[2px] focus:bg-white/20 outline-none" placeholder="Rot°" />
              </div>
              <div className="grid grid-cols-4 gap-1 text-[10px] mt-1">
                <button onClick={()=>setBoxTool(b=>({...b,rotationDeg:((b.rotationDeg-5)%360+360)%360}))} className="bg-white/10 hover:bg-white/20 rounded px-1 py-1" title="Rotate -5°">⟲5</button>
                <button onClick={()=>setBoxTool(b=>({...b,rotationDeg:(b.rotationDeg+5)%360}))} className="bg-white/10 hover:bg-white/20 rounded px-1 py-1" title="Rotate +5°">⟳5</button>
                <button onClick={()=>setBoxTool(b=>({...b,rotationDeg:0}))} className="bg-white/10 hover:bg-white/20 rounded px-1 py-1" title="Reset rotation">Rot0</button>
                <button onClick={()=>setBoxTool(b=>({...b,rotationDeg:(Math.round((b.rotationDeg||0)/15)*15)%360}))} className="bg-white/10 hover:bg-white/20 rounded px-1 py-1" title="Snap 15°">Snap15</button>
              </div>
              {boxTool.center && (
                <div className="text-[10px] leading-tight bg-white/5 rounded p-1.5 space-y-0.5 font-mono">
                  <p>Footprint: {(boxTool.width * boxTool.depth).toFixed(2)} m²</p>
                  <p>W: {boxTool.width.toFixed(2)} m | D: {boxTool.depth.toFixed(2)} m</p>
                  <p>Diag2D: {Math.hypot(boxTool.width, boxTool.depth).toFixed(2)} m</p>
                  <p>H: {boxTool.height.toFixed(2)} m</p>
                </div>
              )}
              <div className="grid grid-cols-3 gap-1 text-[10px] mt-1">
                <button onClick={()=>nudge( 1,0,0)} className="bg-white/10 hover:bg-white/20 rounded px-1 py-1" title="East +1m">+E</button>
                <button onClick={()=>nudge(-1,0,0)} className="bg-white/10 hover:bg-white/20 rounded px-1 py-1" title="East -1m">-E</button>
                <button onClick={()=>nudge(0,1,0)} className="bg-white/10 hover:bg-white/20 rounded px-1 py-1" title="North +1m">+N</button>
                <button onClick={()=>nudge(0,-1,0)} className="bg-white/10 hover:bg-white/20 rounded px-1 py-1" title="North -1m">-N</button>
                <button onClick={()=>nudge(0,0,1)} className="bg-white/10 hover:bg-white/20 rounded px-1 py-1" title="Up +1m">+H</button>
                <button onClick={()=>nudge(0,0,-1)} className="bg-white/10 hover:bg-white/20 rounded px-1 py-1" title="Up -1m">-H</button>
              </div>
              <div className="flex gap-1">
                <button disabled={!boxTool.center} onClick={()=>window.dispatchEvent(new Event('box-select-finalize'))} className={`flex-1 text-[10px] px-2 py-1 rounded ${boxTool.center ? 'bg-emerald-600/80 hover:bg-emerald-500 text-white':'bg-white/10 text-white/40'}`}>Select</button>
                <button onClick={resetBox} className="flex-1 text-[10px] px-2 py-1 rounded bg-red-600/70 hover:bg-red-500 text-white">Reset</button>
              </div>
              <div className="mt-1 flex items-center gap-1 text-[10px]">
                <span className="text-white/50">Step</span>
                <input type="number" min={0.1} step={0.1} value={boxTool.step}
                  onChange={e=>setBoxTool(b=>({...b, step: Math.max(0.1, parseFloat(e.target.value)||1)}))}
                  className="flex-1 bg-white/10 rounded px-1 py-[2px] outline-none focus:bg-white/20" />
              </div>
            </div>
          )}
          {/* clip / replace / building tools removed */}
          {activeTool === 'cut' && <CuttingTool />}
          {activeTool === 'modelSelect' && <ModelSelectionTool />}
          {activeTool === 'modelCut' && <ModelCutTool />}
          {activeTool === 'restoreClip' && <RestoreClipTool />}
        </div>
      )}
    </div>
  );
}

// (legacy helper removed; functionality in-component)
