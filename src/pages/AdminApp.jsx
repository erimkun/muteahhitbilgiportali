import React from 'react';
import AdminViewer from '../components/admin/AdminViewer';
import Toolbox from '../components/admin/Toolbox';
import MeasureTool from '../components/admin/MeasureTool';
import AreaSelectTool from '../components/admin/AreaSelectTool';
import AutoAreaClipper from '../components/admin/AutoAreaClipper';
import BuildingPositioner from '../components/admin/BuildingPositioner';
import BoxSelectionTool from '../components/admin/BoxSelectionTool';
import { CesiumProvider } from '../context/CesiumContext';
import LogoPositioner from '../components/admin/LogoPositioner';

export default function AdminApp() {
  return (
    <CesiumProvider>
      <div className="w-full h-screen bg-neutral-900 text-white relative overflow-hidden">
        <AdminViewer />
        <MeasureTool />
  <AreaSelectTool />
  <BoxSelectionTool />
  <AutoAreaClipper />
        <BuildingPositioner />
        <LogoPositioner />
        <Toolbox />
      </div>
    </CesiumProvider>
  );
}
