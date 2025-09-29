import { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import { createApiUrl } from '../config/api';

export const CesiumContext = createContext(null);

// Load saved building transform: prefer published, fallback to working, else default
const loadBuildingTransform = () => {
  try {
    const published = localStorage.getItem('publishedBuildingTransform');
    if (published) return JSON.parse(published);
    const saved = localStorage.getItem('buildingTransform');
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('Failed to load building transform:', e);
  }
  return {
    position: { lon: 29.0098, lat: 41.0195, height: 10 },
    rotation: { heading: 0, pitch: 0, roll: 0 },
    scale: 1.0,
    visible: true
  };
};

// Load saved logo transform
const loadLogoTransform = () => {
  try {
    const published = localStorage.getItem('publishedLogoTransform');
    if (published) return JSON.parse(published);
    const saved = localStorage.getItem('logoTransform');
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('Failed to load logo transform:', e);
  }
  return {
    position: { lon: 29.012235802551594, lat: 41.02024565473916, height: 101.20504635558787 },
    rotation: { heading: 0, pitch: 0, roll: 0 },
    scale: 1.0,
    visible: true
  };
};

export function CesiumProvider({ children, projectId: initialProjectId = 1 }) {
  const viewerRef = useRef(null);
  const tilesetRef = useRef(null);
  const [viewerObj, setViewerObj] = useState(null);
  const [tilesetObj, setTilesetObj] = useState(null);
  const [projectId, setProjectId] = useState(Number(initialProjectId) || 1);
  const [projectCode, setProjectCode] = useState('');
  const [activeTool, setActiveTool] = useState(null); // 'measure' | 'move' | 'area' | 'replace' | 'building'
  const [selection, setSelection] = useState(null); // placeholder for area selection geometry
  // Model-specific selection (polygon on model surface)
  const [modelSelection, setModelSelection] = useState(null); // { positions: Cartesian3[], centroid, areaM2 }
  const [measurement, setMeasurement] = useState({ points: [], totalDistance: 0, lastSegment: 0, segments: [], area: 0 });
  const [clipping, setClipping] = useState({ applied: false, invert: false, usePoly: false });
  const [areaMode, setAreaMode] = useState('polygon'); // 'polygon' | 'rectangle'
  // Box selection tool state (independent)
  const [boxTool, setBoxTool] = useState({ center: null, width: 10, depth: 10, height: 5, rotationDeg: 0, entity: null, step: 1 });
  
  // Building model state
  const [buildingTransform, setBuildingTransform] = useState(loadBuildingTransform());
  const [buildingEntity, setBuildingEntity] = useState(null);
  const [buildingGizmos, setBuildingGizmos] = useState({
    visible: true,
    entities: [],
    stepSize: 1.0
  });
  // Stack of previous clipping plane sets for undo (each item: { planes: [{normal:{x,y,z}, distance}], mode })
  const [modelClipHistory, setModelClipHistory] = useState([]);

  // Logo model state
  const [logoTransform, setLogoTransform] = useState(loadLogoTransform());
  const [logoEntity, setLogoEntity] = useState(null);

  const registerViewer = useCallback((viewer) => {
    viewerRef.current = viewer;
    setViewerObj(viewer);
  }, []);

  const registerTileset = useCallback((tileset) => {
    tilesetRef.current = tileset;
    setTilesetObj(tileset);
  }, []);

  // Load project info to get project_code for asset paths
  useEffect(() => {
    let abort = false;
    async function loadProject(){
      try{
        console.log('[CesiumContext] Loading project:', projectId);
        const res = await fetch(createApiUrl(`api/projects/${projectId}`), {
          credentials: 'include'
        });
        console.log('[CesiumContext] Fetch response status:', res.status, res.ok);
        if (!res.ok) return;
        const js = await res.json();
        console.log('[CesiumContext] Project data:', js);
        if (!abort && js && js.data && js.data.project_code){
          console.log('[CesiumContext] Setting project_code:', js.data.project_code);
          setProjectCode(js.data.project_code);
        }
      }catch(err){ 
        console.error('[CesiumContext] Failed to load project:', err);
      }
    }
    loadProject();
    return () => { abort = true; };
  }, [projectId]);

  // Load published model data from backend
  useEffect(() => {
    let abort = false;
    async function loadPublishedModel(){
      try{
        console.log('[CesiumContext] Loading published model for project:', projectId);
        const res = await fetch(createApiUrl(`api/projects/${projectId}/model/published`), {
          credentials: 'include'
        });
        console.log('[CesiumContext] Published model response status:', res.status, res.ok);
        if (!res.ok) return;
        const js = await res.json();
        console.log('[CesiumContext] Published model data:', js);
        
        if (!abort && js && js.data) {
          const data = js.data;
          
          // Update localStorage with published data (backend already parsed JSON)
          if (data.building_transform) {
            localStorage.setItem('publishedBuildingTransform', JSON.stringify(data.building_transform));
            console.log('[CesiumContext] Updated published building transform:', data.building_transform);
          }
          
          if (data.logo_transform) {
            localStorage.setItem('publishedLogoTransform', JSON.stringify(data.logo_transform));
            console.log('[CesiumContext] Updated published logo transform:', data.logo_transform);
          }
          
          if (data.tileset_clips) {
            localStorage.setItem('publishedTilesetClips', JSON.stringify(data.tileset_clips));
            console.log('[CesiumContext] Updated published tileset clips:', data.tileset_clips);
          }
          
          if (data.model_clip_planes) {
            localStorage.setItem('publishedModelClipPlanes', JSON.stringify(data.model_clip_planes));
            console.log('[CesiumContext] Updated published model clip planes:', data.model_clip_planes);
          }
          
          // Force reload the transforms from localStorage (now with published data)
          setBuildingTransform(loadBuildingTransform());
          setLogoTransform(loadLogoTransform());
        }
      }catch(err){ 
        console.error('[CesiumContext] Failed to load published model:', err);
      }
    }
    loadPublishedModel();
    return () => { abort = true; };
  }, [projectId]);

  // Save building transform to localStorage whenever it changes
  useEffect(() => {
    if (buildingTransform) {
      localStorage.setItem('buildingTransform', JSON.stringify(buildingTransform));
    }
  }, [buildingTransform]);

  // Save logo transform to localStorage whenever it changes
  useEffect(() => {
    if (logoTransform) {
      localStorage.setItem('logoTransform', JSON.stringify(logoTransform));
    }
  }, [logoTransform]);

  const value = {
    projectId,
    setProjectId,
    projectCode,
    setProjectCode,
    viewer: viewerObj,
    tileset: tilesetObj,
    activeTool,
    setActiveTool,
    registerViewer,
    registerTileset,
    selection,
    setSelection,
  modelSelection,
  setModelSelection,
    measurement,
    setMeasurement,
    clipping,
    setClipping,
  areaMode,
  setAreaMode,
    // Building model state
    buildingTransform,
    setBuildingTransform,
    buildingEntity,
    setBuildingEntity,
    buildingGizmos,
    setBuildingGizmos,
  // Logo state
  logoTransform,
  setLogoTransform,
  logoEntity,
  setLogoEntity,
  modelClipHistory,
  setModelClipHistory,
  boxTool,
  setBoxTool,
  };

  return <CesiumContext.Provider value={value}>{children}</CesiumContext.Provider>;
}

// eslint-disable-next-line
export function useCesiumCtx() {
  const ctx = useContext(CesiumContext);
  if (!ctx) throw new Error('useCesiumCtx must be used within CesiumProvider');
  return ctx;
}
