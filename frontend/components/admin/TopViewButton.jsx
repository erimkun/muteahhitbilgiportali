import React from 'react';
import * as Cesium from 'cesium';

export default function TopViewButton({ viewer }) {
  
  // Set camera to 90° top-down view (directly overhead)
  const setTopView = () => {
    if (!viewer || viewer.isDestroyed()) return;

    // Get current camera position to maintain X,Y coordinates
    const currentPosition = viewer.camera.positionCartographic;
    const currentLon = Cesium.Math.toDegrees(currentPosition.longitude);
    const currentLat = Cesium.Math.toDegrees(currentPosition.latitude);
    
    // Set height for top-down view (adjust based on project scale)
    const topViewHeight = 300;
    
    // Fly to top-down view with 90° pitch (looking straight down)
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(currentLon, currentLat, topViewHeight),
      orientation: {
        heading: Cesium.Math.toRadians(0),  // North facing
        pitch: Cesium.Math.toRadians(-90),  // Looking straight down
        roll: 0
      },
      duration: 1.5,
      easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT
    });
  };

  if (!viewer) return null;

  return (
    <div className="absolute right-4 top-4 z-20">
      <button 
        onClick={setTopView}
        className="bg-gradient-to-r from-emerald-600/80 to-teal-600/80 hover:from-emerald-500/90 hover:to-teal-500/90 border border-emerald-500/70 hover:border-emerald-400 rounded-lg px-4 py-2 flex items-center gap-2 shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105 group"
        title="Top View (90° Dikey Görünüm)"
      >
        <div className="relative">
          <i className="fas fa-arrows-alt text-white text-sm group-hover:rotate-180 transition-transform duration-300" />
          <div className="absolute -top-1 -right-1 text-xs text-emerald-200 font-bold">90°</div>
        </div>
        <span className="text-white text-sm font-medium hidden sm:block">Top View</span>
      </button>
    </div>
  );
}