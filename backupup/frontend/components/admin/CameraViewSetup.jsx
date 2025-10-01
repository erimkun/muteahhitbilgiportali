import React, { useState } from 'react';
import * as Cesium from 'cesium';
import { createApiUrl } from '../../config/api';

export default function CameraViewSetup({ projectId, viewer }) {
  const [isSettingView, setIsSettingView] = useState(null); // 'home', 'panel', 'corner' or null
  const [showSuccess, setShowSuccess] = useState(null);

  // Get current camera position/orientation
  const getCurrentCameraView = () => {
    if (!viewer || viewer.isDestroyed()) return null;

    const camera = viewer.camera;
    const position = camera.position;
    const cartographic = Cesium.Cartographic.fromCartesian(position);
    const longitude = Cesium.Math.toDegrees(cartographic.longitude);
    const latitude = Cesium.Math.toDegrees(cartographic.latitude);
    const height = cartographic.height;
    const heading = Cesium.Math.toDegrees(camera.heading);
    const pitch = Cesium.Math.toDegrees(camera.pitch);
    const roll = Cesium.Math.toDegrees(camera.roll);

    return {
      destination: {
        lon: longitude,
        lat: latitude,
        height: height
      },
      orientation: {
        headingDeg: heading,
        pitchDeg: pitch,
        roll: roll
      }
    };
  };

  // Save camera view to backend
  const saveCameraView = async (viewType) => {
    if (!viewer || viewer.isDestroyed()) return;

    setIsSettingView(viewType);

    try {
      const cameraView = getCurrentCameraView();
      if (!cameraView) {
        alert('Kamera pozisyonu alınamadı!');
        return;
      }

      // Get current settings first
      const getResponse = await fetch(createApiUrl(`api/projects/${projectId}/settings`), {
        credentials: 'include'
      });

      let currentSettings = {};
      if (getResponse.ok) {
        const result = await getResponse.json();
        currentSettings = result.data || {};
      }

      // Update the specific view
      const viewKey = `${viewType}_camera_view`;
      const updatedSettings = {
        ...currentSettings,
        [viewKey]: JSON.stringify(cameraView)
      };

      // Save to backend
      const response = await fetch(createApiUrl(`api/projects/${projectId}/settings`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(updatedSettings)
      });

      if (response.ok) {
        setShowSuccess(viewType);
        setTimeout(() => setShowSuccess(null), 2000);
        console.log(`✅ ${viewType.toUpperCase()} kamera görünümü kaydedildi:`, cameraView);
      } else {
        const error = await response.json();
        alert(`Hata: ${error.message || 'Kaydetme başarısız'}`);
      }
    } catch (error) {
      console.error('Kamera görünümü kaydetme hatası:', error);
      alert('Bağlantı hatası!');
    } finally {
      setIsSettingView(null);
    }
  };

  const getButtonTitle = (viewType) => {
    const titles = {
      home: 'Ana Görünüm',
      panel: 'Panel Görünümü', 
      corner: 'Köşe Görünümü'
    };
    return titles[viewType] || viewType;
  };

  const getButtonIcon = (viewType) => {
    const icons = {
      home: 'fas fa-home',
      panel: 'fas fa-columns',
      corner: 'fas fa-cube'
    };
    return icons[viewType] || 'fas fa-camera';
  };

  if (!viewer) return null;

  return (
    <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex flex-col gap-3 z-20">
      {/* Home View */}
      <div className="relative">
        <button 
          onClick={() => saveCameraView('home')}
          disabled={isSettingView === 'home'}
          className="bg-blue-600/80 hover:bg-blue-500/90 border border-blue-500/70 hover:border-blue-400 rounded-full w-12 h-12 flex items-center justify-center shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          title={`${getButtonTitle('home')} Ayarla`}
        >
          {isSettingView === 'home' ? (
            <i className="fas fa-spinner animate-spin text-white text-sm" />
          ) : (
            <i className={`${getButtonIcon('home')} text-white text-sm`} />
          )}
        </button>
        {showSuccess === 'home' && (
          <div className="absolute -right-2 -top-2 bg-green-500 rounded-full w-6 h-6 flex items-center justify-center">
            <i className="fas fa-check text-white text-xs" />
          </div>
        )}
      </div>

      {/* Panel View */}
      <div className="relative">
        <button 
          onClick={() => saveCameraView('panel')}
          disabled={isSettingView === 'panel'}
          className="bg-purple-600/80 hover:bg-purple-500/90 border border-purple-500/70 hover:border-purple-400 rounded-full w-12 h-12 flex items-center justify-center shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          title={`${getButtonTitle('panel')} Ayarla`}
        >
          {isSettingView === 'panel' ? (
            <i className="fas fa-spinner animate-spin text-white text-sm" />
          ) : (
            <i className={`${getButtonIcon('panel')} text-white text-sm`} />
          )}
        </button>
        {showSuccess === 'panel' && (
          <div className="absolute -right-2 -top-2 bg-green-500 rounded-full w-6 h-6 flex items-center justify-center">
            <i className="fas fa-check text-white text-xs" />
          </div>
        )}
      </div>

      {/* Corner View */}
      <div className="relative">
        <button 
          onClick={() => saveCameraView('corner')}
          disabled={isSettingView === 'corner'}
          className="bg-orange-600/80 hover:bg-orange-500/90 border border-orange-500/70 hover:border-orange-400 rounded-full w-12 h-12 flex items-center justify-center shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          title={`${getButtonTitle('corner')} Ayarla`}
        >
          {isSettingView === 'corner' ? (
            <i className="fas fa-spinner animate-spin text-white text-sm" />
          ) : (
            <i className={`${getButtonIcon('corner')} text-white text-sm`} />
          )}
        </button>
        {showSuccess === 'corner' && (
          <div className="absolute -right-2 -top-2 bg-green-500 rounded-full w-6 h-6 flex items-center justify-center">
            <i className="fas fa-check text-white text-xs" />
          </div>
        )}
      </div>
    </div>
  );
}