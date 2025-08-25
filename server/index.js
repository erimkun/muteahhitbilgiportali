const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const db = require('./database.js');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Alias: serve the same files also under /upload/* so frontend can use either
app.use('/upload', express.static(path.join(__dirname, 'uploads')));

// File upload setup
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const album = req.params.album || 'misc';
    const albumDir = path.join(uploadsDir, album);
    if (!fs.existsSync(albumDir)) fs.mkdirSync(albumDir, { recursive: true });
    cb(null, albumDir);
  },
  filename: function (req, file, cb) {
    const safeName = Date.now() + '_' + file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
    cb(null, safeName);
  }
});
const upload = multer({ storage });

// Basic route to check if the server is running
app.get('/', (req, res) => {
  res.send('Server is running!');
});

// Assets API
app.get('/api/assets', (req, res) => {
  const sql = 'SELECT * FROM project_assets ORDER BY created_at DESC LIMIT 1';
  db.get(sql, [], (err, row) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.json({ message: 'success', data: row });
  });
});

// Upsert assets (creates a new snapshot row)
app.put('/api/assets', (req, res) => {
  const {
    fbx_zip_url,
    drone_photos_gallery_url,
    drone_photos_zip_url,
    drone_video_url,
    view_360_url,
    orthophoto_url,
    floor_plans_gallery_url,
    floor_plans_autocad_url,
    floor_plans_zip_url
  } = req.body;

  const insert = `INSERT INTO project_assets (
    fbx_zip_url,
    drone_photos_gallery_url,
    drone_photos_zip_url,
    drone_video_url,
    view_360_url,
    orthophoto_url,
    floor_plans_gallery_url,
    floor_plans_autocad_url,
    floor_plans_zip_url
  ) VALUES (?,?,?,?,?,?,?,?,?)`;

  db.run(
    insert,
    [
      fbx_zip_url || null,
      drone_photos_gallery_url || null,
      drone_photos_zip_url || null,
      drone_video_url || null,
      view_360_url || null,
      orthophoto_url || null,
      floor_plans_gallery_url || null,
      floor_plans_autocad_url || null,
      floor_plans_zip_url || null
    ],
    function (err) {
      if (err) {
        res.status(400).json({ error: err.message });
        return;
      }
      res.json({ message: 'success', data: { id: this.lastID } });
    }
  );
});

// List gallery images by album
app.get('/api/gallery/:album', (req, res) => {
  const { album } = req.params;
  db.all('SELECT id, album, filename, url, title, created_at FROM gallery_images WHERE album = ? ORDER BY created_at DESC', [album], (err, rows) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json(rows);
  });
});

// Upload images to an album
app.post('/api/gallery/:album', upload.array('images', 50), (req, res) => {
  const { album } = req.params;
  if (!req.files || !req.files.length) return res.status(400).json({ error: 'No files' });
  const stmt = db.prepare('INSERT INTO gallery_images (album, filename, url, title) VALUES (?,?,?,?)');
  for (const f of req.files) {
    const fileUrl = `/upload/${album}/${f.filename}`;
    stmt.run([album, f.filename, fileUrl, f.originalname]);
  }
  stmt.finalize((err) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ message: 'uploaded', count: req.files.length });
  });
});

// Delete a single image by id within an album
app.delete('/api/gallery/:album/:id', (req, res) => {
  const { album, id } = req.params;
  db.get('SELECT filename FROM gallery_images WHERE id = ? AND album = ?', [id, album], (err, row) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Not found' });
    const filePath = path.join(uploadsDir, album, row.filename);
    fs.unlink(filePath, () => {
      db.run('DELETE FROM gallery_images WHERE id = ?', [id], function (err2) {
        if (err2) return res.status(400).json({ error: err2.message });
        return res.json({ message: 'deleted', id: Number(id) });
      });
    });
  });
});

// Bulk delete by ids array in body: { ids: [1,2,3] }
app.delete('/api/gallery/:album', (req, res) => {
  const { album } = req.params;
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((n) => Number.isInteger(n) || /^\d+$/.test(n)) : [];
  if (!ids.length) return res.status(400).json({ error: 'Provide ids: [number]' });
  db.all(`SELECT id, filename FROM gallery_images WHERE album = ? AND id IN (${ids.map(() => '?').join(',')})`, [album, ...ids], (err, rows) => {
    if (err) return res.status(400).json({ error: err.message });
    const foundIds = new Set(rows.map((r) => r.id));
    for (const r of rows) {
      const filePath = path.join(uploadsDir, album, r.filename);
      fs.unlink(filePath, () => {});
    }
    db.run(`DELETE FROM gallery_images WHERE album = ? AND id IN (${ids.map(() => '?').join(',')})`, [album, ...ids], function (err2) {
      if (err2) return res.status(400).json({ error: err2.message });
      res.json({ message: 'deleted', deletedCount: this.changes, requested: ids.length, notFound: ids.filter((i) => !foundIds.has(Number(i))) });
    });
  });
});

// Simple browser upload page (temporary helper)
app.get('/upload', (req, res) => {
  res.send(`<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Upload</title>
  <style>
    body{font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#0b0b0f;color:#fff;margin:0;padding:24px}
    .card{max-width:860px;margin:0 auto;background:rgba(255,255,255,.04);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:20px}
    label{display:block;margin:10px 0 6px;color:#cbd5e1}
    select,input[type=text]{background:rgba(0,0,0,.3);color:#fff;border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:10px;width:100%}
    input[type=file]{margin:8px 0}
    button{background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:10px;padding:10px 14px;cursor:pointer}
    button:hover{background:rgba(255,255,255,.16)}
    .row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .mt{margin-top:12px}
    .log{white-space:pre-wrap;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:10px;margin-top:12px}
  </style>
  </head>
<body>
  <div class="card">
    <h2>Upload images</h2>
    <div class="row">
      <div>
        <label>Album</label>
        <select id="album">
          <option value="drone_photos">drone_photos</option>
          <option value="floor_plans">floor_plans</option>
          <option value="orthophoto">orthophoto</option>
          <option value="view_360">view_360</option>
          <option value="files">files</option>
          <option value="other">other</option>
        </select>
      </div>
      <div>
        <label>Title (optional, ignored for now)</label>
        <input id="title" type="text" placeholder="optional" />
      </div>
    </div>
    <label class="mt">Select files</label>
    <input id="files" type="file" multiple />
    <div class="mt">
      <button id="btn">Upload</button>
    </div>
    <div class="log" id="log"></div>
    <div class="mt">
      <h3>Current items</h3>
      <div id="list" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px"></div>
    </div>
  </div>

  <script>
    const $ = (id) => document.getElementById(id);
    async function refreshList(){
      const album = $('album').value;
      const res = await fetch('/api/gallery/' + album);
      const items = await res.json();
      const list = $('list');
      list.innerHTML = '';
      items.forEach(it => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:8px;overflow:hidden;';
        const isPdf = (it.url || '').toLowerCase().endsWith('.pdf') || (it.url || '').toLowerCase().includes('.pdf?');
        const thumb = isPdf
          ? '<div style="width:56px;height:40px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:6px;">\
               <svg viewBox="0 0 24 24" width="22" height="22" stroke="rgb(252,165,165)" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">\
                 <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>\
                 <path d="M14 2v4a2 2 0 0 0 2 2h4"/>\
               </svg>\
             </div>'
          : '<img src="' + it.url + '" style="width:56px;height:40px;object-fit:cover;border-radius:6px;"/>';
        row.innerHTML = 
          thumb +
          '<div style="flex:1 1 auto;font-size:12px;color:#e5e7eb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (it.title||it.filename) + '</div>' +
          '<button data-id="'+it.id+'" style="background:rgba(239,68,68,.15);color:#fecaca;border:1px solid rgba(239,68,68,.3);border-radius:8px;padding:6px 10px;cursor:pointer;">Sil</button>';
        row.querySelector('button').onclick = async (ev) => {
          const id = ev.currentTarget.getAttribute('data-id');
          if (!confirm('Silinsin mi? #' + id)) return;
          const del = await fetch('/api/gallery/' + album + '/' + id, { method: 'DELETE' });
          await del.json();
          refreshList();
        };
        list.appendChild(row);
      });
    }
    $('btn').addEventListener('click', async () => {
      const album = $('album').value;
      const files = $('files').files;
      if (!files.length){ $('log').textContent = 'Select at least one file.'; return; }
      const fd = new FormData();
      for (const f of files) fd.append('images', f, f.name);
      $('btn').disabled = true; $('btn').textContent = 'Uploading...'; $('log').textContent='';
      try{
        const res = await fetch('/api/gallery/' + album, { method:'POST', body: fd });
        const json = await res.json();
        $('log').textContent = JSON.stringify(json, null, 2);
        await refreshList();
      }catch(e){ $('log').textContent = e.message; }
      $('btn').disabled = false; $('btn').textContent = 'Upload';
    });
    $('album').addEventListener('change', refreshList);
    // --- Drone Video (YouTube URL) assets helper ---
    // Add a small assets section below the list
    (function addAssetsSection(){
      const card = document.querySelector('.card');
      const wrap = document.createElement('div');
      wrap.className = 'mt';
      wrap.innerHTML = '<h2>Project Assets</h2>'+
        '<label class="mt">Drone Video (YouTube URL)</label>'+
        '<input id="droneVideoUrl" type="text" placeholder="https://youtu.be/VIDEO_ID or https://www.youtube.com/watch?v=..." />'+
        '<div class="mt">'+
        '  <button id="saveAssets">Save</button>'+
        '  <span id="assetsMsg" style="margin-left:8px;color:#cbd5e1;font-size:12px"></span>'+
        '</div>';
      card.appendChild(wrap);
    })();

    async function loadAssets(){
      try{
        const res = await fetch('/api/assets');
        const json = await res.json();
        const row = json && json.data ? json.data : null;
        if (row){
          $('droneVideoUrl').value = row.drone_video_url || '';
        }
      }catch(e){ /* ignore */ }
    }
    document.addEventListener('click', async (ev)=>{
      if(ev.target && ev.target.id === 'saveAssets'){
        const url = $('droneVideoUrl').value.trim();
        ev.target.disabled = true; $('assetsMsg').textContent = 'Saving...';
        try{
          const res = await fetch('/api/assets', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ drone_video_url: url || null }) });
          const js = await res.json();
          $('assetsMsg').textContent = res.ok ? 'Saved.' : ('Error: ' + (js && js.error ? js.error : res.status));
        }catch(e){ $('assetsMsg').textContent = e.message; }
        ev.target.disabled = false;
      }
    });

    refreshList();
    loadAssets();
  </script>
