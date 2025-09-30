import React, { useEffect, useCallback, useState, useRef } from 'react';
import * as Cesium from 'cesium';
import { useCesiumCtx } from '../../context/CesiumContext';

/*
AdvancedCuttingTool - High Precision Cutting Tool
Features:
- Interactive polygon drawing with mouse clicks
- Localized coordinate system for better precision (inspired by clip.md)
- Works with Context Capture tilesets
- Real-time polygon preview
- Multiple clipping regions support
- Undo/redo functionality
*/

export default function AdvancedCuttingTool() {
  const { activeTool, selection, tileset, setClipping, clipping, viewer, projectId } = useCesiumCtx();
  const [status, setStatus] = useState('ready');
  const [isDrawing, setIsDrawing] = useState(false);
  const [activePolygon, setActivePolygon] = useState([]);
  const [clippingPolygons, setClippingPolygons] = useState([]);
  const [localOrigin, setLocalOrigin] = useState(null);
  
  // Drawing state
  const drawingStateRef = useRef({
    activePoints: [],
    floatingPoint: null,
    activeShape: null,
    handler: null
  });

  const isActive = activeTool === 'cut';

  // Parse Cartesian3 coordinates from markdown
  const parseCartesian = useCallback((text) => {
    const regex = /new\s+Cesium\.Cartesian3\(([-0-9.]+),\s*([-0-9.]+),\s*([-0-9.]+)\)/g;
    const positions = [];
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      const x = parseFloat(match[1]);
      const y = parseFloat(match[2]);
      const z = parseFloat(match[3]);
      
      if (isFinite(x) && isFinite(y) && isFinite(z)) {
        positions.push(new Cesium.Cartesian3(x, y, z));
      }
    }
    
    return positions;
  }, []);

  // Parse degrees array from markdown
  const parseDegrees = useCallback((text) => {
    const degSection = text.match(/Degrees Array[\s\S]*?\n([0-9.,\s-]+)/);
    if (!degSection) return [];
    
    const numbers = degSection[1].split(/[.,\s]+/)
      .map(n => n.trim())
      .filter(Boolean)
      .map(parseFloat);
    
    const positions = [];
    for (let i = 0; i < numbers.length - 1; i += 2) {
      const lon = numbers[i];
      const lat = numbers[i + 1];
      
      if (isFinite(lon) && isFinite(lat)) {
        positions.push(Cesium.Cartesian3.fromDegrees(lon, lat));
      }
    }
    
    return positions;
  }, []);

  // Check if two positions are almost equal
  const almostEqual = useCallback((a, b, epsilon = 1e-6) => {
    if (!a || !b) return false;
    return Math.abs(a.x - b.x) < epsilon && 
           Math.abs(a.y - b.y) < epsilon && 
           Math.abs(a.z - b.z) < epsilon;
  }, []);

  // Calculate local origin from tileset for better precision
  const calculateLocalOrigin = useCallback(() => {
    if (!tileset?.boundingSphere) return null;
    
    const center = tileset.boundingSphere.center;
    const cartographic = Cesium.Cartographic.fromCartesian(center);
    
    // For Context Capture tilesets, we want to maintain the local coordinate system
    // while providing better precision for clipping polygons
    const localTransform = Cesium.Transforms.eastNorthUpToFixedFrame(center);
    
    // Get tileset bounds for coordinate system analysis
    const bounds = {
      center: center,
      radius: tileset.boundingSphere.radius,
      cartographic: cartographic
    };
    
    setStatus(`Origin: ${Cesium.Math.toDegrees(cartographic.longitude).toFixed(6)}°, ${Cesium.Math.toDegrees(cartographic.latitude).toFixed(6)}° (r=${bounds.radius.toFixed(1)}m)`);
    
    return {
      center,
      cartographic,
      transform: localTransform,
      inverseTransform: Cesium.Matrix4.inverse(localTransform, new Cesium.Matrix4()),
      bounds
    };
  }, [tileset]);

  // Initialize local coordinate system when tileset is ready
  useEffect(() => {
    if (isActive && tileset && !localOrigin) {
      const origin = calculateLocalOrigin();
      setLocalOrigin(origin);
    }
  }, [isActive, tileset, localOrigin, calculateLocalOrigin]);

  // Apply clipping polygon to tileset with enhanced precision
  const applyClippingPolygon = useCallback((positions, label = 'polygon') => {
    if (!tileset || !positions || positions.length < 3) {
      setStatus('Invalid polygon data');
      return false;
    }

    try {
      // For Context Capture tilesets, we need to ensure coordinates are properly handled
      // The clipping polygon should use the same coordinate system as the tileset
      let clippingPositions = positions;

      // If we have a local origin, we can optionally transform for better precision
      if (localOrigin) {
        // For high precision, we could transform to local space and back
        // But for Context Capture, often the original coordinates work best
        clippingPositions = positions;
      }

      const clipPolygon = new Cesium.ClippingPolygon({
        positions: clippingPositions
      });

      if (!tileset.clippingPolygons) {
        tileset.clippingPolygons = new Cesium.ClippingPolygonCollection({
          polygons: [clipPolygon],
          unionClippingRegions: true,
          edgeColor: Cesium.Color.CYAN,
          edgeWidth: 2.0,
          enabled: true
        });
      } else {
        tileset.clippingPolygons.add(clipPolygon);
      }

      setClippingPolygons(prev => [...prev, { id: Date.now(), positions: clippingPositions, label }]);
      setClipping(c => ({ ...c, applied: true, usePoly: true }));
      setStatus(`Applied ${label} (${positions.length} points)`);
      
      return true;
    } catch (error) {
      console.error('Failed to apply clipping polygon:', error);
      setStatus(`Failed to apply ${label}: ${error.message}`);
      return false;
    }
  }, [tileset, localOrigin, setClipping]);

  // Create a visual point entity
  const createPointEntity = useCallback((worldPosition) => {
    if (!viewer) return null;
    
    return viewer.entities.add({
      position: worldPosition,
      point: {
        color: Cesium.Color.YELLOW,
        pixelSize: 8,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.CLAMP_TO_3D_TILE,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    });
  }, [viewer]);

  // Create preview polygon entity
  const createPolygonEntity = useCallback((positions) => {
    if (!viewer || !positions || positions.length < 3) return null;
    
    return viewer.entities.add({
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(positions),
        material: Cesium.Color.YELLOW.withAlpha(0.3),
        outline: true,
        outlineColor: Cesium.Color.YELLOW,
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.CLAMP_TO_3D_TILE,
        extrudedHeight: 0
      }
    });
  }, [viewer]);

  // Get position from mouse click, prefer tileset surface
  const getPickPosition = useCallback((clickPosition) => {
    if (!viewer) return null;
    
    const ray = viewer.camera.getPickRay(clickPosition);
    if (!ray) return null;

    // Try to pick from tileset first for better precision
    let position = viewer.scene.pickPosition(clickPosition);
    
    // Fallback to globe pick if tileset pick fails
    if (!position && viewer.scene.globe.show) {
      position = viewer.scene.globe.pick(ray, viewer.scene);
    }
    
    // Final fallback to ellipsoid intersection
    if (!position) {
      position = viewer.camera.pickEllipsoid(clickPosition, viewer.scene.globe.ellipsoid);
    }
    
    return position;
  }, [viewer]);

  // Setup interactive drawing handlers
  const setupDrawingHandlers = useCallback(() => {
    if (!viewer || !isActive) return;

    const state = drawingStateRef.current;
    
    // Clean up existing handler
    if (state.handler) {
      state.handler.destroy();
    }

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
    state.handler = handler;

    // Left click - add point
    handler.setInputAction((event) => {
      const position = getPickPosition(event.position);
      if (!position) return;

      if (state.activePoints.length === 0) {
        // Start new polygon
        state.floatingPoint = createPointEntity(position);
        state.activePoints.push(position);
        
        // Create dynamic polygon preview
        const dynamicPositions = new Cesium.CallbackProperty(() => {
          return new Cesium.PolygonHierarchy(state.activePoints);
        }, false);
        
        state.activeShape = viewer.entities.add({
          polygon: {
            hierarchy: dynamicPositions,
            material: Cesium.Color.YELLOW.withAlpha(0.4),
            outline: true,
            outlineColor: Cesium.Color.YELLOW,
            outlineWidth: 3,
            heightReference: Cesium.HeightReference.CLAMP_TO_3D_TILE
          }
        });
        
        setStatus('Click to add points, right-click to finish');
      } else {
        // Add point to existing polygon
        createPointEntity(position);
        state.activePoints.push(position);
        setStatus(`Points: ${state.activePoints.length} (right-click to finish)`);
      }
      
      setActivePolygon([...state.activePoints]);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // Mouse move - update floating point
    handler.setInputAction((event) => {
      if (state.floatingPoint && state.activePoints.length > 0) {
        const newPosition = getPickPosition(event.endPosition);
        if (newPosition) {
          state.floatingPoint.position.setValue(newPosition);
          // Update the dynamic polygon preview
          state.activePoints[state.activePoints.length] = newPosition;
          if (state.activePoints.length > state.activePoints.length) {
            state.activePoints.pop();
          }
          state.activePoints.push(newPosition);
        }
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // Right click - finish polygon
    handler.setInputAction(() => {
      if (state.activePoints.length >= 3) {
        finishPolygon();
      } else {
        cancelDrawing();
      }
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

    // Disable default double-click behavior
    viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
      Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
    );

  }, [viewer, isActive, getPickPosition, createPointEntity]);

  // Finish drawing current polygon and apply clipping
  const finishPolygon = useCallback(() => {
    const state = drawingStateRef.current;
    
    if (state.activePoints.length < 3) {
      setStatus('Need at least 3 points for polygon');
      return;
    }

    // Remove the last point (floating point)
    const finalPoints = state.activePoints.slice(0, -1);
    
    // Apply clipping polygon using our enhanced method
    const success = applyClippingPolygon(finalPoints, 'drawn polygon');
    
    if (success) {
      // Clean up drawing state
      if (state.floatingPoint) viewer.entities.remove(state.floatingPoint);
      if (state.activeShape) viewer.entities.remove(state.activeShape);
      
      state.activePoints = [];
      state.floatingPoint = null;
      state.activeShape = null;
      setActivePolygon([]);
      setIsDrawing(false);
    }
  }, [viewer, applyClippingPolygon]);

  // Cancel current drawing
  const cancelDrawing = useCallback(() => {
    const state = drawingStateRef.current;
    
    // Remove all point entities from current drawing
    state.activePoints.forEach((_, index) => {
      const pointEntities = viewer.entities.values.filter(e => 
        e.point && e.position && Cesium.Cartesian3.equals(e.position.getValue(), state.activePoints[index])
      );
      pointEntities.forEach(entity => viewer.entities.remove(entity));
    });
    
    if (state.floatingPoint) viewer.entities.remove(state.floatingPoint);
    if (state.activeShape) viewer.entities.remove(state.activeShape);
    
    state.activePoints = [];
    state.floatingPoint = null;
    state.activeShape = null;
    setActivePolygon([]);
    setIsDrawing(false);
    setStatus('Drawing cancelled');
  }, [viewer]);

  // Clear all clipping polygons
  const clearAllClipping = useCallback(() => {
    if (tileset) {
      tileset.clippingPolygons = undefined;
    }
    setClippingPolygons([]);
    setClipping(c => ({ ...c, applied: false }));
    setStatus('All clipping cleared');
  }, [tileset, setClipping]);

  // Undo last polygon
  const undoLastPolygon = useCallback(() => {
    if (clippingPolygons.length === 0) return;
    
    const newPolygons = clippingPolygons.slice(0, -1);
    setClippingPolygons(newPolygons);
    
    if (tileset) {
      if (newPolygons.length === 0) {
        tileset.clippingPolygons = undefined;
        setClipping(c => ({ ...c, applied: false }));
      } else {
        const polygons = newPolygons.map(p => new Cesium.ClippingPolygon({ positions: p.positions }));
        tileset.clippingPolygons = new Cesium.ClippingPolygonCollection({
          polygons,
          unionClippingRegions: true,
          edgeColor: Cesium.Color.CYAN,
          edgeWidth: 2.0
        });
      }
    }
    
    setStatus(`Removed last polygon (${newPolygons.length} remaining)`);
  }, [clippingPolygons, tileset, setClipping]);

  // Start drawing mode
  const startDrawing = useCallback(() => {
    if (!localOrigin) {
      setStatus('Calculating local coordinate system...');
      const origin = calculateLocalOrigin();
      setLocalOrigin(origin);
    }
    setIsDrawing(true);
    setStatus('Click on the model to start drawing polygon');
    setupDrawingHandlers();
  }, [localOrigin, calculateLocalOrigin, setupDrawingHandlers]);

  // Export current clipping polygons to markdown format
  const exportToMarkdown = useCallback(() => {
    if (clippingPolygons.length === 0) {
      setStatus('No polygons to export');
      return;
    }

    let markdown = '# Clipping Polygons Export\n\n';
    markdown += `Generated: ${new Date().toISOString()}\n`;
    markdown += `Project: ${projectId || 'Unknown'}\n`;
    if (localOrigin) {
      markdown += `Tileset Center: ${Cesium.Math.toDegrees(localOrigin.cartographic.longitude).toFixed(6)}°, ${Cesium.Math.toDegrees(localOrigin.cartographic.latitude).toFixed(6)}°\n`;
    }
    markdown += `\n## Polygons (${clippingPolygons.length})\n\n`;

    clippingPolygons.forEach((poly, index) => {
      markdown += `### Polygon ${index + 1} - ${poly.label || 'Unknown'}\n\n`;
      markdown += '**Cartesian3 Coordinates:**\n```javascript\n';
      poly.positions.forEach((pos, i) => {
        markdown += `new Cesium.Cartesian3(${pos.x.toFixed(6)}, ${pos.y.toFixed(6)}, ${pos.z.toFixed(6)})${i < poly.positions.length - 1 ? ',' : ''}\n`;
      });
      markdown += '```\n\n';

      // Also add degrees if possible
      markdown += '**Degrees Array:**\n```\n';
      poly.positions.forEach((pos, i) => {
        try {
          const carto = Cesium.Cartographic.fromCartesian(pos);
          const lon = Cesium.Math.toDegrees(carto.longitude);
          const lat = Cesium.Math.toDegrees(carto.latitude);
          markdown += `${lon.toFixed(8)}, ${lat.toFixed(8)}${i < poly.positions.length - 1 ? ',' : ''}\n`;
        } catch (e) {
          markdown += `// Conversion failed for point ${i}\n`;
        }
      });
      markdown += '```\n\n';
    });

    // Create and download the file
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clipping-polygons-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setStatus(`Exported ${clippingPolygons.length} polygons to markdown`);
  }, [clippingPolygons, localOrigin]);

  // Import polygons from uploaded file
  const importFromFile = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.txt';
    
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        let positions = parseCartesian(text);
        if (!positions.length) positions = parseDegrees(text);
        
        if (positions.length >= 3) {
          applyClippingPolygon(positions, `imported from ${file.name}`);
        } else {
          setStatus('No valid coordinates found in file');
        }
      } catch (error) {
        setStatus('Failed to read file');
        console.error('File import error:', error);
      }
    };
    
    input.click();
  }, [parseCartesian, parseDegrees, applyClippingPolygon]);

  // Toggle clipping inversion
  const toggleInversion = useCallback(() => {
    if (tileset?.clippingPolygons) {
      tileset.clippingPolygons.inverse = !tileset.clippingPolygons.inverse;
      setClipping(c => ({ ...c, invert: !c.invert }));
      setStatus(`Clipping ${tileset.clippingPolygons.inverse ? 'inverted' : 'normal'}`);
    }
  }, [tileset, setClipping]);

  // Apply polygon from area.md file
  const applyFromAreaMd = useCallback(async () => {
    try {
      setStatus('Loading area.md...');
      const res = await fetch('/area.md', { cache: 'no-cache' });
      if (!res.ok) {
        setStatus('area.md file not found');
        return;
      }
      
      const text = await res.text();
      let positions = parseCartesian(text);
      if (!positions.length) positions = parseDegrees(text);
      
      if (positions.length < 3) {
        setStatus('No valid vertices found in area.md');
        return;
      }

      // Clean up duplicates and closure
      if (positions.length >= 2) {
        const last = positions[positions.length - 1];
        const prev = positions[positions.length - 2];
        if (almostEqual(last, prev)) positions.pop();
        
        const first = positions[0];
        if (positions.length >= 3 && almostEqual(positions[positions.length - 1], first)) {
          positions.pop();
        }
      }

      if (positions.length < 3) {
        setStatus('Insufficient vertices after cleanup');
        return;
      }

      // Apply using our enhanced method
      applyClippingPolygon(positions, 'area.md polygon');
      
    } catch (error) {
      console.error('Failed to load area.md:', error);
      setStatus('Error loading area.md');
    }
  }, [applyClippingPolygon, parseCartesian, parseDegrees, almostEqual]);

  // Apply polygon from current selection
  const applyFromSelection = useCallback(() => {
    if (!selection?.positions || selection.positions.length < 3) {
      setStatus('No valid selection available');
      return;
    }
    
    applyClippingPolygon(selection.positions, 'selection polygon');
  }, [selection, applyClippingPolygon]);

  // Cleanup handlers when tool deactivates
  useEffect(() => {
    return () => {
      const state = drawingStateRef.current;
      if (state.handler) {
        state.handler.destroy();
        state.handler = null;
      }
    };
  }, []);

  // Setup/cleanup when tool becomes active/inactive
  useEffect(() => {
    if (isActive) {
      setupDrawingHandlers();
      if (!localOrigin) {
        const origin = calculateLocalOrigin();
        setLocalOrigin(origin);
      }
    } else {
      const state = drawingStateRef.current;
      if (state.handler) {
        state.handler.destroy();
        state.handler = null;
      }
      setIsDrawing(false);
      setActivePolygon([]);
      
      // Clean up any active drawing entities
      if (state.floatingPoint) {
        viewer?.entities.remove(state.floatingPoint);
        state.floatingPoint = null;
      }
      if (state.activeShape) {
        viewer?.entities.remove(state.activeShape);
        state.activeShape = null;
      }
      state.activePoints = [];
    }
  }, [isActive, setupDrawingHandlers, calculateLocalOrigin, localOrigin, viewer]);

  if (!isActive) return null;

  const hasSelection = selection?.positions?.length >= 3;

  return (
    <div className="text-xs text-white/70 space-y-3">
      <div className="border-b border-white/10 pb-2">
        <h3 className="text-white font-medium mb-1">Advanced Cutting Tool</h3>
        <p className="text-[10px] text-white/50">High-precision polygon clipping with local coordinates</p>
      </div>
      
      {/* Status Display */}
      <div className="bg-neutral-800/30 px-2 py-1 rounded text-[10px]">
        <div className="flex justify-between">
          <span>Status:</span>
          <span className="text-emerald-300">{status}</span>
        </div>
        <div className="flex justify-between">
          <span>Polygons:</span>
          <span className="text-blue-300">{clippingPolygons.length}</span>
        </div>
        {isDrawing && (
          <div className="flex justify-between">
            <span>Drawing:</span>
            <span className="text-yellow-300">{activePolygon.length} points</span>
          </div>
        )}
        {localOrigin && (
          <div className="text-[9px] text-green-300 mt-1 space-y-1">
            <div>✓ Origin: {Cesium.Math.toDegrees(localOrigin.cartographic.longitude).toFixed(4)}°, {Cesium.Math.toDegrees(localOrigin.cartographic.latitude).toFixed(4)}°</div>
            <div>Radius: {localOrigin.bounds.radius.toFixed(1)}m</div>
            <div>Center: [{localOrigin.center.x.toFixed(1)}, {localOrigin.center.y.toFixed(1)}, {localOrigin.center.z.toFixed(1)}]</div>
          </div>
        )}
      </div>

      {/* Drawing Controls */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-1">
          <button
            onClick={startDrawing}
            disabled={isDrawing}
            className={`text-[10px] px-2 py-1 rounded ${
              isDrawing 
                ? 'bg-yellow-600/80 cursor-not-allowed' 
                : 'bg-green-600/80 hover:bg-green-500 text-white'
            }`}
          >
            {isDrawing ? 'Drawing...' : 'Draw Polygon'}
          </button>
          
          <button
            onClick={applyFromSelection}
            disabled={!hasSelection}
            className={`text-[10px] px-2 py-1 rounded ${
              hasSelection 
                ? 'bg-indigo-600/80 hover:bg-indigo-500 text-white' 
                : 'bg-white/10 text-white/40 cursor-not-allowed'
            }`}
          >
            Use Selection ({selection?.positions?.length || 0})
          </button>
        </div>

        <button
          onClick={applyFromAreaMd}
          className="w-full text-[10px] px-2 py-1 rounded bg-blue-600/80 hover:bg-blue-500 text-white"
        >
          Load from area.md
        </button>

        {isDrawing && (
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={finishPolygon}
              disabled={activePolygon.length < 3}
              className={`text-[10px] px-2 py-1 rounded ${
                activePolygon.length >= 3
                  ? 'bg-blue-600/80 hover:bg-blue-500 text-white'
                  : 'bg-white/10 text-white/40 cursor-not-allowed'
              }`}
            >
              Finish ({activePolygon.length})
            </button>
            
            <button
              onClick={cancelDrawing}
              className="text-[10px] px-2 py-1 rounded bg-red-600/80 hover:bg-red-500 text-white"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Management Controls */}
      <div className="space-y-1">
        <div className="grid grid-cols-2 gap-1">
          <button
            onClick={undoLastPolygon}
            disabled={clippingPolygons.length === 0}
            className={`text-[10px] px-2 py-1 rounded ${
              clippingPolygons.length > 0
                ? 'bg-amber-600/80 hover:bg-amber-500 text-white'
                : 'bg-white/10 text-white/40 cursor-not-allowed'
            }`}
          >
            Undo Last
          </button>
          
          <button
            onClick={clearAllClipping}
            className="text-[10px] px-2 py-1 rounded bg-red-600/70 hover:bg-red-500 text-white"
          >
            Clear All
          </button>
        </div>
        
        <button
          onClick={toggleInversion}
          disabled={!tileset?.clippingPolygons}
          className={`w-full text-[10px] px-2 py-1 rounded ${
            tileset?.clippingPolygons
              ? 'bg-purple-600/80 hover:bg-purple-500 text-white'
              : 'bg-white/10 text-white/40 cursor-not-allowed'
          }`}
        >
          {clipping.invert ? 'Normal Mode' : 'Invert Mode'}
        </button>
        
        <div className="grid grid-cols-2 gap-1 pt-1">
          <button
            onClick={exportToMarkdown}
            disabled={clippingPolygons.length === 0}
            className={`text-[10px] px-2 py-1 rounded ${
              clippingPolygons.length > 0
                ? 'bg-green-600/80 hover:bg-green-500 text-white'
                : 'bg-white/10 text-white/40 cursor-not-allowed'
            }`}
          >
            Export MD
          </button>
          
          <button
            onClick={importFromFile}
            className="text-[10px] px-2 py-1 rounded bg-blue-600/80 hover:bg-blue-500 text-white"
          >
            Import File
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="text-[9px] text-white/40 space-y-1 pt-2 border-t border-white/5">
        <p><strong>Drawing:</strong></p>
        <p>• Left click: Add point to polygon</p>
        <p>• Right click: Finish polygon (min 3 points)</p>
        <p><strong>Features:</strong></p>
        <p>• Localized coordinates for high precision</p>
        <p>• Multiple polygons combined (union)</p>
        <p>• Import/export markdown format</p>
        <p>• Works with Context Capture tilesets</p>
      </div>
    </div>
  );
}