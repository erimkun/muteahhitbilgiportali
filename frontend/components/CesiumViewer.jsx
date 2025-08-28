import React, { useRef, useEffect, useState } from 'react';
import { useCesiumCtx } from '../context/CesiumContext';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import MeasurementTools from './MeasurementTools';

export default function CesiumViewer({ projectId = 1 }) {
  const { projectCode } = useCesiumCtx?.() || { projectCode: '' };
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const buildingEntityRef = useRef(null);
  const [viewer, setViewer] = useState(null);
  const [cameraViews, setCameraViews] = useState({ home: null, panel: null, corner: null });
  const logoEntityRef = useRef(null);
  const logoBaseRotationRef = useRef({ heading: 0, pitch: 0, roll: 0 });
  const logoTickRef = useRef(null);
  const logoLastTimeRef = useRef(null);
  const tilesetReadyRef = useRef(false);

  // Fallbacks if settings missing
  const DEFAULT_VIEW = {
    destination: Cesium.Cartesian3.fromDegrees(29.0, 41.0, 500),
    orientation: { heading: Cesium.Math.toRadians(0), pitch: Cesium.Math.toRadians(-30), roll: 0 }
  };

  const fly = (view) => {
    const v = viewerRef.current;
    if (!v || v.isDestroyed()) return;
    v.camera.flyTo({ ...view, duration: 2, easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT });
  };

  useEffect(() => {
    if (!containerRef.current) return;
    if (!projectCode || !projectCode.trim()) return; // wait until projectCode is loaded
    let mounted = true;
    const wantRealWorld = true;
    const hideStars = true;
    const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN || '';
    if (ionToken) Cesium.Ion.defaultAccessToken = ionToken;

    const viewer = new Cesium.Viewer(containerRef.current, {
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      infoBox: true,
      selectionIndicator: true,
      shadows: false,
      scene3DOnly: true,
      vrButton: false,
      imageryProvider: false,
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
    });
    viewerRef.current = viewer;
    setViewer(viewer);
    // Ensure animations advance (required for glTF animations)
    viewer.clock.shouldAnimate = true;

    // Expose viewer to console for debugging
    window.cesiumViewer = viewer;

    // Add keyboard shortcut to get camera position/orientation
    const getCameraInfo = () => {
      const camera = viewer.camera;
      const position = camera.position;
      const cartographic = Cesium.Cartographic.fromCartesian(position);
      const longitude = Cesium.Math.toDegrees(cartographic.longitude);
      const latitude = Cesium.Math.toDegrees(cartographic.latitude);
      const height = cartographic.height;
      
      const heading = Cesium.Math.toDegrees(camera.heading);
      const pitch = Cesium.Math.toDegrees(camera.pitch);
      const roll = Cesium.Math.toDegrees(camera.roll);
      
      const cameraInfo = {
        destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
        orientation: { 
          heading: Cesium.Math.toRadians(heading), 
          pitch: Cesium.Math.toRadians(pitch), 
          roll: Cesium.Math.toRadians(roll) 
        }
      };
      
      console.log('=== Current Camera Position & Orientation ===');
      console.log('Longitude:', longitude);
      console.log('Latitude:', latitude);
      console.log('Height:', height);
      console.log('Heading (degrees):', heading);
      console.log('Pitch (degrees):', pitch);
      console.log('Roll (degrees):', roll);
      console.log('\n=== Copy this for camera view constants ===');
      console.log('const CAMERA_VIEW = {');
      console.log(`  destination: Cesium.Cartesian3.fromDegrees(${longitude}, ${latitude}, ${height}),`);
      console.log(`  orientation: { heading: Cesium.Math.toRadians(${heading.toFixed(2)}), pitch: Cesium.Math.toRadians(${pitch.toFixed(2)}), roll: ${roll} }`);
      console.log('};');
      
      return cameraInfo;
    };

    // Add keyboard event listener for 'C' key to get camera info
    const handleKeyPress = (event) => {
      if (event.key === 'c' || event.key === 'C') {
        getCameraInfo();
      }
    };

    // Expose getCameraInfo function globally
    window.getCameraInfo = getCameraInfo;
    
    document.addEventListener('keydown', handleKeyPress);

    if (hideStars) {
      viewer.scene.skyBox.show = false;
      viewer.scene.sun.show = false;
      viewer.scene.moon.show = false;
      viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#434347');
      viewer.scene.skyAtmosphere.show = wantRealWorld;
    }
    
    // Sadece güneş ışığını kapat (binaya güncel saate göre ışık vurmasını engeller)
    viewer.scene.sun.show = false;
    if (!wantRealWorld) viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#434347');

    // Home view'a git (eğer yoksa default view kullan)
    const initialView = cameraViews.home || DEFAULT_VIEW;
    viewer.camera.setView(initialView);

    // Try to load per-project camera presets for all views
    (async () => {
      try{
        const res = await fetch(`http://localhost:3001/api/projects/${projectId}/settings`);
        if(!res.ok) return;
        const js = await res.json();
        const s = js && js.data ? js.data : null;
        const toView = (src) => {
          try{
            if (!src) return null;
            const cv = JSON.parse(src);
            if (cv && cv.destination && cv.orientation){
              return {
                destination: Cesium.Cartesian3.fromDegrees(cv.destination.lon, cv.destination.lat, cv.destination.height),
                orientation: {
                  heading: Cesium.Math.toRadians(cv.orientation.headingDeg || 0),
                  pitch: Cesium.Math.toRadians(cv.orientation.pitchDeg || -30),
                  roll: Cesium.Math.toRadians(cv.orientation.roll || 0)
                }
              };
            }
            return null;
          }catch(_){ return null; }
        };
        setCameraViews({
          home: toView(s?.home_camera_view) || null,
          panel: toView(s?.panel_camera_view) || null,
          corner: toView(s?.corner_camera_view) || null,
        });
      }catch(_){ /* ignore */ }
    })();

    (async () => {
      if (!wantRealWorld) return;
      try {
        let imagery;
        if (ionToken) {
          imagery = await Cesium.IonImageryProvider.fromAssetId(2);
          const terrain = await Cesium.CesiumTerrainProvider.fromIonAssetId(1, { requestVertexNormals: true, requestWaterMask: true });
          if (mounted) viewer.terrainProvider = terrain;
        } else {
          console.warn('[Cesium] Missing ion token – using OpenStreetMap + ellipsoid.');
          imagery = new Cesium.OpenStreetMapImageryProvider({ url: 'https://tile.openstreetmap.org/' });
        }
        if (mounted) {
          viewer.imageryLayers.removeAll();
            viewer.imageryLayers.addImageryProvider(imagery);
        }
      } catch (e) { console.error('Imagery/Terrain init failed', e); }
    })();

  // Determine project-specific asset paths (require projectCode)
  const base = `/${projectCode}_project`;
  const projectTilesetUrl = `${base}/tiles/sezyum_${projectCode}.json`;

  Cesium.Cesium3DTileset.fromUrl(projectTilesetUrl, {
      maximumScreenSpaceError: 0,
      skipLevelOfDetail: false,
      baseScreenSpaceError: 0,
      skipScreenSpaceErrorFactor: 0,
      skipLevels: 0,
      immediatelyLoadDesiredLevelOfDetail: true,
      loadSiblings: true,
      cullWithChildrenBounds: true,
      dynamicScreenSpaceError: false,
      maximumMemoryUsage: 4096,
      preloadWhenHidden: true,
      preferLeaves: true,
      progressiveResolutionHeightFraction: 0,
      foveatedScreenSpaceError: false,
      foveatedConeSize: 0,
      foveatedMinimumScreenSpaceErrorRelaxation: 0.0,
      cullRequestsWhileMoving: false,
      cullRequestsWhileMovingMultiplier: 0,
      preloadFlightDestinations: true,
      dynamicScreenSpaceErrorDensity: 0,
      dynamicScreenSpaceErrorFactor: 0,
      dynamicScreenSpaceErrorHeightFalloff: 0
    }).then(ts => {
      if (!mounted) return;
      tilesetReadyRef.current = true;
      viewer.scene.primitives.add(ts);
      viewer.zoomTo(ts).then(() => {
        const initialView = cameraViews.home || DEFAULT_VIEW;
        fly(initialView);
      });
      // Fetch and apply published model data
      fetch(`http://localhost:3001/api/projects/${projectId}/model/published`)
        .then(res => res.json())
        .then(response => {
          const modelData = response.data;
          if (!modelData) return;

          // Apply tileset clipping polygons
          try {
            const clips = JSON.parse(modelData.tileset_clips);
            if (Array.isArray(clips) && clips.length > 0) {
              const polygons = clips.map(posArr => new Cesium.ClippingPolygon({ positions: posArr.map(p => new Cesium.Cartesian3(p.x, p.y, p.z)) }));
              ts.clippingPolygons = new Cesium.ClippingPolygonCollection({ polygons, unionClippingRegions: true, edgeColor: Cesium.Color.CYAN, edgeWidth: 1 });
            }
          } catch (e) { console.warn('Apply published tileset clips failed', e); }

          // Load building model
          try {
            // Safely parse transform; if missing, place at tileset center by default
            let transform = null;
            try {
              transform = modelData?.building_transform ? JSON.parse(modelData.building_transform) : null;
            } catch (_e) { transform = null; }

            if (!transform) {
              const centerCart = Cesium.Cartographic.fromCartesian(ts.boundingSphere.center);
              const defaultLon = Cesium.Math.toDegrees(centerCart.longitude);
              const defaultLat = Cesium.Math.toDegrees(centerCart.latitude);
              const defaultHeight = centerCart.height || 0.0;
              transform = {
                position: { lon: defaultLon, lat: defaultLat, height: defaultHeight },
                rotation: { heading: 0, pitch: 0, roll: 0 },
                scale: 1.0,
                visible: true
              };
            }
            if (!transform.visible) return;

            const position = Cesium.Cartesian3.fromDegrees(transform.position.lon, transform.position.lat, transform.position.height);
            const hpr = new Cesium.HeadingPitchRoll(
              Cesium.Math.toRadians(transform.rotation.heading),
              Cesium.Math.toRadians(transform.rotation.pitch),
              Cesium.Math.toRadians(transform.rotation.roll)
            );
            const orientation = Cesium.Transforms.headingPitchRollQuaternion(position, hpr);
            const buildingEntity = viewer.entities.add({
              name: 'Building Model',
              position: position,
              orientation: orientation,
              model: {
                uri: `${base}/models/erimBaked.gltf`,
                scale: transform.scale,
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
            buildingEntityRef.current = buildingEntity;

            // Apply model clipping planes
            try {
              const planes = JSON.parse(modelData.model_clip_planes);
              if (Array.isArray(planes) && planes.length > 0) {
                buildingEntity.model.clippingPlanes = new Cesium.ClippingPlaneCollection({
                  planes: planes.map(pl => new Cesium.ClippingPlane(new Cesium.Cartesian3(pl.normal.x, pl.normal.y, pl.normal.z), pl.distance)),
                  unionClippingRegions: true,
                  edgeColor: Cesium.Color.CYAN,
                  edgeWidth: 1.0
                });
              }
            } catch (e) { console.warn('Apply published model clip planes failed', e); }
          } catch (e) { console.error('Failed to load building model:', e); }

          // Load 360 logo model (if logo_transform present)
          try {
            const logoTransform = JSON.parse(modelData.logo_transform || '{}');
            if (logoTransform && logoTransform.position && logoTransform.visible !== false) {
              const logoPosition = Cesium.Cartesian3.fromDegrees(
                logoTransform.position.lon,
                logoTransform.position.lat,
                logoTransform.position.height
              );
              const logoHpr = new Cesium.HeadingPitchRoll(
                Cesium.Math.toRadians(logoTransform.rotation?.heading || 0),
                Cesium.Math.toRadians(logoTransform.rotation?.pitch || 0),
                Cesium.Math.toRadians(logoTransform.rotation?.roll || 0)
              );
              const logoOrientation = Cesium.Transforms.headingPitchRollQuaternion(logoPosition, logoHpr);
              const logoEnt = viewer.entities.add({
                name: '360 Logo',
                position: logoPosition,
                orientation: logoOrientation,
                model: {
                  uri: `${base}/360views/360logo.gltf`,
                  scale: logoTransform.scale || 1.0,
                  minimumPixelSize: 0,
                  maximumScale: 200000,
                  incrementallyLoadTextures: false,
                  runAnimations: true,
                }
              });
              logoEntityRef.current = logoEnt;
              // Removed custom auto-rotation; rely on glTF's own animations if any
            }
          } catch (e) { console.warn('Failed to load 360 logo model:', e); }
        })
        .catch(err => console.error('Failed to fetch published model data', err));
    }).catch(err => {
      console.error('Tileset load error', err);
      console.error('Tried URL:', projectTilesetUrl);
    });

    // Set up click handler for 360 Logo to open pano overlay
    const clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    clickHandler.setInputAction((movement) => {
      const picked = viewer.scene.pick(movement.position);
      if (Cesium.defined(picked) && picked.id && picked.id === logoEntityRef.current) {
        window.dispatchEvent(new Event('openPano'));
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      mounted = false;
      document.removeEventListener('keydown', handleKeyPress);
      if (buildingEntityRef.current && viewer && !viewer.isDestroyed()) {
        viewer.entities.remove(buildingEntityRef.current);
      }
      if (logoTickRef.current && viewer && !viewer.isDestroyed()) {
        viewer.clock.onTick.removeEventListener(logoTickRef.current);
        logoTickRef.current = null;
      }
      if (clickHandler && !viewer.isDestroyed()) {
        clickHandler.destroy();
      }
      if (!viewer.isDestroyed()) viewer.destroy();
      viewerRef.current = null;
      setViewer(null);
      // Clean up global references
      if (window.cesiumViewer === viewer) window.cesiumViewer = null;
      if (window.getCameraInfo) window.getCameraInfo = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, projectCode]);

  // When camera views load after tileset, fly to home view once
  useEffect(() => {
    if (!viewerRef.current || !tilesetReadyRef.current) return;
    if (cameraViews.home) fly(cameraViews.home);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraViews.home]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" style={{ backgroundColor: '#1a1a1a' }} />
      
      {/* Measurement Tools - Left Side */}
      <MeasurementTools viewer={viewer} />
      
      {/* Camera View Buttons - Right Middle */}
      <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex flex-col gap-3 z-10">
        <button onClick={() => fly(cameraViews.home || DEFAULT_VIEW)} className="bg-slate-900/60 hover:ring-1 hover:ring-white/10 border border-slate-700/70 hover:border-slate-600 rounded-full w-10 h-10 flex items-center justify-center shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105" title="Ana Görünüm">
          <i className="fas fa-home text-white text-lg transition-colors duration-200" />
        </button>
        <button onClick={() => fly(cameraViews.panel || cameraViews.home || DEFAULT_VIEW)} className="bg-slate-900/60 hover:ring-1 hover:ring-white/10 border border-slate-700/70 hover:border-slate-600 rounded-full w-10 h-10 flex items-center justify-center shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105" title="Kenar Görünüm">
          <i className="fas fa-columns text-white text-lg transition-colors duration-200" />
        </button>
        <button onClick={() => fly(cameraViews.corner || cameraViews.home || DEFAULT_VIEW)} className="bg-slate-900/60 hover:ring-1 hover:ring-white/10 border border-slate-700/70 hover:border-slate-600 rounded-full w-10 h-10 flex items-center justify-center shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105" title="Köşe Görünüm">
          <i className="fas fa-cube text-white text-lg transition-colors duration-200" />
        </button>
      </div>
    </div>
  );
}
