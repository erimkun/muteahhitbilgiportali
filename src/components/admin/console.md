// 1. Globals
__ADMIN_VIEWER && __ADMIN_TILESET ? 'OK globals' : 'MISSING'

// 2. Plane collection count
(() => { const ts=__ADMIN_TILESET; return ts?.clippingPlanes ? ts.clippingPlanes.length : 'no planes'; })()

// 3. First plane details
(() => { const cp=__ADMIN_TILESET?.clippingPlanes; if(!cp||!cp.length) return 'no planes'; const p=cp.get(0); return {normal:p.normal, distance:p.distance}; })()

// 4. Signed distance of tileset center to each plane
(() => { const ts=__ADMIN_TILESET; const cp=ts?.clippingPlanes; if(!cp) return 'no planes'; const c=ts.root.boundingSphere.center; const out=[]; for(let i=0;i<cp.length;i++){const p=cp.get(i); out.push({i, signed: Cesium.Cartesian3.dot(p.normal,c)+p.distance});} return out; })()

// 5. Does root tile model have clipping
(() => { const t=__ADMIN_TILESET?.root; const m=t?.content?._model; return m ? {has:m.clippingPlanes!=null} : 'no model'; })()

// 6. Force propagate clipping planes to every loaded tile model
(() => {const ts=__ADMIN_TILESET, cp=ts?.clippingPlanes; if(!ts||!cp) return 'missing'; let applied=0; const stack=[ts.root]; while(stack.length){const tile=stack.pop(); if(tile?.children) stack.push(...tile.children); const m=tile?.content?._model; if(m){m.clippingPlanes=cp; applied++;}} return {applied};})()

// 7. Make tiles bright yellow (visual sanity)
__ADMIN_TILESET.style = new Cesium.Cesium3DTileStyle({ color: 'color("yellow")' }); __ADMIN_VIEWER.scene.requestRender(); 'styled'

// 8. Single vertical plane test (hemisphere cut)
(() => {const ts=__ADMIN_TILESET; if(!ts) return 'no tileset'; const c=ts.root.boundingSphere.center; const n=Cesium.Cartesian3.normalize(c,new Cesium.Cartesian3()); const d=-Cesium.Cartesian3.dot(n,c); ts.clippingPlanes=new Cesium.ClippingPlaneCollection({planes:[new Cesium.ClippingPlane(n,d)], edgeWidth:1, edgeColor:Cesium.Color.CYAN}); return 'single plane applied';})()

// 9. Remove clipping
(() => { if(__ADMIN_TILESET){ __ADMIN_TILESET.clippingPlanes=undefined; } return 'clipping removed'; })()

// 10. Tile content hide inside polygon fallback (run AFTER selection + Apply Clipping failed)
//    Assumes selection stored on window.__LAST_SELECTION (add that in selection code if needed)
(() => {const ts=__ADMIN_TILESET, sel=window.__LAST_SELECTION; if(!ts||!sel?.positions?.length) return 'no selection'; const centroid=sel.centroid||sel.positions[0]; const enu=Cesium.Transforms.eastNorthUpToFixedFrame(centroid); const inv=Cesium.Matrix4.inverseTransformation(enu,new Cesium.Matrix4()); const local=sel.positions.map(p=>Cesium.Matrix4.multiplyByPoint(inv,p,new Cesium.Cartesian3())); let area=0; for(let i=0;i<local.length;i++){const j=(i+1)%local.length; area+=local[i].x*local[j].y-local[j].x*local[i].y;} if(area<0) local.reverse(); const pip=p=>{let inside=false; for(let i=0,j=local.length-1;i<local.length;j=i++) {const xi=local[i].x, yi=local[i].y, xj=local[j].x, yj=local[j].y; const inter=((yi>p.y)!==(yj>p.y)) && (p.x < (xj-xi)*(p.y-yi)/(yj-yi+1e-12)+xi); if(inter) inside=!inside;} return inside;}; let hidden=0; const stack=[ts.root]; while(stack.length){const t=stack.pop(); if(t?.children) stack.push(...t.children); const center=t?.boundingVolume?.boundingSphere?.center || t?.boundingVolume?.center; if(center){const lc=Cesium.Matrix4.multiplyByPoint(inv,center,new Cesium.Cartesian3()); if(pip(lc)){ if(t.content&&t.content.show!==undefined){t.content.show=false; hidden++;}}}} __ADMIN_VIEWER.scene.requestRender(); return {hidden};})()

// 11. Depth test against terrain ON (sometimes helps visual)
__ADMIN_VIEWER.scene.globe.depthTestAgainstTerrain = true; __ADMIN_VIEWER.scene.requestRender(); 'depthTestAgainstTerrain on'




__ADMIN_VIEWER && __ADMIN_TILESET ? 'OK globals' : 'MISSING'
'OK globals'
(() => { const ts=__ADMIN_TILESET; return ts?.clippingPlanes ? ts.clippingPlanes.length : 'no planes'; })()
5
(() => { const cp=__ADMIN_TILESET?.clippingPlanes; if(!cp||!cp.length) return 'no planes'; const p=cp.get(0); return {normal:p.normal, distance:p.distance}; })()