</body>
</html>`);
});

// Get the latest published model version
app.get('/api/model/published', (req, res) => {
  const sql = "SELECT * FROM model_versions WHERE is_published = TRUE ORDER BY created_at DESC LIMIT 1";
  db.get(sql, [], (err, row) => {
    if (err) {
      res.status(400).json({"error":err.message});
      return;
    }
    res.json({
      "message":"success",
      "data": row
    })
  });
});

// Get the latest model version (published or not)
app.get('/api/model/latest', (req, res) => {
  const sql = "SELECT * FROM model_versions ORDER BY created_at DESC LIMIT 1";
  db.get(sql, [], (err, row) => {
    if (err) {
      res.status(400).json({"error":err.message});
      return;
    }
    res.json({
      "message":"success",
      "data": row
    })
  });
});

// Get all model versions (for restore)
app.get('/api/model/history', (req, res) => {
  const sql = "SELECT id, is_published, created_at FROM model_versions ORDER BY created_at DESC";
  db.all(sql, [], (err, rows) => {
    if (err) {
      res.status(400).json({"error":err.message});
      return;
    }
    res.json({
      "message":"success",
      "data": rows
    })
  });
});

// Create a new model version
app.post('/api/model', (req, res) => {
  const { tileset_clips, building_transform, model_clip_planes, logo_transform } = req.body;
  const sql = 'INSERT INTO model_versions (tileset_clips, building_transform, model_clip_planes, logo_transform, is_published) VALUES (?,?,?,?,?)';
  const params = [JSON.stringify(tileset_clips), JSON.stringify(building_transform), JSON.stringify(model_clip_planes), JSON.stringify(logo_transform), false];
  db.run(sql, params, function (err, result) {
    if (err){
      res.status(400).json({"error": err.message})
      return;
    }
    res.json({
      "message": "success",
      "data": { id: this.lastID }
    })
  });
});

// Publish a model version
app.put('/api/model/publish/:id', (req, res) => {
  const { id } = req.params;
  // First, unpublish all other versions
  db.run('UPDATE model_versions SET is_published = FALSE', [], function(err) {
    if (err){
      res.status(400).json({"error": err.message})
      return;
    }
    // Then, publish the new version
    db.run('UPDATE model_versions SET is_published = TRUE WHERE id = ?', [id], function(err) {
      if (err){
        res.status(400).json({"error": err.message})
        return;
      }
      res.json({ message: `Version ${id} published.` });
    });
  });
});


// Full reset
app.delete('/api/model/reset', (req, res) => {
  db.serialize(() => {
    db.run('DELETE FROM model_versions', [], (err) => {
      if (err) {
        res.status(400).json({"error": err.message});
        return;
      }
    });
    db.run('VACUUM', [], (err) => {
      if (err) {
        res.status(400).json({"error": err.message});
        return;
      }
    });
    const insert = 'INSERT INTO model_versions (tileset_clips, building_transform, model_clip_planes, logo_transform, is_published) VALUES (?,?,?,?,?)'
    db.run(insert, ["[]","{}","[]","{}", true], (err) => {
      if (err) {
        res.status(400).json({"error": err.message});
        return;
      }
      res.json({ message: 'Database reset to initial state.' });
    });
  });
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});