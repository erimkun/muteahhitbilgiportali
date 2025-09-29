import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as Cesium from 'cesium';
import { useCesiumCtx } from '../../context/CesiumContext';
import { createApiUrl } from '../../config/api';

export default function BuildingPositioner() {
  const { 
    viewer, 
    activeTool, 
    setActiveTool,
    buildingTransform, 
    setBuildingTransform,
    buildingEntity,
    setBuildingEntity,
    setBuildingGizmos,
    projectId,
    projectCode
  } = useCesiumCtx();

  const [stepSize, setStepSize] = useState(1.0);
  const gizmoEntities = useRef([]);
  const buildingModelRef = useRef(null);
  const [placing, setPlacing] = useState(false);

  // Gizmo okları kaldırıldı (no-op placeholder)
  const createArrowGizmo = useCallback(() => null, []);

  // Update gizmo positions relative to building
  const updateGizmoPositions = useCallback((buildingPosition) => {
    if (!viewer || gizmoEntities.current.length === 0) return;

    const cartographic = Cesium.Cartographic.fromCartesian(buildingPosition);
    const lon = Cesium.Math.toDegrees(cartographic.longitude);
    const lat = Cesium.Math.toDegrees(cartographic.latitude);
    const height = cartographic.height;

    const gizmoOffset = 10; // meters from building center

    // Define gizmo positions
    const gizmoPositions = [
      { dir: 'X+', pos: Cesium.Cartesian3.fromDegrees(lon + 0.0001, lat, height), color: Cesium.Color.RED },
      { dir: 'X-', pos: Cesium.Cartesian3.fromDegrees(lon - 0.0001, lat, height), color: Cesium.Color.RED.darken(0.3, new Cesium.Color()) },
      { dir: 'Y+', pos: Cesium.Cartesian3.fromDegrees(lon, lat + 0.0001, height), color: Cesium.Color.GREEN },
      { dir: 'Y-', pos: Cesium.Cartesian3.fromDegrees(lon, lat - 0.0001, height), color: Cesium.Color.GREEN.darken(0.3, new Cesium.Color()) },
      { dir: 'Z+', pos: Cesium.Cartesian3.fromDegrees(lon, lat, height + gizmoOffset), color: Cesium.Color.BLUE },
      { dir: 'Z-', pos: Cesium.Cartesian3.fromDegrees(lon, lat, height - gizmoOffset), color: Cesium.Color.BLUE.darken(0.3, new Cesium.Color()) },
    ];

    // Update each gizmo position
    gizmoEntities.current.forEach((gizmo, index) => {
      if (gizmo && gizmoPositions[index]) {
        gizmo.shaft.position = gizmoPositions[index].pos;
        gizmo.head.position = gizmoPositions[index].pos;
      }
    });
  }, [viewer]);

  // Move building in specified direction
  const moveBuilding = useCallback((direction, distance = stepSize) => {
    if (!buildingEntity) return;

    const currentPos = buildingEntity.position.getValue();
    const cartographic = Cesium.Cartographic.fromCartesian(currentPos);
    let lon = Cesium.Math.toDegrees(cartographic.longitude);
    let lat = Cesium.Math.toDegrees(cartographic.latitude);
    let height = cartographic.height;

    // Calculate movement based on direction
    const movementScale = distance * 0.00001; // Convert to degrees (rough approximation)
    
    switch(direction) {
      case 'X+':
        lon += movementScale;
        break;
      case 'X-':
        lon -= movementScale;
        break;
      case 'Y+':
        lat += movementScale;
        break;
      case 'Y-':
        lat -= movementScale;
        break;
      case 'Z+':
        height += distance;
        break;
      case 'Z-':
        height -= distance;
        break;
    }

    // Update building position
    const newPosition = Cesium.Cartesian3.fromDegrees(lon, lat, height);
    buildingEntity.position = newPosition;

    // Update state
    setBuildingTransform(prev => ({
      ...prev,
      position: { lon, lat, height }
    }));

    // Update gizmo positions
    updateGizmoPositions(newPosition);
  }, [buildingEntity, setBuildingTransform, stepSize, updateGizmoPositions]);

  // Create building entity & gizmos ONCE when tool activated
  useEffect(() => {
    if (!viewer || activeTool !== 'building') return;
    if (!projectCode || !projectCode.trim()) return; // wait until project base is known
    if (buildingEntity) return; // already created
    if (!buildingTransform?.position) return; // Don't create if position is not available

    try {
      const position = Cesium.Cartesian3.fromDegrees(
        buildingTransform.position.lon,
        buildingTransform.position.lat,
        buildingTransform.position.height
      );
      const hpr = new Cesium.HeadingPitchRoll(
        Cesium.Math.toRadians(buildingTransform.rotation.heading),
        Cesium.Math.toRadians(buildingTransform.rotation.pitch),
        Cesium.Math.toRadians(buildingTransform.rotation.roll)
      );
      const orientation = Cesium.Transforms.headingPitchRollQuaternion(position, hpr);
      const base = `/${projectCode}_project`;
      const entity = viewer.entities.add({
        name: 'Building Model',
        position,
        orientation,
        show: buildingTransform.visible,
        model: {
          uri: `${base}/models/bina_model.gltf`,
          scale: buildingTransform.scale,
          minimumPixelSize: 64,
          maximumScale: 20000,
          incrementallyLoadTextures: false,
          runAnimations: false,
          clampAnimations: false,
          shadows: Cesium.ShadowMode.ENABLED,
          heightReference: Cesium.HeightReference.NONE,
          color: Cesium.Color.WHITE,
          colorBlendMode: Cesium.ColorBlendMode.HIGHLIGHT,
          colorBlendAmount: 0.5,
        }
      });
      buildingModelRef.current = entity;
      setBuildingEntity(entity);

      // Gizmos
      setBuildingGizmos(prev => ({ ...prev, entities: [] }));

      // Click handler (re-used, guarded by placing flag)
      const handler = viewer.screenSpaceEventHandler;
      handler.setInputAction((click) => {
        if (!(activeTool === 'building' && placing)) return; // only move while in placing mode
        const cartesian = viewer.scene.pickPosition(click.position);
        if(cartesian){
          const carto = Cesium.Cartographic.fromCartesian(cartesian);
          const lon = Cesium.Math.toDegrees(carto.longitude);
          const lat = Cesium.Math.toDegrees(carto.latitude);
          const height = carto.height;
          setBuildingTransform(prev => ({ ...prev, position: { lon, lat, height } }));
          setPlacing(false);
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    } catch (err) {
      console.error('Failed to init building tool', err);
    }

    return () => {
      // cleanup only when tool deactivates (activeTool change) or component unmounts
      // keep entity persistent; only clear refs
      gizmoEntities.current = [];
    };
  }, [viewer, activeTool, placing, buildingEntity, createArrowGizmo, moveBuilding, setBuildingEntity, setBuildingGizmos, setBuildingTransform, buildingTransform, projectCode]);

  // If projectCode changes and entity exists, update its model URI
  useEffect(() => {
    if (!buildingEntity || !projectCode || !projectCode.trim()) return;
    try{
      const base = `/${projectCode}_project`;
      if (buildingEntity.model) {
        buildingEntity.model.uri = `${base}/models/bina_model.gltf`;
      }
    }catch(_){ /* ignore */ }
  }, [projectCode, buildingEntity]);

  // Apply transform updates to existing entity (no recreation)
  useEffect(() => {
    if (!buildingEntity || !buildingTransform?.position || !buildingTransform?.rotation) return; // Add guard for position and rotation
    const position = Cesium.Cartesian3.fromDegrees(
      buildingTransform.position.lon,
      buildingTransform.position.lat,
      buildingTransform.position.height
    );
  buildingEntity.position = position;
    const hpr = new Cesium.HeadingPitchRoll(
      Cesium.Math.toRadians(buildingTransform.rotation.heading),
      Cesium.Math.toRadians(buildingTransform.rotation.pitch),
      Cesium.Math.toRadians(buildingTransform.rotation.roll)
    );
    buildingEntity.orientation = Cesium.Transforms.headingPitchRollQuaternion(position, hpr);
    if (buildingEntity.model) {
      buildingEntity.model.scale = buildingTransform.scale;
    }
    buildingEntity.show = buildingTransform.visible;
    updateGizmoPositions(position);
  }, [buildingEntity, buildingTransform?.position?.lon, buildingTransform?.position?.lat, buildingTransform?.position?.height, buildingTransform?.rotation?.heading, buildingTransform?.rotation?.pitch, buildingTransform?.rotation?.roll, buildingTransform?.scale, buildingTransform?.visible, updateGizmoPositions]);

  // Keyboard controls
  useEffect(() => {
    if (activeTool !== 'building') return;

    const handleKeyPress = (e) => {
      const shiftPressed = e.shiftKey;
      const ctrlPressed = e.ctrlKey;
      const currentStep = shiftPressed ? 0.1 : ctrlPressed ? 10 : stepSize;

      switch(e.key) {
        case 'ArrowRight':
          e.preventDefault();
          moveBuilding('X+', currentStep);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          moveBuilding('X-', currentStep);
          break;
        case 'ArrowUp':
          e.preventDefault();
          moveBuilding('Y+', currentStep);
          break;
        case 'ArrowDown':
          e.preventDefault();
          moveBuilding('Y-', currentStep);
          break;
        case 'PageUp':
          e.preventDefault();
          moveBuilding('Z+', currentStep);
          break;
        case 'PageDown':
          e.preventDefault();
          moveBuilding('Z-', currentStep);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [activeTool, stepSize, buildingEntity, moveBuilding]);

  if (activeTool !== 'building') return null;

  return (
    <div className="absolute top-20 right-4 z-20 bg-black/80 backdrop-blur-md p-4 rounded-xl border border-white/20 shadow-2xl w-80">
      <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
        <span className="text-2xl">🏢</span> Building Positioner
      </h3>
      <div className="flex gap-2 mb-4">
        <button onClick={()=>setPlacing(p=>!p)} className={`flex-1 px-2 py-1 rounded text-xs ${placing? 'bg-amber-600/80 hover:bg-amber-500':'bg-white/10 hover:bg-white/20'} text-white`}>
          {placing? 'Cancel Pick':'Pick Position'}
        </button>
        <button onClick={()=>setActiveTool(null)} className="px-2 py-1 rounded text-xs bg-white/10 hover:bg-white/20 text-white">Close</button>
      </div>
      
      {/* Position Controls */}
      <div className="space-y-3 mb-4">
        <div className="text-white/80 text-sm font-medium mb-2">Position Controls</div>
        
        {/* X Control */}
        <div className="flex items-center gap-2">
          <span className="text-white/60 text-xs w-16">X (E/W):</span>
          <button 
            onClick={() => moveBuilding('X-', stepSize)}
            className="px-2 py-1 bg-red-600/50 hover:bg-red-600/70 text-white rounded"
          >←</button>
          <input 
            type="number"
            value={buildingTransform?.position?.lon.toFixed(6) || ''}
            onChange={(e) => {
              const lon = parseFloat(e.target.value);
              if (!isNaN(lon)) {
                setBuildingTransform(prev => ({
                  ...prev,
                  position: { ...prev.position, lon }
                }));
                if (buildingEntity) {
                  const newPos = Cesium.Cartesian3.fromDegrees(
                    lon,
                    buildingTransform.position.lat,
                    buildingTransform.position.height
                  );
                  buildingEntity.position = newPos;
                  updateGizmoPositions(newPos);
                }
              }
            }}
            className="w-24 px-2 py-1 bg-white/10 text-white text-xs rounded"
          />
          <button 
            onClick={() => moveBuilding('X+', stepSize)}
            className="px-2 py-1 bg-red-600/50 hover:bg-red-600/70 text-white rounded"
          >→</button>
        </div>

        {/* Y Control */}
        <div className="flex items-center gap-2">
          <span className="text-white/60 text-xs w-16">Y (N/S):</span>
          <button 
            onClick={() => moveBuilding('Y-', stepSize)}
            className="px-2 py-1 bg-green-600/50 hover:bg-green-600/70 text-white rounded"
          >↓</button>
          <input 
            type="number"
            value={buildingTransform?.position?.lat.toFixed(6) || ''}
            onChange={(e) => {
              const lat = parseFloat(e.target.value);
              if (!isNaN(lat)) {
                setBuildingTransform(prev => ({
                  ...prev,
                  position: { ...prev.position, lat }
                }));
                if (buildingEntity) {
                  const newPos = Cesium.Cartesian3.fromDegrees(
                    buildingTransform.position.lon,
                    lat,
                    buildingTransform.position.height
                  );
                  buildingEntity.position = newPos;
                  updateGizmoPositions(newPos);
                }
              }
            }}
            className="w-24 px-2 py-1 bg-white/10 text-white text-xs rounded"
          />
          <button 
            onClick={() => moveBuilding('Y+', stepSize)}
            className="px-2 py-1 bg-green-600/50 hover:bg-green-600/70 text-white rounded"
          >↑</button>
        </div>

        {/* Z Control */}
        <div className="flex items-center gap-2">
          <span className="text-white/60 text-xs w-16">Z (Height):</span>
          <button 
            onClick={() => moveBuilding('Z-', stepSize)}
            className="px-2 py-1 bg-blue-600/50 hover:bg-blue-600/70 text-white rounded"
          >↓</button>
          <input 
            type="number"
            value={buildingTransform?.position?.height.toFixed(2) || ''}
            onChange={(e) => {
              const height = parseFloat(e.target.value);
              if (!isNaN(height)) {
                setBuildingTransform(prev => ({
                  ...prev,
                  position: { ...prev.position, height }
                }));
                if (buildingEntity) {
                  const newPos = Cesium.Cartesian3.fromDegrees(
                    buildingTransform.position.lon,
                    buildingTransform.position.lat,
                    height
                  );
                  buildingEntity.position = newPos;
                  updateGizmoPositions(newPos);
                }
              }
            }}
            className="w-24 px-2 py-1 bg-white/10 text-white text-xs rounded"
          />
          <button 
            onClick={() => moveBuilding('Z+', stepSize)}
            className="px-2 py-1 bg-blue-600/50 hover:bg-blue-600/70 text-white rounded"
          >↑</button>
        </div>

        {/* Step Size Control */}
        <div className="flex items-center gap-2 pt-2 border-t border-white/10">
          <span className="text-white/60 text-xs">Step Size:</span>
          <div className="flex gap-1">
            <button 
              onClick={() => setStepSize(0.1)}
              className={`px-2 py-1 text-xs rounded ${stepSize === 0.1 ? 'bg-indigo-600' : 'bg-white/20'} text-white`}
            >0.1m</button>
            <button 
              onClick={() => setStepSize(1)}
              className={`px-2 py-1 text-xs rounded ${stepSize === 1 ? 'bg-indigo-600' : 'bg-white/20'} text-white`}
            >1m</button>
            <button 
              onClick={() => setStepSize(10)}
              className={`px-2 py-1 text-xs rounded ${stepSize === 10 ? 'bg-indigo-600' : 'bg-white/20'} text-white`}
            >10m</button>
          </div>
        </div>
      </div>

      {/* Rotation Controls */}
      <div className="space-y-3 mb-4 border-t border-white/10 pt-3">
        <div className="text-white/80 text-sm font-medium mb-2">Rotation (degrees)</div>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-white/60 text-xs w-16">Heading:</span>
            <input 
              type="range" 
              min="0" 
              max="360" 
              value={buildingTransform.rotation.heading}
              onChange={(e) => {
                const heading = parseFloat(e.target.value);
                setBuildingTransform(prev => ({
                  ...prev,
                  rotation: { ...prev.rotation, heading }
                }));
                if (buildingEntity) {
                  const position = buildingEntity.position.getValue();
                  const hpr = new Cesium.HeadingPitchRoll(
                    Cesium.Math.toRadians(heading),
                    Cesium.Math.toRadians(buildingTransform.rotation.pitch),
                    Cesium.Math.toRadians(buildingTransform.rotation.roll)
                  );
                  buildingEntity.orientation = Cesium.Transforms.headingPitchRollQuaternion(position, hpr);
                }
              }}
              className="flex-1"
            />
            <span className="text-white text-xs w-10">{buildingTransform.rotation.heading}°</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-white/60 text-xs w-16">Pitch:</span>
            <input 
              type="range" 
              min="-90" 
              max="90" 
              value={buildingTransform.rotation.pitch}
              onChange={(e) => {
                const pitch = parseFloat(e.target.value);
                setBuildingTransform(prev => ({
                  ...prev,
                  rotation: { ...prev.rotation, pitch }
                }));
                if (buildingEntity) {
                  const position = buildingEntity.position.getValue();
                  const hpr = new Cesium.HeadingPitchRoll(
                    Cesium.Math.toRadians(buildingTransform.rotation.heading),
                    Cesium.Math.toRadians(pitch),
                    Cesium.Math.toRadians(buildingTransform.rotation.roll)
                  );
                  buildingEntity.orientation = Cesium.Transforms.headingPitchRollQuaternion(position, hpr);
                }
              }}
              className="flex-1"
            />
            <span className="text-white text-xs w-10">{buildingTransform.rotation.pitch}°</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-white/60 text-xs w-16">Roll:</span>
            <input 
              type="range" 
              min="-180" 
              max="180" 
              value={buildingTransform.rotation.roll}
              onChange={(e) => {
                const roll = parseFloat(e.target.value);
                setBuildingTransform(prev => ({
                  ...prev,
                  rotation: { ...prev.rotation, roll }
                }));
                if (buildingEntity) {
                  const position = buildingEntity.position.getValue();
                  const hpr = new Cesium.HeadingPitchRoll(
                    Cesium.Math.toRadians(buildingTransform.rotation.heading),
                    Cesium.Math.toRadians(buildingTransform.rotation.pitch),
                    Cesium.Math.toRadians(roll)
                  );
                  buildingEntity.orientation = Cesium.Transforms.headingPitchRollQuaternion(position, hpr);
                }
              }}
              className="flex-1"
            />
            <span className="text-white text-xs w-10">{buildingTransform.rotation.roll}°</span>
          </div>
        </div>
      </div>

      {/* Scale Control */}
      <div className="space-y-2 mb-4 border-t border-white/10 pt-3">
        <div className="flex items-center gap-2">
          <span className="text-white/60 text-xs w-16">Scale:</span>
          <input 
            type="range" 
            min="0.1" 
            max="10" 
            step="0.1"
            value={buildingTransform.scale}
            onChange={(e) => {
              const scale = parseFloat(e.target.value);
              setBuildingTransform(prev => ({ ...prev, scale }));
              if (buildingEntity && buildingEntity.model) {
                buildingEntity.model.scale = scale;
              }
            }}
            className="flex-1"
          />
          <span className="text-white text-xs w-10">{buildingTransform.scale.toFixed(1)}x</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button 
          onClick={() => {
            const defaultTransform = {
              position: { lon: 29.0098, lat: 41.0195, height: 10 },
              rotation: { heading: 0, pitch: 0, roll: 0 },
              scale: 1.0,
              visible: true
            };
            setBuildingTransform(defaultTransform);
            // Re-position building
            if (buildingEntity) {
              const newPos = Cesium.Cartesian3.fromDegrees(
                defaultTransform.position.lon,
                defaultTransform.position.lat,
                defaultTransform.position.height
              );
              buildingEntity.position = newPos;
              buildingEntity.orientation = Cesium.Transforms.headingPitchRollQuaternion(
                newPos,
                new Cesium.HeadingPitchRoll(0, 0, 0)
              );
              if (buildingEntity.model) {
                buildingEntity.model.scale = defaultTransform.scale;
              }
              updateGizmoPositions(newPos);
            }
          }}
          className="flex-1 px-3 py-2 bg-orange-600/50 hover:bg-orange-600/70 text-white text-sm rounded"
        >
          Reset
        </button>
        <button 
          onClick={() => {
            const data = {
              building_transform: buildingTransform,
              // We'll send empty values for the other fields for now
              tileset_clips: [],
              model_clip_planes: []
            };
            fetch(createApiUrl(`api/projects/${projectId}/model`), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              credentials: 'include',
              body: JSON.stringify(data),
            })
            .then(res => res.json())
            .then(response => {
              console.log('Building transform saved:', response);
              setActiveTool(null); // lock editing until user reopens tool
            })
            .catch(err => console.error('Failed to save building transform', err));
          }}
          className="flex-1 px-3 py-2 bg-green-600/50 hover:bg-green-600/70 text-white text-sm rounded"
        >
          {activeTool === 'building' ? 'Save & Lock' : 'Locked'}
        </button>
        <button 
          onClick={() => {
            setBuildingTransform(prev => ({ ...prev, visible: !prev.visible }));
            if (buildingEntity) {
              buildingEntity.show = !buildingEntity.show;
            }
            gizmoEntities.current.forEach(gizmo => {
              if (gizmo) {
                gizmo.shaft.show = !buildingEntity.show;
                gizmo.head.show = !buildingEntity.show;
              }
            });
          }}
          className="flex-1 px-3 py-2 bg-indigo-600/50 hover:bg-indigo-600/70 text-white text-sm rounded"
        >
          {buildingTransform.visible ? 'Hide' : 'Show'}
        </button>
      </div>

      {/* Help Text */}
      <div className="mt-3 pt-3 border-t border-white/10 text-white/40 text-xs">
  <p>• Pick Position açıkken haritaya sol tık modeli taşır.</p>
  <p>• Arrow keys: Move X/Y | PageUp/Down: Height</p>
        <p>• Shift: Fine (0.1m) | Ctrl: Coarse (10m)</p>
  <p>• Save & Lock veya Close sonrası sürükleme devre dışı.</p>
      </div>
    </div>
  );
}