{normal: UpdateChangedCartesian3, distance: 12948.905542591121}
(() => { const ts=__ADMIN_TILESET; const cp=ts?.clippingPlanes; if(!cp) return 'no planes'; const c=ts.root.boundingSphere.center; const out=[]; for(let i=0;i<cp.length;i++){const p=cp.get(i); out.push({i, signed: Cesium.Cartesian3.dot(p.normal,c)+p.distance});} return out; })()

VM4909:1 Uncaught ReferenceError: Cesium is not defined
    at <anonymous>:1:215
    at <anonymous>:1:278
(anonymous) @ VM4909:1
(anonymous) @ VM4909:1
(() => { const t=__ADMIN_TILESET?.root; const m=t?.content?._model; return m ? {has:m.clippingPlanes!=null} : 'no model'; })()

'no model'
(() => {const ts=__ADMIN_TILESET, cp=ts?.clippingPlanes; if(!ts||!cp) return 'missing'; let applied=0; const stack=[ts.root]; while(stack.length){const tile=stack.pop(); if(tile?.children) stack.push(...tile.children); const m=tile?.content?._model; if(m){m.clippingPlanes=cp; applied++;}} return {applied};})()

cesium.js?v=a465052b:107625 Uncaught DeveloperError {name: 'DeveloperError', message: 'ClippingPlaneCollection should only be assigned to one object', stack: 'Error\n    at new DeveloperError (http://localhost:…    at <anonymous>:1:273\n    at <anonymous>:1:310'}message: "ClippingPlaneCollection should only be assigned to one object"name: "DeveloperError"stack: "Error\n    at new DeveloperError (http://localhost:5173/node_modules/.vite/deps/cesium.js?v=a465052b:7487:11)\n    at ClippingPlaneCollection.setOwner (http://localhost:5173/node_modules/.vite/deps/cesium.js?v=a465052b:107625:13)\n    at Model.set (http://localhost:5173/node_modules/.vite/deps/cesium.js?v=a465052b:149975:41)\n    at <anonymous>:1:273\n    at <anonymous>:1:310"[[Prototype]]: Error
ClippingPlaneCollection.setOwner @ cesium.js?v=a465052b:107625
set @ cesium.js?v=a465052b:149975
(anonymous) @ VM4917:1
(anonymous) @ VM4917:1
__ADMIN_TILESET.style = new Cesium.Cesium3DTileStyle({ color: 'color("yellow")' }); __ADMIN_VIEWER.scene.requestRender(); 'styled'

VM4921:1 Uncaught ReferenceError: Cesium is not defined
    at <anonymous>:1:29
(anonymous) @ VM4921:1
(() => {const ts=__ADMIN_TILESET; if(!ts) return 'no tileset'; const c=ts.root.boundingSphere.center; const n=Cesium.Cartesian3.normalize(c,new Cesium.Cartesian3()); const d=-Cesium.Cartesian3.dot(n,c); ts.clippingPlanes=new Cesium.ClippingPlaneCollection({planes:[new Cesium.ClippingPlane(n,d)], edgeWidth:1, edgeColor:Cesium.Color.CYAN}); return 'single plane applied';})()

VM4925:1 Uncaught ReferenceError: Cesium is not defined
    at <anonymous>:1:111
    at <anonymous>:1:374
(anonymous) @ VM4925:1
(anonymous) @ VM4925:1
(() => { if(__ADMIN_TILESET){ __ADMIN_TILESET.clippingPlanes=undefined; } return 'clipping removed'; })()

