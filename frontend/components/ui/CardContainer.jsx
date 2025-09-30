import React, { useCallback, useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import Card from './Card';
import { useCesiumCtx } from '../../context/CesiumContext';
import { createApiUrl, createFileUrl } from '../../config/api';

export default function CardContainer({ projectId = 1 }) {
  const { projectCode } = useCesiumCtx();
  const [isMinimized, setIsMinimized] = useState(false);
  const [assets, setAssets] = useState(null);
  const [overlay, setOverlay] = useState({ open: false, title: '', url: '', type: 'iframe', images: [], mode: 'grid', current: 0 });
  // Zoom state for single image view (Ctrl + Scroll)
  const [zoomScale, setZoomScale] = useState(1);
  const imageZoomContainerRef = useRef(null);
  // Pan state for dragging the zoomed image
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  // Persistent helper card control
  const [showZoomHelper, setShowZoomHelper] = useState(false);
  const zoomHelperDismissedRef = useRef(false); // per overlay session
  const panelRef = useRef(null);
  const modalRef = useRef(null);
  const triggerRectRef = useRef(null); // where the genie animation should originate
  const openAnimRef = useRef(null); // store last open animation params for closing
  const isAnimatingRef = useRef(false); // prevent double animations
  const [panelHeight, setPanelHeight] = useState(180);
  const [topGapPx, setTopGapPx] = useState(12); // small gap from very top
  const [filesZipUrl, setFilesZipUrl] = useState(null);
  const [filesDwgUrl, setFilesDwgUrl] = useState(null);
  const [filesFbxZipUrl, setFilesFbxZipUrl] = useState(null);
  
  // Placeholder icons using simple SVGs to avoid extra deps
  const FileIcon = (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={props.className}><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
  );
  const PackageIcon = (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={props.className}><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><polyline points="3.29 7 12 12 20.71 7"/><path d="m7.5 4.27 9 5.15"/></svg>
  );
  const GaugeIcon = (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={props.className}><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>
  );

  const scrollerRef = useRef(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const panoRef = useRef(null);
  const pannellumRef = useRef(null);

  const updateScrollState = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanLeft(scrollLeft > 2);
    setCanRight(scrollLeft + clientWidth < scrollWidth - 2);
  };

  const scrollBy = (dx) => {
    const el = scrollerRef.current;
    if (!el) return;
    
    // Kart genişlikleri: mobile'da tam genişlik, tablet'te 320px, desktop'ta 360px + gap'ler
    const isSmall = window.innerWidth < 640; // sm breakpoint
    const isLarge = window.innerWidth >= 1024; // lg breakpoint
    
    const cardWidth = isSmall ? el.clientWidth : (isLarge ? 360 : 320);
    const gap = isSmall ? 12 : 16; // gap-3 = 12px, gap-4 = 16px
    
    // Her seferinde tam 2 kart kaydır
    const cardsToScroll = 2;
    const amount = Math.sign(dx) * (cardsToScroll * (cardWidth + gap));
    
    el.scrollBy({ left: amount, behavior: 'smooth' });
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateScrollState();
    const onScroll = () => updateScrollState();
    const onResize = () => updateScrollState();
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  // Fetch assets for cards
  useEffect(() => {
    const abort = new AbortController();
    const load = async () => {
      try {
        const res = await fetch(createApiUrl(`api/projects/${projectId}/assets`), { 
          credentials: 'include'
        });
        if (!res.ok) return;
        const json = await res.json();
        setAssets(json.data || null);
      } catch (_) {
        // ignore
      }
    };
    load();
    return () => abort.abort();
  }, [projectId]);

  // Fetch gallery from backend folder
  const loadGallery = useCallback(async (album) => {
    try {
      const projectCodeToUse = projectCode || projectId;
      const res = await fetch(createApiUrl(`api/projects/${projectCodeToUse}/gallery/${album}`), {
        credentials: 'include'
      });

      if (!res.ok) return [];

      const result = await res.json();

      // Handle both old direct array and new wrapped format
      const json = result.data || result;
      // Normalize: backend returns [{url, title}], convert to {src, name}
      if (Array.isArray(json)) {
        const images = json.map((item) => ({
          src: createFileUrl(item.url),
          name: item.title || item.filename || 'image.jpg'
        }));
        console.log('360 Images loaded:', images.length, 'items');
        return images;
      }
      return [];
    } catch (error) {
      console.error('loadGallery error:', error);
      return [];
    }
  }, [projectCode, projectId]);

  // Listen for external requests to open 360 viewer (e.g., clicking the 360 logo in Cesium)
  useEffect(() => {
    const onOpenPano = async (ev) => {
      // Try to capture a rect from event detail to start the animation from the model click position
      try {
        const d = ev?.detail;
        if (d) {
          if (d.element && typeof d.element.getBoundingClientRect === 'function') {
            triggerRectRef.current = d.element.getBoundingClientRect();
          } else if (d.rect) {
            triggerRectRef.current = d.rect;
          } else if (typeof d.x === 'number' && typeof d.y === 'number') {
            triggerRectRef.current = { left: d.x, top: d.y, width: d.width || 40, height: d.height || 40 };
          }
        }
      } catch (_) {}
      const imgs = await loadGallery('view_360');
      if (imgs && imgs.length) {
        setOverlay({ open: true, title: '360° View', url: '', type: 'pano', images: imgs, mode: imgs.length === 1 ? 'view' : 'grid', current: 0 });
      } else {
        // If no images, keep previous behavior (do nothing)
      }
    };
    window.addEventListener('openPano', onOpenPano);
    return () => window.removeEventListener('openPano', onOpenPano);
  }, [loadGallery]);

  // Use only server-provided assets; avoid hard-coded legacy defaults
  const data = { ...(assets || {}) };

  // Load PDF documents from the "other" album
  const loadDocs = async () => {
    const items = await loadGallery('other');
    return items.filter((it) => /\.pdf(?:$|\?)/i.test(it.src || it.url || ''));
  };

  // Lazy-load Pannellum when needed for 360° viewer
  const ensurePannellumLoaded = async () => {
    if (window.pannellum) return true;
    if (!document.querySelector('script[data-lib="pannellum"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/pannellum@2.5.6/build/pannellum.css';
      link.setAttribute('data-lib', 'pannellum');
      document.head.appendChild(link);
      const scr = document.createElement('script');
      scr.src = 'https://unpkg.com/pannellum@2.5.6/build/pannellum.js';
      scr.async = true;
      scr.defer = true;
      scr.setAttribute('data-lib', 'pannellum');
      document.head.appendChild(scr);
      await new Promise((resolve) => {
        scr.addEventListener('load', resolve);
        scr.addEventListener('error', resolve);
      });
    }
    return !!window.pannellum;
  };

  // Try to find a zip in files album (e.g., drone.zip) to use in buttons
  useEffect(() => {
    const loadZip = async () => {
      try {
        let items = await loadGallery('drone_photos_file');
        let zips = items.filter((it) => (it.src || '').toLowerCase().endsWith('.zip'));
        if (zips.length) setFilesZipUrl(zips[0].src);
      } catch (_) {}
    };
    loadZip();
  }, [loadGallery]);

  // Try to find a DWG in files album to use for Floor Plans download
  useEffect(() => {
    const loadDwg = async () => {
      try {
        let items = await loadGallery('floor_plans_file');
        let candidate = items.find((it) => (it.src || '').toLowerCase().endsWith('.dwg'));
        if (candidate) setFilesDwgUrl(candidate.src);
      } catch (_) {}
    };
    loadDwg();
  }, [loadGallery]);

  useEffect(() => {
    const loadFbx = async () => {
      try {
        let items = await loadGallery('fbx_model_file');
        let zips = items.filter((it) => (it.src || '').toLowerCase().endsWith('.zip'));
        if (zips.length) setFilesFbxZipUrl(zips[0].src);
      } catch (_) {}
    };
    loadFbx();
  }, [loadGallery]);

  const toEmbedUrl = (url) => {
    if (!url) return url;
    try {
      const u = new URL(url, window.location.origin);
      const host = u.hostname.replace('www.', '');
      if (host === 'youtu.be') {
        const id = u.pathname.slice(1);
        return `https://www.youtube.com/embed/${id}`;
      }
      if (host === 'youtube.com' || host === 'm.youtube.com') {
        const id = u.searchParams.get('v');
        if (id) return `https://www.youtube.com/embed/${id}`;
      }
    } catch (_) {}
    return url;
  };

  const handleView = async (e, title, url) => {
    if (e) e.preventDefault();
    // Record the clicked button rect to animate the modal from this point
    try {
      const target = e?.currentTarget || e?.target;
      if (target && typeof target.getBoundingClientRect === 'function') {
        triggerRectRef.current = target.getBoundingClientRect();
      }
    } catch (_) {}
    // Galleries
    if (title.includes('Proje Kat Planları')) {
      const imgs = await loadGallery('floor_plans');
      setOverlay({ open: true, title, url: '', type: 'gallery', images: imgs, mode: imgs.length === 1 ? 'view' : 'grid', current: 0 });
      return;
    }
    if (title.includes('Diğer Dosyalar')) {
      const docs = await loadDocs();
      setOverlay({ open: true, title, url: '', type: 'docs', images: docs, mode: 'grid', current: 0 });
      return;
    }
    if (title.includes('Müteahhit Deposu')) {
      // Load canonical contractor_depot (backend stores files there)
      const items = await loadGallery('contractor_depot');
      // Ensure title and empty state are explicit
      if (!items || !items.length) {
        setOverlay({ open: true, title: 'Müteahhit Deposu', url: '', type: 'depot', images: [], mode: 'grid', current: 0 });
        return;
      }
      const isImg = (s) => /\.(jpg|jpeg|png|gif|webp)$/i.test(s || '');
      const isPdf = (s) => /\.(pdf)$/i.test(s || '');
      const images = items.filter((it) => isImg(it.src));
      const pdfs = items.filter((it) => isPdf(it.src));
      // Preserve full depot list so "Geri" restores the grid
      // If only images -> open gallery view but keep depotAll for back
      if (images.length && !pdfs.length) {
        setOverlay({ open: true, title: 'Müteahhit Deposu', url: '', type: 'gallery', images, mode: images.length === 1 ? 'view' : 'grid', current: 0, depotAll: items });
        return;
      }
      // If single PDF -> open docs viewer and preserve depot list for back
      if (pdfs.length && !images.length && pdfs.length === 1) {
        setOverlay({ open: true, title: 'Müteahhit Deposu', url: '', type: 'docs', images: pdfs, mode: 'view', current: 0, depotAll: items });
        return;
      }
      // Mixed or many files: show depot grid (all files)
      setOverlay({ open: true, title: 'Müteahhit Deposu', url: '', type: 'depot', images: items, mode: 'grid', current: 0 });
      return;
    }
    if (title.includes('Drone Fotoğrafları')) {
      const imgs = await loadGallery('drone_photos');
      setOverlay({ open: true, title, url: '', type: 'gallery', images: imgs, mode: imgs.length === 1 ? 'view' : 'grid', current: 0 });
      return;
    }
    if (title.includes('Ortofoto')) {
      const imgs = await loadGallery('orthophoto');
      if (imgs.length) {
        setOverlay({ open: true, title, url: '', type: 'gallery', images: imgs, mode: 'view', current: 0 });
        return;
      }
    }
    if (title.includes('360')) {
      const imgs = await loadGallery('view_360');
      if (imgs.length) {
        setOverlay({ open: true, title, url: '', type: 'pano', images: imgs, mode: imgs.length === 1 ? 'view' : 'grid', current: 0 });
        return;
      }
      if (url) {
        setOverlay({ open: true, title, url, type: 'iframe', images: [], mode: 'grid', current: 0 });
        return;
      }
    }
    // Fallback: iframe (e.g., YouTube)
    setOverlay({ open: true, title, url: toEmbedUrl(url), type: 'iframe', images: [], mode: 'grid', current: 0 });
  };

  // Run genie-like animation on open
  useEffect(() => {
    const el = modalRef.current;
    if (!overlay.open) {
      if (el) {
        gsap.killTweensOf(el);
        gsap.set(el, { clearProps: 'all' });
      }
      isAnimatingRef.current = false;
      return;
    }
    if (!el) return;
    gsap.killTweensOf(el);
    gsap.set(el, { clearProps: 'all' });
    isAnimatingRef.current = false;
    const fromRect = triggerRectRef.current;
    const animFrame = requestAnimationFrame(() => {
      try {
        const modalRect = el.getBoundingClientRect();
        let dx = 0, dy = 0, sx = 1, sy = 1;
        if (fromRect && modalRect.width > 0 && modalRect.height > 0) {
          dx = fromRect.left + (fromRect.width / 2) - (modalRect.left + modalRect.width / 2);
          dy = fromRect.top + (fromRect.height / 2) - (modalRect.top + modalRect.height / 2);
          sx = Math.max(0.08, (fromRect.width || 1) / modalRect.width);
          sy = Math.max(0.08, (fromRect.height || 1) / modalRect.height);
        }
        openAnimRef.current = { dx, dy, sx, sy };
        isAnimatingRef.current = true;
        gsap.set(el, { 
          transformOrigin: 'center center',
          x: dx, 
          y: dy, 
          scaleX: sx, 
          scaleY: sy, 
          opacity: 0.8,
          filter: 'blur(3px)'
        });
        gsap.to(el, {
          x: 0, 
          y: 0, 
          scaleX: 1, 
          scaleY: 1, 
          opacity: 1,
          filter: 'blur(0px)', 
          duration: 0.6, 
          ease: 'power3.out',
          onComplete: () => {
            isAnimatingRef.current = false;
          }
        });
      } catch (_) {
        isAnimatingRef.current = false;
      }
    });
    return () => {
      cancelAnimationFrame(animFrame);
    };
  }, [overlay.open]);

  // Manage persistent helper card: show once per overlay open (not on image-to-image changes)
  useEffect(() => {
    if (!overlay.open) {
      setShowZoomHelper(false);
      zoomHelperDismissedRef.current = false;
      return;
    }
    if (overlay.type === 'gallery' && overlay.mode === 'view' && !zoomHelperDismissedRef.current) {
      setZoomScale(1);
      setPanPosition({ x: 0, y: 0 });
      setShowZoomHelper(true);
    } else if (!(overlay.type === 'gallery' && overlay.mode === 'view')) {
      setShowZoomHelper(false);
    }
  }, [overlay.open, overlay.type, overlay.mode]);

  // Wheel handler for Ctrl + Scroll zoom
  useEffect(() => {
    const el = imageZoomContainerRef.current;
    if (!el) return;
    if (!(overlay.open && overlay.type === 'gallery' && overlay.mode === 'view')) return;
    const onWheel = (e) => {
      if (!e.ctrlKey) return; // only when Ctrl pressed
      e.preventDefault();
      const delta = e.deltaY;
      setZoomScale((prev) => {
        const next = prev * (delta > 0 ? 0.9 : 1.1);
        return Math.min(5, Math.max(0.5, parseFloat(next.toFixed(3))));
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [overlay.open, overlay.type, overlay.mode]);

  // Mouse drag handler for panning the zoomed image
  useEffect(() => {
    const el = imageZoomContainerRef.current;
    if (!el) return;
    if (!(overlay.open && overlay.type === 'gallery' && overlay.mode === 'view')) return;

    const onMouseDown = (e) => {
      if (e.button !== 0) return; // only left click
      isDraggingRef.current = true;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      el.style.cursor = 'grabbing';
      e.preventDefault();
    };

    const onMouseMove = (e) => {
      if (!isDraggingRef.current) return;
      e.preventDefault();
      
      const deltaX = e.clientX - lastMousePosRef.current.x;
      const deltaY = e.clientY - lastMousePosRef.current.y;
      
      setPanPosition(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
      el.style.cursor = zoomScale > 1 ? 'grab' : 'default';
    };

    const onMouseLeave = () => {
      isDraggingRef.current = false;
      el.style.cursor = zoomScale > 1 ? 'grab' : 'default';
    };

    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    el.addEventListener('mouseleave', onMouseLeave);

    // Set cursor based on zoom level
    el.style.cursor = zoomScale > 1 ? 'grab' : 'default';

    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      el.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [overlay.open, overlay.type, overlay.mode, zoomScale]);

  // Reset pan position when zoom scale changes significantly or when switching images
  useEffect(() => {
    if (zoomScale <= 1) {
      setPanPosition({ x: 0, y: 0 });
    }
  }, [zoomScale]);

  // Reset pan position when switching between images
  useEffect(() => {
    setPanPosition({ x: 0, y: 0 });
  }, [overlay.current]);

  const closeWithGenie = () => {
    // Prevent double animations
    if (isAnimatingRef.current || !overlay.open) return;
    
    const el = modalRef.current;
    if (!el) {
      setOverlay({ open: false, title: '', url: '' });
      return;
    }
    
    // Kill any existing animations first
    gsap.killTweensOf(el);
    isAnimatingRef.current = true;
    
    const p = openAnimRef.current || { dx: 0, dy: 0, sx: 0.08, sy: 0.08 };
    
    gsap.to(el, {
      x: p.dx, 
      y: p.dy, 
      scaleX: p.sx, 
      scaleY: p.sy, 
      opacity: 0.3,
      filter: 'blur(4px)', 
      duration: 0.4, 
      ease: 'power2.in',
      onComplete: () => {
        // Use a timeout to ensure state change happens after animation
        setTimeout(() => {
          setOverlay({ open: false, title: '', url: '' });
          gsap.set(el, { clearProps: 'all' });
          isAnimatingRef.current = false;
          triggerRectRef.current = null; // Clear trigger rect
        }, 16);
      }
    });
  };

  // Initialize / update Pannellum on pano view
  useEffect(() => {
    const run = async () => {
      if (overlay.type !== 'pano' || overlay.mode !== 'view') return;
      const ok = await ensurePannellumLoaded();
      if (!ok || !panoRef.current) return;
      if (pannellumRef.current) {
        try { pannellumRef.current.destroy && pannellumRef.current.destroy(); } catch (_) {}
        pannellumRef.current = null;
      }
      const img = overlay.images[overlay.current]?.src;
      if (!img) return;
      
      try {
        // For authenticated URLs, fetch with credentials and create blob URL
        let panoramaUrl = img;
        if (img.includes(new URL(createApiUrl('/')).hostname)) {
          console.log('Fetching 360 image with authentication:', img);
          const response = await fetch(img, { credentials: 'include' });
          if (response.ok) {
            const blob = await response.blob();
            panoramaUrl = URL.createObjectURL(blob);
            console.log('Created blob URL for 360 image');
          } else {
            console.error('Failed to fetch 360 image:', response.status);
            return;
          }
        }
        
        pannellumRef.current = window.pannellum.viewer(panoRef.current, {
          type: 'equirectangular',
          panorama: panoramaUrl,
          autoLoad: true,
          showZoomCtrl: true,
          showFullscreenCtrl: true,
          compass: false,
        });
      } catch (error) {
        console.error('Error loading 360 view:', error);
      }
    };
    run();
  }, [overlay.type, overlay.mode, overlay.current, overlay.images]);

  // Keep popup above the panel: measure panel height (robust with ResizeObserver)
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const update = () => {
      setPanelHeight(el.offsetHeight || 0);
    };
    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    if (ro) ro.observe(el);
    // Also listen to transition end and window resize for safety
    const onResize = () => update();
    const onEnd = () => setTimeout(update, 16);
    window.addEventListener('resize', onResize);
    el.addEventListener('transitionend', onEnd);
    return () => {
      window.removeEventListener('resize', onResize);
      el.removeEventListener('transitionend', onEnd);
      if (ro) ro.disconnect();
    };
  }, [isMinimized]);

  // Use a tiny fixed top gap so popup can start above header
  useEffect(() => { setTopGapPx(12); }, []);

  return (
    <>
      {showZoomHelper && (
        <div className="fixed top-4 left-4 z-[100] pointer-events-auto">
          <div className="relative px-6 py-5 pr-14 rounded-2xl bg-black/45 backdrop-blur-xl border border-white/20 ring-1 ring-inset ring-white/15 shadow-2xl text-base md:text-lg leading-relaxed text-white/90 max-w-sm select-none">
            <button
              aria-label="Kapat"
              onClick={() => { setShowZoomHelper(false); zoomHelperDismissedRef.current = true; }}
              className="absolute top-2.5 right-2.5 h-8 w-8 inline-flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition"
            >
              <i className="fas fa-times text-[17px]"></i>
            </button>
            <div className="font-semibold text-white text-lg md:text-xl mb-2 tracking-tight">Görüntü Yakınlaştırma</div>
            <p className="m-0 text-white/85 font-normal">
              <span className="text-white font-semibold">Ctrl + Scroll</span> ile yakınlaştır/uzaklaştır<br />
              <span className="text-white font-semibold">Sol tık + sürükle</span> ile resmi kaydır
            </p>
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute bottom-3 inset-x-3 z-30">
      {overlay.open && (
        <div className="pointer-events-auto fixed inset-x-0 z-40" style={{ top: topGapPx, bottom: panelHeight + 22 }}>
          <div ref={modalRef} key={overlay.type === 'pano' ? 'modal-pano' : 'modal-default'} className="relative mx-auto h-full w-[min(92vw,1120px)] rounded-2xl border border-slate-800/70 bg-black/30 backdrop-blur-xl ring-1 ring-inset ring-white/10 shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 bg-black/25 backdrop-blur-md border-b border-white/10">
              <div className="text-white/90 text-sm font-medium">{overlay.title}</div>
              <div className="flex items-center gap-2">
                {overlay.depotAll && overlay.mode === 'view' && (
                  <button
                    aria-label="Geri"
                    onClick={() => setOverlay((o) => {
                      // If we opened a single item from the depot and stored depotAll, restore depot grid and items.
                      if (o.depotAll && Array.isArray(o.depotAll)) {
                        return { ...o, mode: 'grid', type: 'depot', images: o.depotAll };
                      }
                      return { ...o, mode: 'grid' };
                    })}
                    className="inline-flex items-center justify-center h-10 px-3 rounded-full border border-white/20 bg-black/40 text-white hover:bg-black/50 hover:border-white/30 active:scale-[0.98] ring-1 ring-inset ring-white/15"
                  >
                    Geri
                  </button>
                )}
                <button
                  aria-label="Kapat"
                  onClick={closeWithGenie}
                  className="inline-flex items-center justify-center h-10 w-10 rounded-full border bg-slate-900/60 hover:ring-1 hover:ring-white/10 transition text-white border-slate-700/70 hover:border-slate-600"
                >
                  <i className="fas fa-times text-lg"></i>
                </button>
              </div>
            </div>
            <div className={`flex-1 w-full ${overlay.type === 'pano' ? 'min-h-0 flex flex-col' : 'min-h-0'}`}> 
              {overlay.type === 'gallery' ? (
                overlay.mode === 'grid' ? (
                  <div className="h-full w-full overflow-auto no-scrollbar p-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 auto-rows-[180px]">
                    {overlay.images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setOverlay((o) => ({ ...o, mode: 'view', current: idx }))}
                        className="group rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 ring-1 ring-inset ring-white/5 overflow-hidden text-left h-full flex flex-col"
                      >
                        <div className="w-full overflow-hidden bg-black/30 flex-1 min-h-0">
                          <img src={img.src} alt={img.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                        </div>
                        <div className="px-2.5 py-2">
                          <div className="text-xs text-white/90 truncate">{img.name}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  // Single image view için scroll ve zoom desteği ekle, butonları sabit tut
                  <div ref={imageZoomContainerRef} className="relative h-full w-full overflow-auto">
                    {overlay.images.length > 1 && (
                      <>
                        <button
                          aria-label="Önceki"
                          onClick={() => setOverlay((o) => ({ ...o, current: (o.current - 1 + o.images.length) % o.images.length }))}
                          className="fixed left-4 top-1/2 -translate-y-1/2 inline-flex items-center justify-center h-10 w-10 rounded-full border bg-slate-900/60 hover:ring-1 hover:ring-white/10 transition text-white border-slate-700/70 hover:border-slate-600 z-50"
                        >
                          <i className="fas fa-chevron-left text-lg"></i>
                        </button>
                        <button
                          aria-label="Sonraki"
                          onClick={() => setOverlay((o) => ({ ...o, current: (o.current + 1) % o.images.length }))}
                          className="fixed right-4 top-1/2 -translate-y-1/2 inline-flex items-center justify-center h-10 w-10 rounded-full border bg-slate-900/60 hover:ring-1 hover:ring-white/10 transition text-white border-slate-700/70 hover:border-slate-600 z-50"
                        >
                          <i className="fas fa-chevron-right text-lg"></i>
                        </button>
                      </>
                    )}
                    <div className="min-h-full flex flex-col items-center justify-center px-4 md:px-8 py-4 md:py-6 select-none">
                      <img
                        src={overlay.images[overlay.current]?.src}
                        alt={overlay.images[overlay.current]?.name || 'image'}
                        style={{ 
                          transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoomScale})`, 
                          transformOrigin: 'center center', 
                          transition: isDraggingRef.current ? 'none' : 'transform 0.15s ease-out' 
                        }}
                        className="max-w-[calc(100%-4rem)] md:max-w-[calc(100%-8rem)] h-auto max-h-none object-contain rounded-lg shadow-2xl"
                        draggable={false}
                      />
                    </div>
                  </div>
                )
              ) : overlay.type === 'docs' ? (
                overlay.mode === 'grid' ? (
                  <div className="h-full w-full overflow-auto no-scrollbar p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 auto-rows-[200px] sm:auto-rows-[220px] md:auto-rows-[240px]">
                    {overlay.images.map((doc, idx) => (
                      <div 
                        key={idx}
                        className="group rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 ring-1 ring-inset ring-white/5 overflow-hidden text-left h-full flex flex-col relative"
                      >
                        <div className="w-full overflow-hidden bg-black/30 flex items-center justify-center flex-1 min-h-0">
                          <svg viewBox="0 0 24 24" className="h-10 w-10 text-rose-300" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
                        </div>
                        <div className="px-2.5 py-2">
                          <div className="text-xs text-white/90 truncate" title={doc.name}>{doc.name}</div>
                        </div>
                        <div className="absolute inset-0 flex items-end justify-center pb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="flex gap-1">
                            <button
                              onClick={() => setOverlay((o) => ({ ...o, mode: 'view', current: idx }))}
                              className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
                              title="Modal'da görüntüle"
                            >
                              📄 Görüntüle
                            </button>
                            <button
                              onClick={() => window.open(doc.src, '_blank')}
                              className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded"
                              title="Yeni sekmede aç"
                            >
                              🔗 Yeni Sekme
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  // Docs view için de scroll desteği ekle
                  <div className="relative h-full w-full overflow-auto">
                    <div className="min-h-full flex flex-col items-center justify-center px-4 md:px-8 py-4 md:py-6 w-full">
                      <iframe
                        title={overlay.images[overlay.current]?.name || 'document'}
                        src={`${overlay.images[overlay.current]?.src}#toolbar=1`}
                        className="h-[calc(100vh-14rem)] w-full max-w-[calc(100%-2rem)] md:max-w-[calc(100%-4rem)] rounded-lg bg-black/60"
                      />
                    </div>
                  </div>
                )
              ) : overlay.type === 'depot' ? (
                <div className="h-full w-full overflow-auto no-scrollbar p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 auto-rows-[200px] sm:auto-rows-[220px] md:auto-rows-[240px]">
                  {overlay.images.map((it, idx) => {
                    const src = it.src || '';
                    const isImg = /\.(jpg|jpeg|png|gif|webp)$/i.test(src);
                    const isPdf = /\.(pdf)$/i.test(src);
                    return (
                      <div key={idx} className="group rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 ring-1 ring-inset ring-white/5 overflow-hidden text-left h-full flex flex-col relative">
                        <div className="w-full overflow-hidden bg-black/30 flex items-center justify-center flex-1 min-h-0">
                          {isImg ? (
                            <img src={src} alt={it.name} className="h-full w-full object-cover" />
                          ) : isPdf ? (
                            <svg viewBox="0 0 24 24" className="h-10 w-10 text-rose-300" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
                          ) : (
                            <svg viewBox="0 0 24 24" className="h-10 w-10 text-slate-200" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg>
                          )}
                        </div>
                        <div className="px-2.5 py-2">
                          <div className="text-xs text-white/90 truncate" title={it.name}>{it.name}</div>
                        </div>
                        <div className="absolute inset-0 flex items-end justify-center pb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="flex gap-1">
                            {isImg ? (
                              <button
                                onClick={() => {
                                  const imgs = overlay.images.filter(x => /\.(jpg|jpeg|png|gif|webp)$/i.test(x.src || ''));
                                  const indexInImgs = imgs.findIndex(x => x.src === src);
                                  setOverlay({ open: true, title: 'Müteahhit Deposu', url: '', type: 'gallery', images: imgs, mode: 'view', current: Math.max(0, indexInImgs), depotAll: overlay.images });
                                }}
                                className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
                              >
                                🖼️ Görüntüle
                              </button>
                            ) : isPdf ? (
                              <>
                                <button
                                  onClick={() => setOverlay({ open: true, title: 'Müteahhit Deposu', url: '', type: 'docs', images: [{ src, name: it.name }], mode: 'view', current: 0, depotAll: overlay.images })}
                                  className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
                                >
                                  📄 Görüntüle
                                </button>
                                <button
                                  onClick={() => window.open(src, '_blank')}
                                  className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded"
                                  title="Yeni sekmede aç"
                                >
                                  🔗 Yeni Sekme
                                </button>
                              </>
                            ) : (
                              // For non-image / non-pdf files show a single İndir button (styled like Görüntüle)
                              <button
                                onClick={() => window.open(src, '_blank')}
                                className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
                                title="İndir"
                              >
                                ⬇️ İndir
                              </button>
                            )}
                            {/* keep a secondary download link hidden for img/pdf (already provided), no duplicate for other files */}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : overlay.url ? (
                <iframe
                  title={overlay.title || 'preview'}
                  src={overlay.url}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : overlay.type === 'pano' ? (
                overlay.mode === 'grid' ? (
                  <div className="h-full w-full overflow-auto no-scrollbar p-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 auto-rows-[180px]">
                    {overlay.images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setOverlay((o) => ({ ...o, mode: 'view', current: idx }))}
                        className="group rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 ring-1 ring-inset ring-white/5 overflow-hidden text-left h-full flex flex-col"
                      >
                        <div className="w-full overflow-hidden bg-black/30 flex-1">
                          <img src={img.src} alt={img.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                        </div>
                        <div className="px-2.5 py-2">
                          <div className="text-xs text-white/90 truncate">{img.name}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="relative h-full w-full px-4 md:px-8 py-4 md:py-6 overflow-hidden flex-1 min-h-0 flex">
                    <div className="flex-1 min-h-0 flex items-stretch justify-center">
                      <div ref={panoRef} className="h-full w-full max-w-[calc(100%-4rem)] md:max-w-[calc(100%-8rem)] min-h-[320px] rounded-lg overflow-hidden" />
                    </div>
                  </div>
                )
              ) : (
                <div className="flex h-full w-full items-center justify-center text-white/80 text-sm">
                  İçerik bulunamadı.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <div ref={panelRef} className="pointer-events-auto mx-auto w-[min(92vw,1120px)] rounded-2xl border border-slate-800/70 bg-black/30 backdrop-blur-md ring-1 ring-inset ring-white/10 shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-[18px] w-[18px] items-center justify-center text-white">⎆</span>
            <h2 className="text-sm sm:text-base tracking-tight font-medium text-white">İndirilebilir Dosyalar</h2>
          </div>
          <span 
            onClick={() => setIsMinimized(!isMinimized)}
            className="text-[12px] text-slate-200 font-normal hover:text-white transition-colors cursor-pointer"
          >
            {isMinimized ? 'Paneli aç' : 'Paneli gizle'}
          </span>
          <span className="text-[12px] text-slate-400 font-normal">
            Devamını gör
          </span>
        </div>
        <div className="px-3 pb-3">
          <div className={`transition-all duration-500 ease-in-out overflow-hidden ${
            isMinimized 
              ? 'max-h-0 opacity-0 transform scale-95' 
              : 'max-h-[500px] opacity-100 transform scale-100'
          }`}>
            <div className="flex items-center gap-3">
            <button
              aria-label="Sola kaydır"
              onClick={() => scrollBy(-1)}
              className={`inline-flex items-center justify-center h-10 w-10 rounded-full border bg-slate-900/60 hover:ring-1 hover:ring-white/10 transition ${canLeft ? 'text-white border-slate-700/70 hover:border-slate-600' : 'text-white/70 border-slate-800/70 opacity-60 cursor-default pointer-events-none'}`}
            >
              <i className="fas fa-chevron-left text-lg"></i>
            </button>

            {/* scroller */}
            <div ref={scrollerRef} className="no-scrollbar flex-1 min-w-0 flex gap-3 sm:gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth">
              <Card
                title="Proje Kat Planları"
                subtitle="JPEG & AutoCAD"
                icon={FileIcon}
                color="amber"
                actions={[
                  { label: 'Görüntüle', href: undefined, onClick: (e) => handleView(e, 'Proje Kat Planları', data.floor_plans_gallery_url), primary: true },
                  filesDwgUrl ? { label: 'İndir (.dwg)', href: filesDwgUrl, download: true } : null,
                ].filter(Boolean)}
              />

              <Card
                title="Drone Videosu"
                subtitle="Proje Alanına Ait Drone Videosu"
                icon={GaugeIcon}
                color="rose"
                actions={[
                  data.drone_video_url ? { label: 'Görüntüle', href: data.drone_video_url, onClick: (e) => handleView(e, 'Drone Videosu', data.drone_video_url), primary: true } : null,
                ].filter(Boolean)}
              />

              <Card
                title="3D Model (FBX)"
                subtitle="Kaynak dosya"
                icon={PackageIcon}
                color="sky"
                actions={[
                  (filesFbxZipUrl || data.fbx_zip_url) ? { label: 'İndir', href: filesFbxZipUrl || data.fbx_zip_url, download: true, primary: true } : null,
                ].filter(Boolean)}
              />

              <Card
                title="Drone Fotoğrafları"
                subtitle="JPEG koleksiyonu"
                icon={GaugeIcon}
                color="violet"
                actions={[
                  { label: 'Görüntüle', href: undefined, onClick: (e) => handleView(e, 'Drone Fotoğrafları', data.drone_photos_gallery_url), primary: true },
                  (filesZipUrl || data.drone_photos_zip_url) ? { label: 'İndir (.zip)', href: filesZipUrl || data.drone_photos_zip_url, download: true } : null,
                ].filter(Boolean)}
              />

              <Card
                title="360° View"
                subtitle="Panoramik görüntü"
                icon={FileIcon}
                color="emerald"
                actions={[
                  { label: 'Görüntüle', href: undefined, onClick: (e) => handleView(e, '360° View', data.view_360_url), primary: true },
                ]}
              />

              <Card
                title="Ortofoto"
                subtitle="Harita görüntüsü"
                icon={FileIcon}
                color="indigo"
                actions={[
                  { label: 'Görüntüle', href: undefined, onClick: (e) => handleView(e, 'Ortofoto', data.orthophoto_url), primary: true },
                ]}
              />

              <Card
                title="Raporlar ve Diğer Dosyalar"
                subtitle="Raporlar,Applikasyon Krokisi,Tapu,..."
                icon={FileIcon}
                color="slate"
                actions={[
                  { label: 'Görüntüle', href: undefined, onClick: (e) => handleView(e, 'Diğer Dosyalar', undefined), primary: true },
                ]}
              />

              <Card
                title="Müteahhit Deposu"
                subtitle="Serbest yüklemeler (görüntüle/indir)"
                icon={FileIcon}
                color="lime"
                actions={[
                  { label: 'Görüntüle', href: undefined, onClick: (e) => handleView(e, 'Müteahhit Deposu', undefined), primary: true },
                  { label: 'Yükle', href: undefined, onClick: async (e) => {
                      e?.preventDefault?.();
                      try {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.multiple = true;
                        input.onchange = async () => {
                          const files = Array.from(input.files || []);
                          if (!files.length) return;
                          try {
                            const form = new FormData();
                            files.forEach((f) => form.append('files', f));
                            // Use canonical album "contractor_depot" to match backend storage
                            const resp = await fetch(createApiUrl(`api/projects/${projectId}/gallery/contractor_depot`), {
                              method: 'POST',
                              body: form,
                              credentials: 'include'
                            });
                            if (resp.ok) {
                              // Refresh depot view after upload
                              const items = await loadGallery('contractor_depot');
                              setOverlay({ open: true, title: 'Müteahhit Deposu', url: '', type: 'depot', images: items, mode: 'grid', current: 0 });
                            } else {
                              // Best-effort feedback
                              alert('Yükleme başarısız');
                            }
                          } catch (_) {
                            alert('Yükleme hatası');
                          }
                        };
                        input.click();
                      } catch (_) {}
                    }
                  }
                ]}
              />
            </div>

            <button
              aria-label="Sağa kaydır"
              onClick={() => scrollBy(1)}
              className={`inline-flex items-center justify-center h-10 w-10 rounded-full border bg-slate-900/60 hover:ring-1 hover:ring-white/10 transition ${canRight ? 'text-white border-slate-700/70 hover:border-slate-600' : 'text-white/70 border-slate-800/70 opacity-60 cursor-default pointer-events-none'}`}
            >
              <i className="fas fa-chevron-right text-lg"></i>
            </button>
          </div>
          </div>
          <div className="text-[11px] text-slate-400 pt-2 px-1" />
        </div>
      </div>
    </div>
    </>
  );
}
