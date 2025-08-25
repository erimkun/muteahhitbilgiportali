import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as Cesium from 'cesium';
import { useCesiumCtx } from '../../context/CesiumContext';

export default function LogoPositioner() {
  const {
    viewer,
    activeTool,
    setActiveTool,
    logoTransform,
    setLogoTransform,
    logoEntity,
    setLogoEntity,
  } = useCesiumCtx();

  const [stepSize, setStepSize] = useState(1.0);
  const [placing, setPlacing] = useState(false);
  // Removed custom heading rotation ticker; relying on glTF animations only

  const ensureLogoEntity = useCallback(() => {
    if (!viewer) return null;
    if (logoEntity) return logoEntity;
    if (!logoTransform?.position) return null;

    const position = Cesium.Cartesian3.fromDegrees(
      logoTransform.position.lon,
      logoTransform.position.lat,
      logoTransform.position.height
    );
    const hpr = new Cesium.HeadingPitchRoll(
      Cesium.Math.toRadians(logoTransform.rotation.heading || 0),
      Cesium.Math.toRadians(logoTransform.rotation.pitch || 0),
      Cesium.Math.toRadians(logoTransform.rotation.roll || 0)
    );
    const orientation = Cesium.Transforms.headingPitchRollQuaternion(position, hpr);
    const entity = viewer.entities.add({
      name: '360 Logo',
      position,
      orientation,
      show: logoTransform.visible !== false,
      model: {
        uri: '/360views/360logo.gltf',
        scale: logoTransform.scale || 1.0,
        minimumPixelSize: 0,
        maximumScale: 20000,
        incrementallyLoadTextures: false,
        runAnimations: true,
      },
    });
    setLogoEntity(entity);
    return entity;
  }, [viewer, logoEntity, logoTransform, setLogoEntity]);

  useEffect(() => {
    if (activeTool !== 'logo') return;
    ensureLogoEntity();
  }, [activeTool, ensureLogoEntity]);

  useEffect(() => {
    if (activeTool !== 'logo') return;
    if (!viewer) return;

    const handler = viewer.screenSpaceEventHandler;
    handler.setInputAction((click) => {
      if (!(activeTool === 'logo' && placing)) return;
      const cartesian = viewer.scene.pickPosition(click.position);
      if (cartesian) {
        const carto = Cesium.Cartographic.fromCartesian(cartesian);
        const lon = Cesium.Math.toDegrees(carto.longitude);
        const lat = Cesium.Math.toDegrees(carto.latitude);
        const height = carto.height;
        setLogoTransform((prev) => ({ ...prev, position: { lon, lat, height } }));
        setPlacing(false);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      if (!viewer || viewer.isDestroyed()) return;
      // do not remove entity here; persist across tool toggles
    };
  }, [viewer, activeTool, placing, setLogoTransform]);

  // Apply transform updates to existing entity
  useEffect(() => {
    if (!logoEntity || !logoTransform?.position) return;
    const position = Cesium.Cartesian3.fromDegrees(
      logoTransform.position.lon,
      logoTransform.position.lat,
      logoTransform.position.height
    );
    logoEntity.position = position;
    const hpr = new Cesium.HeadingPitchRoll(
      Cesium.Math.toRadians(logoTransform.rotation.heading || 0),
      Cesium.Math.toRadians(logoTransform.rotation.pitch || 0),
      Cesium.Math.toRadians(logoTransform.rotation.roll || 0)
    );
    logoEntity.orientation = Cesium.Transforms.headingPitchRollQuaternion(position, hpr);
    if (logoEntity.model) {
      logoEntity.model.scale = logoTransform.scale || 1.0;
      logoEntity.model.runAnimations = true;
    }
    logoEntity.show = logoTransform.visible !== false;
  }, [logoEntity, logoTransform]);

  const moveLogo = useCallback((direction, distance = stepSize) => {
    if (!viewer || !logoTransform?.position) return;

    // Current cartesian and cartographic
    const currentCartesian = Cesium.Cartesian3.fromDegrees(
      logoTransform.position.lon,
      logoTransform.position.lat,
      logoTransform.position.height
    );
    const carto = Cesium.Cartographic.fromCartesian(currentCartesian);

    // Build local ENU frame to move in meters accurately
    const enu = Cesium.Transforms.eastNorthUpToFixedFrame(
      Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, carto.height)
    );
    const east = Cesium.Matrix4.getColumn(enu, 0, new Cesium.Cartesian3());
    const north = Cesium.Matrix4.getColumn(enu, 1, new Cesium.Cartesian3());
    const up = Cesium.Matrix4.getColumn(enu, 2, new Cesium.Cartesian3());
    Cesium.Cartesian3.normalize(east, east);
    Cesium.Cartesian3.normalize(north, north);
    Cesium.Cartesian3.normalize(up, up);

    const moveVec = new Cesium.Cartesian3(0,0,0);
    if (direction === 'X+' || direction === 'X-') {
      const s = direction === 'X+' ? distance : -distance;
      Cesium.Cartesian3.add(moveVec, Cesium.Cartesian3.multiplyByScalar(east, s, new Cesium.Cartesian3()), moveVec);
    } else if (direction === 'Y+' || direction === 'Y-') {
      const s = direction === 'Y+' ? distance : -distance;
      Cesium.Cartesian3.add(moveVec, Cesium.Cartesian3.multiplyByScalar(north, s, new Cesium.Cartesian3()), moveVec);
    } else if (direction === 'Z+' || direction === 'Z-') {
      const s = direction === 'Z+' ? distance : -distance;
      Cesium.Cartesian3.add(moveVec, Cesium.Cartesian3.multiplyByScalar(up, s, new Cesium.Cartesian3()), moveVec);
    }

    const newCartesian = Cesium.Cartesian3.add(currentCartesian, moveVec, new Cesium.Cartesian3());
    const newCarto = Cesium.Cartographic.fromCartesian(newCartesian);

    const lon = Cesium.Math.toDegrees(newCarto.longitude);
    const lat = Cesium.Math.toDegrees(newCarto.latitude);
    const height = newCarto.height;

    setLogoTransform((prev) => ({ ...prev, position: { lon, lat, height } }));
    if (logoEntity) {
      logoEntity.position = newCartesian;
    }
  }, [viewer, logoEntity, logoTransform?.position, setLogoTransform, stepSize]);

  // Custom heading rotation removed

  // Keyboard controls
  useEffect(() => {
    if (activeTool !== 'logo') return;
    const handle = (e) => {
      const shiftPressed = e.shiftKey;
      const ctrlPressed = e.ctrlKey;
      const currentStep = shiftPressed ? 0.1 : ctrlPressed ? 10 : stepSize;
      switch(e.key) {
        case 'ArrowRight': e.preventDefault(); moveLogo('X+', currentStep); break;
        case 'ArrowLeft':  e.preventDefault(); moveLogo('X-', currentStep); break;
        case 'ArrowUp':    e.preventDefault(); moveLogo('Y+', currentStep); break;
        case 'ArrowDown':  e.preventDefault(); moveLogo('Y-', currentStep); break;
        case 'PageUp':     e.preventDefault(); moveLogo('Z+', currentStep); break;
        case 'PageDown':   e.preventDefault(); moveLogo('Z-', currentStep); break;
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [activeTool, stepSize, moveLogo]);

  if (activeTool !== 'logo') return null;

  return (
    <div className="absolute top-20 right-4 z-20 bg-black/80 backdrop-blur-md p-4 rounded-xl border border-white/20 shadow-2xl w-80 max-h-[85vh] overflow-auto">
      <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
        <span className="text-2xl">📍</span> 360 Logo Positioner
      </h3>
      <div className="flex gap-2 mb-4">
        <button onClick={() => setPlacing((p) => !p)} className={`flex-1 px-2 py-1 rounded text-xs ${placing ? 'bg-amber-600/80 hover:bg-amber-500' : 'bg-white/10 hover:bg-white/20'} text-white`}>
          {placing ? 'Cancel Pick' : 'Pick Position'}
        </button>
        <button onClick={() => setActiveTool(null)} className="px-2 py-1 rounded text-xs bg-white/10 hover:bg-white/20 text-white">Close</button>
      </div>

      <div className="space-y-3 mb-4">
        <div className="text-white/80 text-sm font-medium mb-2">Position</div>
        <div className="flex items-center gap-2">
          <span className="text-white/60 text-xs w-16">Lon:</span>
          <input type="number" value={logoTransform?.position?.lon?.toFixed(6) || ''} onChange={(e)=>{
            const lon = parseFloat(e.target.value);
            if (!isNaN(lon)) setLogoTransform(prev=>({...prev, position:{...prev.position, lon}}));
          }} className="w-28 px-2 py-1 bg-white/10 text-white text-xs rounded" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/60 text-xs w-16">Lat:</span>
          <input type="number" value={logoTransform?.position?.lat?.toFixed(6) || ''} onChange={(e)=>{
            const lat = parseFloat(e.target.value);
            if (!isNaN(lat)) setLogoTransform(prev=>({...prev, position:{...prev.position, lat}}));
          }} className="w-28 px-2 py-1 bg-white/10 text-white text-xs rounded" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/60 text-xs w-16">Height:</span>
          <input type="number" value={logoTransform?.position?.height?.toFixed(2) || ''} onChange={(e)=>{
            const height = parseFloat(e.target.value);
            if (!isNaN(height)) setLogoTransform(prev=>({...prev, position:{...prev.position, height}}));
          }} className="w-28 px-2 py-1 bg-white/10 text-white text-xs rounded" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={()=>moveLogo('X-', stepSize)} className="px-2 py-1 bg-red-600/50 hover:bg-red-600/70 text-white rounded">←E</button>
          <button onClick={()=>moveLogo('X+', stepSize)} className="px-2 py-1 bg-red-600/50 hover:bg-red-600/70 text-white rounded">E→</button>
          <button onClick={()=>moveLogo('Y-', stepSize)} className="px-2 py-1 bg-green-600/50 hover:bg-green-600/70 text-white rounded">↓N</button>
          <button onClick={()=>moveLogo('Y+', stepSize)} className="px-2 py-1 bg-green-600/50 hover:bg-green-600/70 text-white rounded">N↑</button>
          <button onClick={()=>moveLogo('Z-', stepSize)} className="px-2 py-1 bg-blue-600/50 hover:bg-blue-600/70 text-white rounded">↓H</button>
          <button onClick={()=>moveLogo('Z+', stepSize)} className="px-2 py-1 bg-blue-600/50 hover:bg-blue-600/70 text-white rounded">H↑</button>
        </div>
        <div className="flex items-center gap-2 pt-2 border-t border-white/10">
          <span className="text-white/60 text-xs">Step:</span>
          <div className="flex flex-wrap gap-1">
            <button onClick={()=>setStepSize(0.1)} className={`px-2 py-1 text-xs rounded ${stepSize===0.1?'bg-indigo-600':'bg-white/20'} text-white`}>0.1m</button>
            <button onClick={()=>setStepSize(1)} className={`px-2 py-1 text-xs rounded ${stepSize===1?'bg-indigo-600':'bg-white/20'} text-white`}>1m</button>
            <button onClick={()=>setStepSize(10)} className={`px-2 py-1 text-xs rounded ${stepSize===10?'bg-indigo-600':'bg-white/20'} text-white`}>10m</button>
          </div>
        </div>
      </div>

      <div className="space-y-3 mb-4 border-t border-white/10 pt-3">
        <div className="text-white/80 text-sm font-medium mb-2">Rotation (deg)</div>
        <div className="flex items-center gap-2">
          <span className="text-white/60 text-xs w-16">Heading:</span>
          <input type="range" min="0" max="360" value={logoTransform.rotation.heading} onChange={(e)=>{
            const heading = parseFloat(e.target.value);
            setLogoTransform(prev=>({...prev, rotation:{...prev.rotation, heading}}));
          }} className="flex-1" />
          <span className="text-white text-xs w-10">{logoTransform.rotation.heading}°</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/60 text-xs w-16">Pitch:</span>
          <input type="range" min="-90" max="90" value={logoTransform.rotation.pitch} onChange={(e)=>{
            const pitch = parseFloat(e.target.value);
            setLogoTransform(prev=>({...prev, rotation:{...prev.rotation, pitch}}));
          }} className="flex-1" />
          <span className="text-white text-xs w-10">{logoTransform.rotation.pitch}°</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/60 text-xs w-16">Roll:</span>
          <input type="range" min="-180" max="180" value={logoTransform.rotation.roll} onChange={(e)=>{
            const roll = parseFloat(e.target.value);
            setLogoTransform(prev=>({...prev, rotation:{...prev.rotation, roll}}));
          }} className="flex-1" />
          <span className="text-white text-xs w-10">{logoTransform.rotation.roll}°</span>
        </div>
      </div>

      <div className="space-y-2 mb-4 border-t border-white/10 pt-3">
        <div className="flex items-center gap-2">
          <span className="text-white/60 text-xs w-16">Scale:</span>
          <input type="range" min="0.1" max="100" step="0.1" value={logoTransform.scale} onChange={(e)=>{
            const scale = parseFloat(e.target.value);
            setLogoTransform(prev=>({...prev, scale }));
            if (logoEntity && logoEntity.model) logoEntity.model.scale = scale;
          }} className="flex-1" />
          <span className="text-white text-xs w-12 text-right">{logoTransform.scale.toFixed(1)}x</span>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={()=>{
          const def = {
            position: { lon: 29.012235802551594, lat: 41.02024565473916, height: 101.20504635558787 },
            rotation: { heading: 0, pitch: 0, roll: 0 },
            scale: 1.0,
            visible: true,
          };
          setLogoTransform(def);
          const pos = Cesium.Cartesian3.fromDegrees(def.position.lon, def.position.lat, def.position.height);
          if (logoEntity) {
            logoEntity.position = pos;
            logoEntity.orientation = Cesium.Transforms.headingPitchRollQuaternion(pos, new Cesium.HeadingPitchRoll(0,0,0));
            if (logoEntity.model) logoEntity.model.scale = def.scale;
          } else {
            ensureLogoEntity();
          }
        }} className="flex-1 px-3 py-2 bg-orange-600/50 hover:bg-orange-600/70 text-white text-sm rounded">Reset</button>
        <button onClick={()=>{
          setLogoTransform(prev=>({ ...prev, visible: !prev.visible }));
          if (logoEntity) logoEntity.show = !logoEntity.show;
        }} className="flex-1 px-3 py-2 bg-indigo-600/50 hover:bg-indigo-600/70 text-white text-sm rounded">{logoTransform.visible ? 'Hide' : 'Show'}</button>
      </div>

      <div className="mt-3 pt-3 border-t border-white/10 text-white/40 text-xs">
        <p>• Pick Position açıkken haritaya sol tık modeli taşır.</p>
        <p>• Arrow keys: Move X/Y | PageUp/Down: Height</p>
        <p>• Shift: 0.1m | Ctrl: 10m</p>
      </div>
    </div>
  );
}