'clipping removed'
hook.js:608 An error occurred while rendering.  Rendering has stopped.
TypeError: Cannot read properties of undefined (reading '_target')
TypeError: Cannot read properties of undefined (reading '_target')
    at UniformSampler.set (http://localhost:5173/node_modules/.vite/deps/cesium.js?v=a465052b:68601:21)
    at ShaderProgram._setUniforms (http://localhost:5173/node_modules/.vite/deps/cesium.js?v=a465052b:69528:17)
    at continueDraw (http://localhost:5173/node_modules/.vite/deps/cesium.js?v=a465052b:75844:17)
    at Context.draw (http://localhost:5173/node_modules/.vite/deps/cesium.js?v=a465052b:75902:3)
    at DrawCommand.execute (http://localhost:5173/node_modules/.vite/deps/cesium.js?v=a465052b:67334:11)
    at executeCommand (http://localhost:5173/node_modules/.vite/deps/cesium.js?v=a465052b:210520:13)
    at performPass (http://localhost:5173/node_modules/.vite/deps/cesium.js?v=a465052b:210717:7)
    at executeCommands2 (http://localhost:5173/node_modules/.vite/deps/cesium.js?v=a465052b:210784:22)
    at executeCommandsInViewport (http://localhost:5173/node_modules/.vite/deps/cesium.js?v=a465052b:211189:3)
    at Scene4.updateAndExecuteCommands (http://localhost:5173/node_modules/.vite/deps/cesium.js?v=a465052b:211003:5)
overrideMethod @ hook.js:608
CesiumWidget.showErrorPanel @ cesium.js?v=a465052b:215014
CesiumWidget._onRenderError @ cesium.js?v=a465052b:214551
Event.raiseEvent @ cesium.js?v=a465052b:13876
tryAndCatchError @ cesium.js?v=a465052b:211790
Scene4.render @ cesium.js?v=a465052b:211843
CesiumWidget.render @ cesium.js?v=a465052b:215088
render2 @ cesium.js?v=a465052b:214334
requestAnimationFrame
render2 @ cesium.js?v=a465052b:214335
requestAnimationFrame
render2 @ cesium.js?v=a465052b:214335
requestAnimationFrame
render2 @ cesium.js?v=a465052b:214335
requestAnimationFrame
render2 @ cesium.js?v=a465052b:214335
requestAnimationFrame
render2 @ cesium.js?v=a465052b:214335
requestAnimationFrame
render2 @ cesium.js?v=a465052b:214335
requestAnimationFrame
render2 @ cesium.js?v=a465052b:214335
requestAnimationFrame
render2 @ cesium.js?v=a465052b:214335
requestAnimationFrame
render2 @ cesium.js?v=a465052b:214335
requestAnimationFrame
render2 @ cesium.js?v=a465052b:214335
requestAnimationFrame
render2 @ cesium.js?v=a465052b:214335
requestAnimationFrame
render2 @ cesium.js?v=a465052b:214335
requestAnimationFrame
render2 @ cesium.js?v=a465052b:214335
requestAnimationFrame
render2 @ cesium.js?v=a465052b:214335
requestAnimationFrame
render2 @ cesium.js?v=a465052b:214335
requestAnimationFrame
render2 @ cesium.js?v=a465052b:214335
requestAnimationFrame
render2 @ cesium.js?v=a465052b:214335
requestAnimationFrame
render2 @ cesium.js?v=a465052b:214335
requestAnimationFrame
render2 @ cesium.js?v=a465052b:214335
requestAnimationFrame
render2 @ cesium.js?v=a465052b:214335
requestAnimationFrame
render2 @ cesium.js?v=a465052b:214335
requestAnimationFrame
render2 @ cesium.js?v=a465052b:214335
requestAnimationFrame
render2 @ cesium.js?v=a465052b:214335
requestAnimationFrame
render2 @ cesium.js?v=a465052b:214335
requestAnimationFrame
render2 @ cesium.js?v=a465052b:214335
requestAnimationFrame
render2 @ cesium.js?v=a465052b:214335
requestAnimationFrame
render2 @ cesium.js?v=a465052b:214335
requestAnimationFrame
render2 @ cesium.js?v=a465052b:214335
requestAnimationFrame
render2 @ cesium.js?v=a465052b:214335
requestAnimationFrame
render2 @ cesium.js?v=a465052b:214335
requestAnimationFrame
render2 @ cesium.js?v=a465052b:214335
requestAnimationFrame
render2 @ cesium.js?v=a465052b:214335
(() => {const ts=__ADMIN_TILESET, sel=window.__LAST_SELECTION; if(!ts||!sel?.positions?.length) return 'no selection'; const centroid=sel.centroid||sel.positions[0]; const enu=Cesium.Transforms.eastNorthUpToFixedFrame(centroid); const inv=Cesium.Matrix4.inverseTransformation(enu,new Cesium.Matrix4()); const local=sel.positions.map(p=>Cesium.Matrix4.multiplyByPoint(inv,p,new Cesium.Cartesian3())); let area=0; for(let i=0;i<local.length;i++){const j=(i+1)%local.length; area+=local[i].x*local[j].y-local[j].x*local[i].y;} if(area<0) local.reverse(); const pip=p=>{let inside=false; for(let i=0,j=local.length-1;i<local.length;j=i++) {const xi=local[i].x, yi=local[i].y, xj=local[j].x, yj=local[j].y; const inter=((yi>p.y)!==(yj>p.y)) && (p.x < (xj-xi)*(p.y-yi)/(yj-yi+1e-12)+xi); if(inter) inside=!inside;} return inside;}; let hidden=0; const stack=[ts.root]; while(stack.length){const t=stack.pop(); if(t?.children) stack.push(...t.children); const center=t?.boundingVolume?.boundingSphere?.center || t?.boundingVolume?.center; if(center){const lc=Cesium.Matrix4.multiplyByPoint(inv,center,new Cesium.Cartesian3()); if(pip(lc)){ if(t.content&&t.content.show!==undefined){t.content.show=false; hidden++;}}}} __ADMIN_VIEWER.scene.requestRender(); return {hidden};})()

'no selection'
__ADMIN_VIEWER.scene.globe.depthTestAgainstTerrain = true; __ADMIN_VIEWER.scene.requestRender(); 'depthTestAgainstTerrain on'
'depthTestAgainstTerrain on'
