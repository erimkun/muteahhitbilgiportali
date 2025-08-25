import React, { useRef, useEffect } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { useCesiumCtx } from '../../context/CesiumContext';

export default function AdminViewer() {
  const containerRef = useRef(null);
  const { registerViewer, registerTileset, setBuildingEntity, setBuildingTransform, setLogoEntity, setLogoTransform } = useCesiumCtx();

  useEffect(() => {
    if (!containerRef.current) return;

    Cesium.Ion.defaultAccessToken = '';

    const useRealWorldGlobe = true;
    const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN || '';
    Cesium.Ion.defaultAccessToken = ionToken;

    const viewer = new Cesium.Viewer(containerRef.current, useRealWorldGlobe ? {
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
      imageryProvider: new Cesium.OpenStreetMapImageryProvider({ url: 'https://a.tile.openstreetmap.org/' }),
      terrainProvider: ionToken ? Cesium.CesiumTerrainProvider.fromIonAssetId(1) : new Cesium.EllipsoidTerrainProvider(),
    } : {
      imageryProvider: false,
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
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
    });

    const hideStars = true;
    if (hideStars) {
      viewer.scene.skyBox.show = false;
      viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#101012');
      viewer.scene.sun.show = false;
      viewer.scene.moon.show = false;
      viewer.scene.skyAtmosphere.show = false;
    }
    if (!useRealWorldGlobe) {
      viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#141414');
    }

    registerViewer(viewer);
  // Expose for debugging
  window.__ADMIN_VIEWER = viewer;
  viewer.scene.globe.depthTestAgainstTerrain = true;

    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(29.0, 41.0, 500)
    });

    let disposed = false;

  Cesium.Cesium3DTileset.fromUrl('/tiles/sezyum_400_111.json', {
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
    }).then(tileset => {
      if (disposed) return;
      viewer.scene.primitives.add(tileset);
      registerTileset(tileset);
      viewer.zoomTo(tileset);
  // Expose tileset globally for debugging
  window.__ADMIN_TILESET = tileset;
      // Apply published tileset clipping polygons if exist
      // Load latest model data from the server
      fetch('http://localhost:3001/api/model/latest')
        .then(res => res.json())
        .then(response => {
          const modelData = response.data;
          if (!modelData) return;

          // Apply tileset clipping polygons
          try {
            const clips = JSON.parse(modelData.tileset_clips);
            if (Array.isArray(clips) && clips.length > 0) {
              const polygons = clips.map(posArr => new Cesium.ClippingPolygon({ positions: posArr.map(p => new Cesium.Cartesian3(p.x, p.y, p.z)) }));
              tileset.clippingPolygons = new Cesium.ClippingPolygonCollection({ polygons, unionClippingRegions: true, edgeColor: Cesium.Color.CYAN, edgeWidth: 1 });
            }
          } catch (e) { console.warn('[AdminViewer] apply tileset clips fail', e); }

          // Load building model
          try {
            const transform = JSON.parse(modelData.building_transform) || {
              position: { lon: 29.0098, lat: 41.0195, height: 10 },
              rotation: { heading: 0, pitch: 0, roll: 0 },
              scale: 1.0,
              visible: true
            };
            setBuildingTransform(transform);
            if (!transform.visible) return;
            const pos = Cesium.Cartesian3.fromDegrees(transform.position.lon, transform.position.lat, transform.position.height);
            const hpr = new Cesium.HeadingPitchRoll(
              Cesium.Math.toRadians(transform.rotation.heading),
              Cesium.Math.toRadians(transform.rotation.pitch),
              Cesium.Math.toRadians(transform.rotation.roll)
            );
            const orientation = Cesium.Transforms.headingPitchRollQuaternion(pos, hpr);
            const entity = viewer.entities.add({
              name: 'Building Model',
              position: pos,
              orientation,
              show: transform.visible,
              model: {
                uri: '/400_111/erimBaked.gltf',
                scale: transform.scale,
                minimumPixelSize: 64,
                maximumScale: 20000,
                incrementallyLoadTextures: false,
                runAnimations: false,
                clampAnimations: false,
                shadows: Cesium.ShadowMode.ENABLED,
                heightReference: Cesium.HeightReference.NONE,
                //color: Cesium.Color.WHITE,
                //colorBlendMode: Cesium.ColorBlendMode.HIGHLIGHT,
                //colorBlendAmount: 0.5,
              }
            });
            setBuildingEntity(entity);

            // Apply model clipping planes
            try {
              const planes = JSON.parse(modelData.model_clip_planes);
              if (Array.isArray(planes) && planes.length > 0) {
                entity.model.clippingPlanes = new Cesium.ClippingPlaneCollection({
                  planes: planes.map(pl => new Cesium.ClippingPlane(new Cesium.Cartesian3(pl.normal.x, pl.normal.y, pl.normal.z), pl.distance)),
                  unionClippingRegions: true,
                  edgeColor: Cesium.Color.CYAN,
                  edgeWidth: 1.0
                });
              }
            } catch (e) { console.warn('[AdminViewer] apply model clip planes fail', e); }
          } catch (e) { console.warn('[AdminViewer] load building model fail', e); }

          // Load 360 logo model (if logo_transform present)
          try {
            const logoTransform = JSON.parse(modelData.logo_transform || '{}');
            if (logoTransform && logoTransform.position) {
              setLogoTransform(logoTransform);
              if (logoTransform.visible !== false) {
                const logoPos = Cesium.Cartesian3.fromDegrees(logoTransform.position.lon, logoTransform.position.lat, logoTransform.position.height);
                const logoHpr = new Cesium.HeadingPitchRoll(
                  Cesium.Math.toRadians(logoTransform.rotation?.heading || 0),
                  Cesium.Math.toRadians(logoTransform.rotation?.pitch || 0),
                  Cesium.Math.toRadians(logoTransform.rotation?.roll || 0)
                );
                const logoOri = Cesium.Transforms.headingPitchRollQuaternion(logoPos, logoHpr);
                const logoEnt = viewer.entities.add({
                  name: '360 Logo',
                  position: logoPos,
                  orientation: logoOri,
                  model: {
                    uri: '/360views/360logo.gltf',
                    scale: logoTransform.scale || 1.0,
                    minimumPixelSize: 0,
                    maximumScale: 20000,
                    incrementallyLoadTextures: false,
                    runAnimations: false,
                  }
                });
                setLogoEntity(logoEnt);
              }
            }
          } catch (e) { console.warn('[AdminViewer] load 360 logo fail', e); }
        })
        .catch(err => console.error('Failed to fetch latest model data', err));
    }).catch(err => console.error('Admin tileset load error', err));

    return () => {
      disposed = true;
      if (!viewer.isDestroyed()) viewer.destroy();
    };
  }, [registerViewer, registerTileset, setBuildingEntity, setBuildingTransform, setLogoEntity, setLogoTransform]);

  return <div ref={containerRef} className="w-full h-full" />;
}
