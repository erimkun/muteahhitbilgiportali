import React, { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import * as egm96 from 'egm96-universal';

const MeasurementTools = ({ viewer }) => {
  const [activeTool, setActiveTool] = useState(null);
  const [isViewerReady, setIsViewerReady] = useState(false);
  const handlerRef = useRef(null);
  const measurementEntitiesRef = useRef([]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) {
      setIsViewerReady(false);
      return;
    }

    setIsViewerReady(true);

    // Cleanup function
    return () => {
      if (handlerRef.current && !handlerRef.current.isDestroyed()) {
        handlerRef.current.destroy();
        handlerRef.current = null;
      }
      clearMeasurements();  
    };
  }, [viewer]);

  const clearMeasurements = () => {
    if (!viewer || viewer.isDestroyed()) return;
    
    measurementEntitiesRef.current.forEach(entity => {
      if (viewer.entities.contains(entity)) {
        viewer.entities.remove(entity);
      }
    });
    measurementEntitiesRef.current = [];
  };

  const deactivateCurrentTool = () => {
    if (handlerRef.current && !handlerRef.current.isDestroyed()) {
      handlerRef.current.destroy();
      handlerRef.current = null;
    }
    setActiveTool(null);
    viewer.canvas.style.cursor = 'auto';
  };

  const activateDistanceMeasurement = () => {
    deactivateCurrentTool();
    setActiveTool('distance');
    viewer.canvas.style.cursor = 'crosshair';

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handlerRef.current = handler;

    let firstPoint = null;
    let dynamicEntity = null;
    let currentMousePosition = null;

    handler.setInputAction((event) => {
      // Önce 3D model üzerindeki pozisyonu almaya çalış
      let pickedPosition = viewer.scene.pickPosition(event.position);
      
      // Eğer 3D model üzerinde bir pozisyon bulunamazsa, terrain'i kullan
      if (!pickedPosition) {
        const ray = viewer.camera.getPickRay(event.position);
        pickedPosition = viewer.scene.globe.pick(ray, viewer.scene);
      }
      
      // Hiçbir pozisyon bulunamazsa çık
      if (!pickedPosition) return;

      if (!firstPoint) {
        // First click - set starting point
        firstPoint = pickedPosition;

        // Add first point marker
        const firstPointEntity = viewer.entities.add({
          position: firstPoint,
          point: {
            pixelSize: 10,
            color: Cesium.Color.YELLOW,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY
          }
        });
        measurementEntitiesRef.current.push(firstPointEntity);

        // Create dynamic line that follows mouse
        dynamicEntity = viewer.entities.add({
          polyline: {
            positions: new Cesium.CallbackProperty(() => {
              return currentMousePosition ? [firstPoint, currentMousePosition] : [firstPoint, firstPoint];
            }, false),
            width: 3,
            material: Cesium.Color.YELLOW,
            clampToGround: false
          }
        });
        measurementEntitiesRef.current.push(dynamicEntity);

      } else {
        // Second click - complete measurement
        const secondPoint = pickedPosition;

        // Remove dynamic line
        viewer.entities.remove(dynamicEntity);
        measurementEntitiesRef.current = measurementEntitiesRef.current.filter(e => e !== dynamicEntity);

        // Calculate straight-line distance
        const distance = Cesium.Cartesian3.distance(firstPoint, secondPoint);
        const midpoint = Cesium.Cartesian3.midpoint(firstPoint, secondPoint, new Cesium.Cartesian3());

        // Create final straight line
        const lineEntity = viewer.entities.add({
          polyline: {
            positions: [firstPoint, secondPoint],
            width: 3,
            material: Cesium.Color.CYAN,
            clampToGround: false // Keep line straight, don't follow terrain
          }
        });
        measurementEntitiesRef.current.push(lineEntity);

        // Add second point marker
        const secondPointEntity = viewer.entities.add({
          position: secondPoint,
          point: {
            pixelSize: 10,
            color: Cesium.Color.CYAN,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY
          }
        });
        measurementEntitiesRef.current.push(secondPointEntity);

        // Add distance label
        const labelEntity = viewer.entities.add({
          position: midpoint,
          label: {
            text: `Distance: ${(distance / 1000).toFixed(3)} km\n${distance.toFixed(2)} m`,
            font: '14pt monospace',
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -40),
            disableDepthTestDistance: Number.POSITIVE_INFINITY
          }
        });
        measurementEntitiesRef.current.push(labelEntity);

        deactivateCurrentTool();
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // Update dynamic line on mouse move
    handler.setInputAction((movement) => {
      if (firstPoint) {
        // Önce 3D model üzerindeki pozisyonu al
        let mousePos = viewer.scene.pickPosition(movement.endPosition);
        
        // Eğer 3D model üzerinde pozisyon yoksa terrain'i kullan
        if (!mousePos) {
          const ray = viewer.camera.getPickRay(movement.endPosition);
          mousePos = viewer.scene.globe.pick(ray, viewer.scene);
        }
        
        if (mousePos) {
          currentMousePosition = mousePos;
        }
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  };

  const activateAreaMeasurement = () => {
    deactivateCurrentTool();
    setActiveTool('area');
    viewer.canvas.style.cursor = 'crosshair';

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handlerRef.current = handler;

    let fixedPoints = [];
    let dynamicPolygon = null;
    let currentMousePosition = null;

    handler.setInputAction((event) => {
      // Önce 3D model üzerindeki pozisyonu almaya çalış
      let pickedPosition = viewer.scene.pickPosition(event.position);
      
      // Eğer 3D model üzerinde bir pozisyon bulunamazsa, terrain'i kullan
      if (!pickedPosition) {
        const ray = viewer.camera.getPickRay(event.position);
        pickedPosition = viewer.scene.globe.pick(ray, viewer.scene);
      }
      
      // Hiçbir pozisyon bulunamazsa çık
      if (!pickedPosition) return;

      // Fixed point ekle
      fixedPoints.push(pickedPosition);

      // Her noktada marker ekle
      const pointEntity = viewer.entities.add({
        position: pickedPosition,
        point: {
          pixelSize: 8,
          color: Cesium.Color.ORANGE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      });
      measurementEntitiesRef.current.push(pointEntity);

      if (fixedPoints.length === 1) {
        // İlk noktadan sonra dynamic polygon başlat - taralı
        dynamicPolygon = viewer.entities.add({
          polygon: {
            hierarchy: new Cesium.CallbackProperty(() => {
              // Fixed points + current mouse position
              const allPoints = currentMousePosition ? [...fixedPoints, currentMousePosition] : fixedPoints;
              return new Cesium.PolygonHierarchy(allPoints);
            }, false),
            material: new Cesium.StripeMaterialProperty({
              evenColor: Cesium.Color.ORANGE.withAlpha(0.5),
              oddColor: Cesium.Color.ORANGE.withAlpha(0.2),
              repeat: 8.0
            }),
            outline: true,
            outlineColor: Cesium.Color.ORANGE,
            height: 0,
            extrudedHeight: 0,
            perPositionHeight: true // Her noktanın kendi yüksekliğini kullan
          }
        });
        measurementEntitiesRef.current.push(dynamicPolygon);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // Mouse movement - dynamic polygon güncelle
    handler.setInputAction((movement) => {
      if (fixedPoints.length > 0) {
        // Önce 3D model üzerindeki pozisyonu al
        let mousePos = viewer.scene.pickPosition(movement.endPosition);
        
        // Eğer 3D model üzerinde pozisyon yoksa terrain'i kullan
        if (!mousePos) {
          const ray = viewer.camera.getPickRay(movement.endPosition);
          mousePos = viewer.scene.globe.pick(ray, viewer.scene);
        }
        
        if (mousePos) {
          currentMousePosition = mousePos;
        }
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // Right click - ölçümü tamamla
    handler.setInputAction(() => {
      if (fixedPoints.length < 3) {
        alert('En az 3 nokta gerekli. Daha fazla nokta ekleyin veya 3+ nokta ile sağ tıklayın.');
        return;
      }

      // Dynamic polygon'u kaldır
      if (dynamicPolygon) {
        viewer.entities.remove(dynamicPolygon);
        measurementEntitiesRef.current = measurementEntitiesRef.current.filter(e => e !== dynamicPolygon);
      }

      // Alan hesapla
      const positions = fixedPoints.map(point => {
        return Cesium.Cartographic.fromCartesian(point);
      });

      let area = 0;
      for (let i = 0; i < positions.length; i++) {
        const j = (i + 1) % positions.length;
        area += positions[i].longitude * positions[j].latitude;
        area -= positions[j].longitude * positions[i].latitude;
      }
      area = Math.abs(area) / 2;
      area = area * Math.pow(6378137, 2);

      // Final polygon oluştur - Taralı desen ile
      const polygonEntity = viewer.entities.add({
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(fixedPoints),
          material: new Cesium.StripeMaterialProperty({
            evenColor: Cesium.Color.CYAN.withAlpha(0.5),
            oddColor: Cesium.Color.CYAN.withAlpha(0.2),
            repeat: 10.0
          }),
          outline: true,
          outlineColor: Cesium.Color.CYAN,
          height: 0,
          extrudedHeight: 0,
          perPositionHeight: true // Bu önemli - her noktanın kendi yüksekliğini kullan
        }
      });
      measurementEntitiesRef.current.push(polygonEntity);

      // Label için ortalama yüksekliği hesapla
      let totalHeight = 0;
      fixedPoints.forEach(point => {
        const cartographic = Cesium.Cartographic.fromCartesian(point);
        totalHeight += cartographic.height;
      });
      const averageHeight = totalHeight / fixedPoints.length;

      // Centroid hesapla ve ortalama yükseklikte yerleştir
      const centroidSphere = Cesium.BoundingSphere.fromPoints(fixedPoints);
      const centroidCartographic = Cesium.Cartographic.fromCartesian(centroidSphere.center);
      const centroidWithHeight = Cesium.Cartesian3.fromRadians(
        centroidCartographic.longitude,
        centroidCartographic.latitude,
        averageHeight + 5 // 5 metre yukarıda göster
      );

      const labelEntity = viewer.entities.add({
        position: centroidWithHeight,
        label: {
          text: `Area: ${(area / 1000000).toFixed(3)} km²\n${area.toFixed(2)} m²`,
          font: '14pt monospace',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -40),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          heightReference: Cesium.HeightReference.NONE // Label'ı sabit pozisyonda tut
        }
      });
      measurementEntitiesRef.current.push(labelEntity);

      deactivateCurrentTool();
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
  };

  const activateHeightMeasurement = () => {
    deactivateCurrentTool();
    setActiveTool('height');
    viewer.canvas.style.cursor = 'crosshair';

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handlerRef.current = handler;

    handler.setInputAction((event) => {
      const pickedObject = viewer.scene.pick(event.position);
      const pickedPosition = viewer.scene.pickPosition(event.position);
      
      if (!pickedPosition) return;

      const cartographic = Cesium.Cartographic.fromCartesian(pickedPosition);
      const ellipsoidalHeightMeters = cartographic.height;
      // Convert radians to degrees for the library
      const latitudeDeg = Cesium.Math.toDegrees(cartographic.latitude);
      const longitudeDeg = Cesium.Math.toDegrees(cartographic.longitude);
      // EGM96 orthometric height (above mean sea level)
      const orthometricHeightMeters = egm96.ellipsoidToEgm96(
        latitudeDeg,
        longitudeDeg,
        ellipsoidalHeightMeters
      );

      // Add point marker
      const pointEntity = viewer.entities.add({
        position: pickedPosition,
        point: {
          pixelSize: 10,
          color: Cesium.Color.LIME,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      });
      measurementEntitiesRef.current.push(pointEntity);

      // Add height label
      const labelEntity = viewer.entities.add({
        position: pickedPosition,
        label: {
          text: `Height: ${orthometricHeightMeters.toFixed(2)} m`,
          font: '14pt monospace',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -40),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      });
      measurementEntitiesRef.current.push(labelEntity);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  };



  const toolButtons = [
    {
      id: 'distance',
      icon: 'fas fa-ruler',
      title: 'Distance Measurement\nClick two points to measure distance',
      onClick: activateDistanceMeasurement
    },
    {
      id: 'area',
      icon: 'fas fa-vector-square', 
      title: 'Area Measurement\nLeft-click to add points (min 3)\nRight-click to finish and calculate area',
      onClick: activateAreaMeasurement
    },
    {
      id: 'height',
      icon: 'fas fa-arrows-alt-v',
      title: 'Height Measurement\nClick on objects to measure height',
      onClick: activateHeightMeasurement
    },
    {
      id: 'clear',
      icon: 'fas fa-trash',
      title: 'Clear All Measurements',
      onClick: () => {
        deactivateCurrentTool();
        clearMeasurements();
      }
    }
  ];

  if (!viewer || viewer.isDestroyed() || !isViewerReady) {
    return (
      <div className="absolute left-4 top-1/2 transform -translate-y-1/2 flex flex-col gap-2 z-10">
        <div className="w-12 h-12 rounded-lg bg-gray-400/50 border border-gray-500/50 flex items-center justify-center">
          <i className="fas fa-spinner fa-spin text-gray-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="absolute left-4 top-1/2 transform -translate-y-1/2 flex flex-col gap-2 z-10">
      {toolButtons.map((tool) => (
        <button
          key={tool.id}
          onClick={tool.onClick}
          className={`
            w-10 h-10 rounded-full border shadow-lg transition-all duration-200 
            hover:shadow-xl hover:scale-105 flex items-center justify-center
            ${activeTool === tool.id 
              ? 'bg-indigo-600/80 border-indigo-400 text-white' 
              : 'bg-slate-900/60 hover:ring-1 hover:ring-white/10 text-white border-slate-700/70 hover:border-slate-600'
            }
          `}
          title={tool.title}
        >
          <i className={`${tool.icon} text-lg transition-colors duration-200`} />
        </button>
      ))}
    </div>
  );
};

export default MeasurementTools;
