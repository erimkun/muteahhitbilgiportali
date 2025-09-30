# Advanced Cutting Tool - Precision Clipping for Context Capture Tilesets

## Overview

The new `AdvancedCuttingTool` has been designed specifically for high-precision clipping operations on Context Capture tilesets. It replaces the basic `CuttingTool` with enhanced features inspired by the Cesium clipping examples in `clip.md`.

## Key Features

### 1. **High-Precision Coordinate System**
- Automatically detects and uses the tileset's local coordinate system
- Calculates a local origin based on the tileset's bounding sphere
- Maintains precision for Context Capture ECEF coordinates
- Displays coordinate system information in the UI

### 2. **Interactive Polygon Drawing**
- Mouse-based polygon drawing similar to the clip.md example
- Real-time polygon preview while drawing
- Visual point markers and dynamic polygon edges
- Support for complex multi-point polygons

### 3. **Multiple Input Methods**
- **Interactive Drawing**: Click to add points, right-click to finish
- **Area Selection**: Use existing area selection tool results
- **area.md Import**: Load from existing area.md files
- **File Import**: Upload .md or .txt files with coordinates

### 4. **Enhanced Coordinate Parsing**
- Supports Cartesian3 format: `new Cesium.Cartesian3(x, y, z)`
- Supports Degrees Array format: `longitude, latitude, ...`
- Automatic coordinate cleanup and validation
- Handles Context Capture coordinate ranges

### 5. **Advanced Management**
- Multiple clipping polygons support (union mode)
- Individual polygon undo functionality
- Invert clipping mode toggle
- Clear all polygons option
- Export polygons to markdown format

### 6. **Context Capture Optimization**
- Designed for your specific tileset coordinate system
- Maintains ECEF coordinate precision
- Compatible with sezyum_*.json tileset structure
- Handles large coordinate values (4M+ range)

## Technical Implementation

### Coordinate System Detection
```javascript
const localOrigin = {
  center: tileset.boundingSphere.center,
  cartographic: Cesium.Cartographic.fromCartesian(center),
  transform: Cesium.Transforms.eastNorthUpToFixedFrame(center),
  bounds: { radius, center, cartographic }
};
```

### Enhanced Clipping Application
- Uses `ClippingPolygonCollection` with union mode
- Maintains edge visualization (cyan color, 2px width)
- Supports multiple polygons per tileset
- Automatic polygon validation and cleanup

### Smart Coordinate Parsing
- Handles both local ECEF and geographic coordinates
- Automatic format detection (Cartesian3 vs Degrees)
- Duplicate point removal and polygon closure cleanup
- Precision-aware coordinate comparison

## User Interface

### Status Display
- Real-time coordinate system information
- Current polygon count and drawing status
- Tileset center and radius display
- Operation feedback messages

### Control Layout
- **Drawing Controls**: Start drawing, use selection, load area.md
- **Management Controls**: Undo, clear, invert mode
- **Import/Export**: Export to markdown, import from file
- **Progress Indicators**: Active drawing state, point count

## Usage Instructions

### Interactive Drawing
1. Click "Draw Polygon" to start drawing mode
2. Left-click on the tileset to add points
3. Points will snap to the tileset surface
4. Right-click to finish the polygon (minimum 3 points)

### Using Existing Data
1. **From Selection**: Use area selection tool, then click "Use Selection"
2. **From area.md**: Click "Load from area.md" to import existing file
3. **From File**: Click "Import File" to upload coordinate files

### Managing Polygons
- **Undo Last**: Remove the most recently added polygon
- **Clear All**: Remove all clipping polygons
- **Invert Mode**: Toggle between normal and inverted clipping
- **Export MD**: Download current polygons as markdown file

## Coordinate System Compatibility

### Your Tileset Format
- ECEF coordinates in Context Capture format
- Bounding spheres like: `[4209894.59, 2340961.33, 4166822.91, 339.84]`
- Geographic center around Turkey (29°-41° lon/lat)
- High precision for local detail (sub-meter accuracy)

### Supported Input Formats
```javascript
// Cartesian3 format (direct ECEF)
new Cesium.Cartesian3(4209894.59, 2340961.33, 4166822.91)

// Degrees format (converted to ECEF)
29.0098, 41.0195, 29.0099, 41.0196, ...
```

## Performance Optimizations

- Local coordinate system for reduced floating-point errors
- Efficient polygon validation and cleanup
- Smart memory management for large polygons
- Optimized for Context Capture tileset structure

## Integration

The tool is integrated into the admin interface:
- Accessible via "Precision Cut" button in the toolbox
- Replaces the old basic cutting tool
- Maintains compatibility with existing selection tools
- Preserves published state in the model system

This enhanced cutting tool provides the precision and functionality needed for professional Context Capture workflow while maintaining ease of use and reliability.