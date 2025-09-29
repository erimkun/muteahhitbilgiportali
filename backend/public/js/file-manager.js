// Extracted from backup file-manager.html

let selectedProject = null;
let projects = [];
let users = [];

// Global fileExtensions definition
const fileExtensions = {
  drone_photos_jpg: ['.jpg', '.jpeg'],
  drone_photos_zip: ['.zip', '.rar'],
  floor_plans_jpeg: ['.jpg', '.jpeg', '.png'],
  floor_plans_dwg: ['.dwg', '.dxf'],
  orthophoto_jpeg: ['.jpg', '.jpeg'],
  orthophoto_tiff: ['.tiff', '.tif'],
  view_360: ['.jpg', '.jpeg', '.png'],
  models_fbx: ['.zip', '.rar'],
  documents_pdf: ['.pdf', '.doc', '.docx'],
  files_zip: ['.zip', '.rar', '.7z'],
  other: [],
  contractor_depot: null,
  frontend_models: ['.gltf', '.glb', '.bin'],
  frontend_tiles: ['.json', '.bin', '.b3dm', '.i3dm', '.pnts', '.cmpt'],
  frontend_360views: ['.jpg', '.jpeg', '.png'],
  frontend_tiles_zip: ['.zip', '.rar', '.7z']
};

// DOMContentLoaded handlers and all functions moved from original file
document.addEventListener('DOMContentLoaded', function() {
  loadAdminInfo();
  loadProjects();
  loadUsers();
  loadStats();
  setupFileUpload();
});

async function loadAdminInfo() {
  try {
    const response = await fetch('/session', { credentials: 'include' });
    if (response.ok) {
      const data = await response.json();
      if (data.admin) {
        document.getElementById('adminInfo').textContent = `Admin: ${data.admin.phone} (${data.admin.role})`;
      }
    }
  } catch (error) {
    console.error('Admin bilgileri yüklenemedi:', error);
  }
}

async function loadProjects() {
  try {
    const response = await fetch('/api/projects', { credentials: 'include' });
    if (response.ok) {
      const data = await response.json();
      projects = data.data;
      renderProjectList();
      updateUploadProjectSelect();
    }
  } catch (error) {
    showMessage('Projeler yüklenirken hata oluştu', 'error');
  }
}

function renderProjectList() {
  const list = document.getElementById('projectList');
  list.innerHTML = '';

  // Filter to only show active projects
  const activeProjects = projects.filter(project => project.is_active);

  activeProjects.forEach(project => {
    const item = document.createElement('li');
    item.className = 'project-item';
    item.innerHTML = `
      <div style="font-weight: 600;">${project.project_code}</div>
      <div style="font-size: 12px; opacity: 0.8;">${project.name}</div>
      <div style="font-size: 11px; opacity: 0.6; margin-top: 4px;">
        <span class="status-badge ${project.is_active ? 'status-active' : 'status-inactive'}">
          ${project.is_active ? 'Aktif' : 'Pasif'}
        </span>
      </div>
    `;
    item.dataset.projectId = project.id;
    list.appendChild(item);
  });
}

function updateUploadProjectSelect() {
  const select = document.getElementById('uploadProject');
  select.innerHTML = '<option value="">Proje seçin...</option>';
  
  projects.forEach(project => {
    if (project.is_active) {
      const option = document.createElement('option');
      option.value = project.project_code;
      option.textContent = `${project.project_code} - ${project.name}`;
      select.appendChild(option);
    }
  });
}

async function selectProject(projectId) {
  const project = projects.find(p => p.id === projectId);
  if (!project) return;
  
  selectedProject = project;
  
  document.querySelectorAll('.project-item').forEach(item => {
    item.classList.remove('active');
  });
  
  const clickedItem = document.querySelector(`[data-project-id="${projectId}"]`);
  if (clickedItem) {
    clickedItem.classList.add('active');
  }
  
  await loadProjectFiles(project.id);
}

// --- Remaining functions extracted from backup ---

// File upload helpers
function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }

function setupFileUpload() {
  const uploadZone = document.getElementById('uploadZone');
  const fileInput = document.getElementById('fileInput');

  if (!uploadZone || !fileInput) return;

  uploadZone.onclick = () => fileInput.click();

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    uploadZone.addEventListener(eventName, preventDefaults, false);
  });

  uploadZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    // default category selected for legacy single-upload zone
    handleFileUpload(null, files);
  });

  fileInput.addEventListener('change', function() {
    updateSelectedFiles();
  });
}

function updateSelectedFiles() {
  const files = document.getElementById('fileInput').files;
  const container = document.getElementById('selectedFiles');
  const uploadBtn = document.getElementById('uploadBtn');
  
  if (files.length === 0) {
    container.innerHTML = '';
    uploadBtn.disabled = true;
    return;
  }
  
  container.innerHTML = `
    <h4>Seçilen Dosyalar (${files.length})</h4>
    ${Array.from(files).map(file => `
      <div class="file-item">
        <div class="file-name">📄 ${file.name}</div>
        <div style="font-size: 11px; opacity: 0.7;">${(file.size / 1024 / 1024).toFixed(2)} MB</div>
      </div>
    `).join('')}
  `;
  
  uploadBtn.disabled = false;
}

function setupCategoryEventListeners(category) {
  const zone = document.querySelector(`[data-category="${category}"]`);
  const inputId = zone?.getAttribute('data-input');
  const input = document.getElementById(inputId);
  
  if (zone && input) {
    // Click handler
    zone.onclick = () => input.click();
    
    // Drag and drop handlers
    zone.addEventListener('dragover', function(e) {
      e.preventDefault();
      this.classList.add('drag-over');
    });
    
    zone.addEventListener('dragleave', function(e) {
      e.preventDefault();
      this.classList.remove('drag-over');
    });
    
    zone.addEventListener('drop', function(e) {
      e.preventDefault();
      this.classList.remove('drag-over');
      const category = this.getAttribute('data-category');
      const files = e.dataTransfer.files;
      handleFileUpload(category, files);
    });
    
    // File input change
    input.onchange = function() {
      const category = this.getAttribute('data-category');
      handleFileUpload(category, this.files);
    };
  }
}

async function handleFileUpload(category, fileList) {
  const uploadBtn = document.getElementById('uploadBtn');
  const progressBar = document.getElementById('uploadProgress');
  const progressFill = document.getElementById('uploadProgressFill');

  if (!fileList || fileList.length === 0) return;

  if (uploadBtn) uploadBtn.disabled = true;
  const formData = new FormData();
  Array.from(fileList).forEach(f => formData.append('files', f));
  if (selectedProject) formData.append('projectId', selectedProject.id);
  if (category) formData.append('category', category);

  try {
    if (progressBar) { progressBar.style.display = 'block'; if (progressFill) progressFill.style.width = '0%'; }

    const response = await fetch('/admin/projects/upload', {
      method: 'POST',
      credentials: 'include',
      body: formData
    });

    if (response.ok) {
      const result = await response.json();
      showMessage('✅ Dosyalar yüklendi', 'success');
      // Upload sonuçlarını göster (sadece kategori upload'larında)
      if (category) displayUploadResults(category, result);
      if (selectedProject) await loadProjectFiles(selectedProject.id);
    } else {
      const err = await response.json().catch(()=>({ error: 'Yükleme başarısız' }));
      showMessage('❌ ' + (err.error || 'Yükleme başarısız'), 'error');
    }
  } catch (error) {
    showMessage('Yükleme hatası: ' + error.message, 'error');
  } finally {
    if (uploadBtn) uploadBtn.disabled = false;
    if (progressBar) progressBar.style.display = 'none';
  }
}

async function uploadFiles() {
  const fileInput = document.getElementById('fileInput');
  if (fileInput && fileInput.files && fileInput.files.length > 0) {
    await handleFileUpload(null, fileInput.files);
  } else {
    showMessage('Yüklenecek dosya seçilmedi', 'warning');
  }
}

// Upload sonuçlarını göster
function displayUploadResults(category, uploadData) {
  if (!uploadData || !uploadData.files) return;
  
  const uploadArea = document.getElementById(`upload-${category}`);
  let resultsHTML = '<div class="upload-results" style="margin-top: 10px;">';
  
  uploadData.files.forEach(file => {
    resultsHTML += `<div class="upload-result-item" style="margin: 5px 0; font-size: 11px; opacity: 0.8;">`;
    resultsHTML += `📄 ${file.originalName || file.name}`;
    
    if (file.renamed) {
      resultsHTML += ` → ${file.name}`;
    }
    
    if (file.extracted) {
      resultsHTML += `<br>📦 ZIP çıkarıldı: ${file.extractedFiles} dosya`;
    }
    
    resultsHTML += `</div>`;
  });
  
  resultsHTML += '</div>';
  
  // Sonuçları 10 saniye göster
  uploadArea.innerHTML += resultsHTML;
  setTimeout(() => {
    const results = uploadArea.querySelector('.upload-results');
    if (results) results.remove();
  }, 10000);
}

// Project file loading and rendering
async function loadProjectFiles(projectId) {
  if (!projectId) return;
  try {
    // explicit category list (includes frontend asset categories)
    const categories = [
      'drone_photos_jpg', 'drone_photos_zip', 'floor_plans_jpeg', 'floor_plans_dwg',
      'orthophoto_jpeg', 'orthophoto_tiff', 'view_360', 'models_fbx',
      'documents_pdf', 'files_zip', 'other', 'contractor_depot',
      'frontend_models', 'frontend_tiles', 'frontend_360views', 'frontend_tiles_zip'
    ];

    const categoryNames = {
      drone_photos_jpg: '🚁 Drone Fotoğrafları (JPEG)',
      drone_photos_zip: '🚁 Drone Fotoğrafları (ZIP)',
      floor_plans_jpeg: '📐 Kat Planları (JPEG)',
      floor_plans_dwg: '📐 Kat Planları (DWG)',
      orthophoto_jpeg: '🗺️ Ortofoto (JPEG)',
      orthophoto_tiff: '🗺️ Ortofoto (TIFF)',
      view_360: '📷 360° Görüntüler',
      models_fbx: '🏗️ 3D Modeller (FBX)',
      documents_pdf: '📄 Belgeler (PDF)',
      files_zip: '📦 Arşiv Dosyaları (ZIP)',
      other: '📁 Diğer',
      contractor_depot: '🏗️ Müteahhit Deposu (Serbest)',
      frontend_models: '🎭 3D Modeller (Frontend)',
      frontend_tiles: '🎭 Tileset Dosyaları (Frontend)',
      frontend_360views: '🎭 360° Görüntüler (Frontend)',
      frontend_tiles_zip: '🎭 Tileset ZIP Klasörü'
    };

    const categoryDescriptions = {
      frontend_models: 'Cesium için GLTF/GLB modeller - Otomatik olarak bina_model.gltf olarak adlandırılır',
      frontend_tiles: 'Cesium tileset dosyaları - JSON dosyası otomatik olarak sezyum_{projeKodu}.json olur',
      frontend_360views: 'Panoramik görüntüler - Otomatik olarak panorama_{projeKodu}.jpg formatında adlandırılır',
      frontend_tiles_zip: 'Tileset ZIP klasörleri - Klasör yapısı korunarak çıkarılır ve ana JSON yeniden adlandırılır'
    };

    const response = await fetch(`/admin/projects/${projectId}/files`, { credentials: 'include' });
    if (!response.ok) {
      const filesContent = document.getElementById('filesContent');
      if (filesContent) filesContent.innerHTML = '<div style="text-align:center; padding:20px;">Dosyalar alınamadı</div>';
      return;
    }

  const respJson = await response.json();
    // API uses formatSuccessResponse({ project, files }) -> { success, message, data: { project, files }, ... }
    // but older/alternate shapes might return { files: {..} } directly. Handle both.
    let filesByCategory = (respJson && respJson.data && respJson.data.files) ? respJson.data.files : (respJson.files || {});

    // If API returned an array of files instead of grouped object, group them by file.category
    if (Array.isArray(filesByCategory)) {
      const grouped = {};
      filesByCategory.forEach(f => {
        const cat = (f && f.category) ? f.category : 'other';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(f);
      });
      filesByCategory = grouped;
    }

    // Debug: log what we received so we can trace mismatches between backend and frontend
    console.debug('[file-manager] filesByCategory keys:', Object.keys(filesByCategory || {}));
  // Prefer project info returned by the API if local projects list doesn't have it
  selectedProject = projects.find(p => String(p.id) === String(projectId)) || (respJson && respJson.data && respJson.data.project) || selectedProject;
  // selectedProject might be an object or a simple id/string; normalize to object with name
  if (selectedProject && typeof selectedProject !== 'object') {
    selectedProject = { id: selectedProject, name: `Proje ${selectedProject}` };
  }

    // render header + youtube card
    const content = document.getElementById('filesContent');
    if (!content) return;

    content.innerHTML = `
      <h3>📁 ${selectedProject.name} Dosyaları</h3>
      <div class="category-card" style="margin-top:10px; margin-bottom:20px;">
        <div class="category-header">
          <div class="category-title">🎥 Drone Videosu (YouTube URL)</div>
          <div>
            <button class="btn btn-success" id="saveYoutubeUrlBtn">Kaydet</button>
          </div>
        </div>
        <div class="form-group" style="margin:0;">
          <input type="text" id="youtubeUrlInput" placeholder="https://www.youtube.com/watch?v=... veya https://youtu.be/..." />
          <small style="display:block; opacity:0.7; margin-top:6px;">Bu bağlantı frontend'de Drone Videosu kartında gösterilir.</small>
        </div>
        <div id="youtubeSaveMsg" class="message" style="display:none; margin-top:10px;"></div>
      </div>
      <div class="file-categories" id="fileCategories"></div>
    `;

    const container = document.getElementById('fileCategories');
    // build all category cards
    categories.forEach(cat => {
      const card = document.createElement('div');
      card.className = 'category-card' + (cat.startsWith('frontend_') ? ' frontend-asset' : '');
      card.innerHTML = `
        <div class="category-header">
          <div class="category-title">${categoryNames[cat] || cat}</div>
          <div class="file-count" id="count-${cat}">0</div>
        </div>
        <div class="upload-area" id="upload-${cat}">
          <input type="file" id="file-input-${cat}" multiple style="display: none;" data-category="${cat}" accept="${fileExtensions[cat] && fileExtensions[cat].length > 0 ? fileExtensions[cat].join(',') : '*'}">
          <div class="upload-zone" data-category="${cat}" data-input="file-input-${cat}">
            <span>📁 Dosya Yükle veya Sürükle</span>
            <small style="display:block; margin-top:5px; opacity:0.7;">${fileExtensions[cat] && fileExtensions[cat].length > 0 ? `İzin verilen: ${fileExtensions[cat].join(', ')}` : 'Tüm dosya türleri'}</small>
            ${categoryDescriptions[cat] ? `<small style="display:block; margin-top:3px; opacity:0.6; font-style:italic;">ℹ️ ${categoryDescriptions[cat]}</small>` : ''}
          </div>
        </div>
        <div class="file-list" id="files-${cat}"><div style="text-align:center; padding:20px; opacity:0.6;">Yükleniyor...</div></div>
      `;
      container.appendChild(card);
    });

    // Populate files per category using filesByCategory
    categories.forEach(cat => {
      const listEl = document.getElementById(`files-${cat}`);
      const files = filesByCategory[cat] || [];
      const countEl = document.getElementById(`count-${cat}`);
      if (countEl) countEl.textContent = files.length;

      if (!listEl) return;
      if (files.length === 0) {
        listEl.innerHTML = '<div style="text-align:center; padding: 20px; opacity:0.6;">Dosya yok</div>';
        return;
      }

      listEl.innerHTML = files.map(file => `
        <div class="file-item">
          <div class="file-name" title="${file.name}">
            ${getFileIcon ? getFileIcon(file.name) : '📄'} ${file.name.length > 30 ? file.name.substring(0,30) + '...' : file.name}
          </div>
          <div class="file-info"><small>${(file.size || 0)}</small></div>
          <div class="file-actions">
            <button class="btn btn-secondary download-btn" data-file-path="${file.path}">⬇️</button>
            <button class="btn btn-secondary rename-btn" data-file-path="${file.path}" data-category="${cat}" data-filename="${file.name}">✏️</button>
            <button class="btn btn-danger delete-btn" data-file-path="${file.path}" data-category="${cat}" data-filename="${file.name}">🗑️</button>
          </div>
        </div>
      `).join('');
    });

    // Wire per-category upload zones
    document.querySelectorAll('.upload-zone').forEach(zone => {
      const cat = zone.getAttribute('data-category') || zone.dataset.category;
      const inputId = zone.getAttribute('data-input');
      const input = inputId ? document.getElementById(inputId) : null;

      zone.addEventListener('click', () => input && input.click());
      if (input) {
        input.addEventListener('change', () => handleFileUpload(cat, input.files));
      }

      ['dragenter','dragover','dragleave','drop'].forEach(evName => zone.addEventListener(evName, preventDefaults, false));
      zone.addEventListener('drop', (e) => handleFileUpload(cat, e.dataTransfer.files));
    });

    // Try to load current assets (YouTube URL etc.)
    let currentAssets = {};
    try {
      const assetsResp = await fetch(`/api/projects/${projectId}/assets`, { credentials: 'include' });
      if (assetsResp.ok) {
        const assetsData = await assetsResp.json();
        currentAssets = assetsData.data || {};
        const ytInput = document.getElementById('youtubeUrlInput');
        if (ytInput) ytInput.value = currentAssets.drone_video_url || '';
      }
    } catch (e) { /* ignore */ }

    // Save YouTube URL handler
    const saveBtn = document.getElementById('saveYoutubeUrlBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const input = document.getElementById('youtubeUrlInput');
        const msg = document.getElementById('youtubeSaveMsg');
        const newUrl = input.value.trim();
        try {
          const payload = {
            fbx_zip_url: currentAssets.fbx_zip_url || null,
            drone_photos_gallery_url: currentAssets.drone_photos_gallery_url || null,
            drone_photos_zip_url: currentAssets.drone_photos_zip_url || null,
            drone_video_url: newUrl || null,
            view_360_url: currentAssets.view_360_url || null,
            orthophoto_url: currentAssets.orthophoto_url || null,
            floor_plans_gallery_url: currentAssets.floor_plans_gallery_url || null,
            floor_plans_autocad_url: currentAssets.floor_plans_autocad_url || null
          };
          const resp = await fetch(`/api/projects/${projectId}/assets`, { method: 'PUT', headers: { 'Content-Type':'application/json' }, credentials: 'include', body: JSON.stringify(payload) });
          if (resp.ok) {
            msg.textContent = 'YouTube URL kaydedildi';
            msg.className = 'message success';
            msg.style.display = 'block';
            setTimeout(()=> msg.style.display = 'none', 3000);
            currentAssets.drone_video_url = newUrl;
          } else {
            const err = await resp.json().catch(()=>({}));
            msg.textContent = err.error || 'Kaydetme hatası';
            msg.className = 'message error';
            msg.style.display = 'block';
            setTimeout(()=> msg.style.display = 'none', 4000);
          }
        } catch (e) {
          const msgEl = document.getElementById('youtubeSaveMsg');
          if (msgEl) {
            msgEl.textContent = 'Bağlantı hatası';
            msgEl.className = 'message error';
            msgEl.style.display = 'block';
            setTimeout(()=> msgEl.style.display = 'none', 4000);
          }
        }
      });
    }

    // Setup event listeners after DOM is updated
    // setupCategoryEventListeners(); // Already handled above in wire per-category upload zones

  } catch (error) {
    console.error('Error loading project files:', error);
    const filesContent = document.getElementById('filesContent');
    if (filesContent) filesContent.innerHTML = '<div style="text-align:center; padding:20px;">Dosyalar alınamadı</div>';
  }
}

// File actions
function downloadFile(url) {
  window.open(url, '_blank');
}

async function deleteFile(project, category, filename) {
  if (!confirm('Bu dosyayı silmek istediğinizden emin misiniz?')) return;
  try {
    const resp = await fetch(`/admin/projects/${project}/files`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project, category, filename })
    });
    if (resp.ok) {
      showMessage('Dosya silindi', 'success');
      if (selectedProject) loadProjectFiles(selectedProject.id);
    } else {
      showMessage('Dosya silinirken hata oluştu', 'error');
    }
  } catch (error) {
    showMessage('Dosya silinirken hata oluştu', 'error');
  }
}

// Client-side rename helper that matches server expectations
async function renameFile(projectId, payload) {
  // payload can be { filePath } or { category, oldName, newName }
  try {
    const resp = await fetch(`/admin/projects/${projectId}/files/rename`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (resp.ok) {
      showMessage('Dosya adı güncellendi', 'success');
      if (selectedProject) await loadProjectFiles(selectedProject.id);
      return true;
    }
    const err = await resp.json().catch(()=>({}));
    showMessage(err.error || 'Yeniden adlandırma başarısız', 'error');
    return false;
  } catch (e) {
    showMessage('Yeniden adlandırma hatası', 'error');
    return false;
  }
}

// User management functions (extracted)
async function showAddUserForm() {
  let projOptions = '';
  try {
    const resp = await fetch('/admin/projects', { credentials: 'include' });
    if (resp.ok) {
      const data = await resp.json();
      projOptions = (data.data || []).map(p => `<option value="${p.id}">${p.project_name || p.name || `Proje ${p.id}`}</option>`).join('');
    }
  } catch (e) { /* ignore */ }

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <h3>👤 Yeni Kullanıcı Ekle</h3>
      <form id="addUserForm">
        <input name="phone" placeholder="5XXXXXXXXX" required />
        <input type="password" name="password" placeholder="Şifre" required />
        <input name="name" placeholder="İsim" />
        <select name="project_id"><option value="">Proje Seçiniz (İsteğe bağlı)</option>${projOptions}</select>
        <select name="role"><option value="user">user</option><option value="admin">admin</option></select>
        <select name="is_active"><option value="true">Aktif</option><option value="false">Pasif</option></select>
        <div class="modal-buttons"><button type="button" class="modal-cancel-btn">İptal</button><button type="submit">Ekle</button></div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector('.modal-cancel-btn').addEventListener('click', () => modal.remove());

  modal.querySelector('#addUserForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = { phone: fd.get('phone'), password: fd.get('password'), name: fd.get('name'), project_id: fd.get('project_id') || null, role: fd.get('role'), is_active: fd.get('is_active') === 'true' };
    try {
      const resp = await fetch('/admin/users', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (resp.ok) { showMessage('Kullanıcı eklendi','success'); modal.remove(); loadUsers(); }
      else { const err = await resp.json().catch(()=>({})); showMessage(err.error || 'Hata','error'); }
    } catch (err) { showMessage('Hata','error'); }
  });
}

async function loadUsers() {
  try {
    const response = await fetch('/admin/users', { credentials: 'include' });
    if (response.ok) {
      const data = await response.json();
      const users = data.data || [];
      // load assigned projects per user
      const usersWithProjects = await Promise.all(users.map(async (u) => {
        try {
          const r = await fetch(`/admin/users/${u.id}/projects`, { credentials: 'include' });
          u.assignedProjects = r.ok ? (await r.json()).data || [] : [];
        } catch (e) { u.assignedProjects = []; }
        return u;
      }));
      renderUserList(usersWithProjects);
    }
  } catch (e) { console.error(e); showMessage('Kullanıcılar yüklenemedi','error'); }
}

function renderUserList(users) {
  const tbody = document.getElementById('userTableBody');
  if (!tbody) return;
  tbody.innerHTML = users.map(u => `
    <tr>
      <td>${u.id}</td>
      <td>${u.phone}</td>
      <td>${u.role || 'user'}</td>
      <td><span style="color:${u.is_active ? '#28a745' : '#dc3545'}">${u.is_active ? 'Aktif' : 'Pasif'}</span></td>
      <td>${u.assignedProjects && u.assignedProjects.length>0 ? u.assignedProjects.map(p=>`<span style="display:inline-block;background:rgba(0,123,255,0.12);padding:2px 6px;border-radius:8px;margin:2px;font-size:11px;color:#007bff">${p.project_name||p.project_code||`Proje ${p.id}`}</span>`).join(' ') : '<span style="color:#6c757d">Atanmamış</span>'}</td>
      <td><button class="edit-user-btn" data-user-id="${u.id}">Düzenle</button> <button class="delete-user-btn" data-user-id="${u.id}">Sil</button></td>
    </tr>
  `).join('');
}

async function editUser(userId) {
  try {
    const [userR, projR, userProjR] = await Promise.all([
      fetch('/admin/users', { credentials: 'include' }),
      fetch('/admin/projects', { credentials: 'include' }),
      fetch(`/admin/users/${userId}/projects`, { credentials: 'include' })
    ]);
    if (!userR.ok) return;
    const userData = await userR.json();
    const user = (userData.data || []).find(u=>u.id==userId);
    if (!user) return;
    const projects = projR.ok ? (await projR.json()).data || [] : [];
    const userProjects = userProjR.ok ? (await userProjR.json()).data || [] : [];
    const assignedIds = userProjects.map(p=>p.id);
    const projectCheckboxes = projects.map(p=>`<div style="display:flex;align-items:center;margin-bottom:6px"><input type="checkbox" name="project_ids" value="${p.id}" id="project_${p.id}" ${assignedIds.includes(p.id)?'checked':''}><label for="project_${p.id}" style="margin-left:8px;color:white">${p.project_name||p.name||`Proje ${p.id}`}</label></div>`).join('');

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <h3>Kullanıcı Düzenle</h3>
        <form id="editUserForm">
          <input name="phone" value="${user.phone}" required />
          <input name="name" value="${user.name||''}" />
          <input type="password" name="password" placeholder="Yeni şifre (opsiyonel)" />
          <div style="max-height:200px;overflow:auto">${projectCheckboxes}</div>
          <select name="role"><option value="user" ${user.role==='user'?'selected':''}>user</option><option value="admin" ${user.role==='admin'?'selected':''}>admin</option></select>
          <select name="is_active"><option value="true" ${user.is_active?'selected':''}>Aktif</option><option value="false" ${!user.is_active?'selected':''}>Pasif</option></select>
          <div class="modal-buttons"><button type="button" class="modal-cancel-btn">İptal</button><button type="submit">Güncelle</button></div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.modal-cancel-btn').addEventListener('click', ()=> modal.remove());
    modal.querySelector('#editUserForm').addEventListener('submit', async (e)=>{
      e.preventDefault();
      const fd = new FormData(e.target);
      const selectedProjectIds = Array.from(e.target.querySelectorAll('input[name="project_ids"]:checked')).map(ch=>parseInt(ch.value));
      const update = { phone: fd.get('phone'), name: fd.get('name'), role: fd.get('role'), is_active: fd.get('is_active')==='true' };
      if (fd.get('password') && fd.get('password').trim()) update.password = fd.get('password');
      try {
        const r = await fetch(`/admin/users/${userId}`, { method:'PUT', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify(update) });
        if (!r.ok) { const err=await r.json().catch(()=>({})); showMessage(err.error||'Hata','error'); return; }
        const r2 = await fetch(`/admin/users/${userId}/projects`, { method:'PUT', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ project_ids: selectedProjectIds }) });
        if (r2.ok) { showMessage('Güncellendi','success'); modal.remove(); loadUsers(); } else { showMessage('Proje ataması güncellenemedi','warning'); modal.remove(); loadUsers(); }
      } catch (err) { showMessage('Hata','error'); }
    });

  } catch (err) { console.error(err); }
}

async function deleteUser(userId) {
  if (!confirm('Bu kullanıcıyı silmek istediğinizden emin misiniz?')) return;
  try {
    const resp = await fetch(`/admin/users/${userId}`, { method: 'DELETE', credentials: 'include' });
    if (resp.ok) { showMessage('Kullanıcı silindi','success'); loadUsers(); } else { showMessage('Kullanıcı silinirken hata','error'); }
  } catch (e) { showMessage('Kullanıcı silinirken hata','error'); }
}

// Tab switching
function switchTab(tabName) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  // find the tab button with matching data-tab
  const tabBtn = Array.from(document.querySelectorAll('.nav-tab')).find(b => b.dataset.tab === tabName);
  if (tabBtn) tabBtn.classList.add('active');
  const content = document.getElementById(tabName + '-tab');
  if (content) content.classList.add('active');
  if (tabName === 'stats') loadStats();
  if (tabName === 'users') loadUsers();
}


// Basic utility functions used across the file manager
function getFileIcon(filename) {
  if (!filename || typeof filename !== 'string') return '📄';
  const ext = filename.split('.').pop().toLowerCase();
  if (['jpg','jpeg','png','gif','tif','tiff','webp'].includes(ext)) return '🖼️';
  if (['zip','rar','7z'].includes(ext)) return '📦';
  if (['pdf'].includes(ext)) return '📄';
  if (['doc','docx','xls','xlsx','ppt','pptx'].includes(ext)) return '📑';
  if (['fbx','gltf','glb','bin'].includes(ext)) return '🏗️';
  if (['dwg','dxf'].includes(ext)) return '📐';
  if (['mp4','mov','webm','avi','mkv'].includes(ext)) return '🎬';
  return '📄';
}

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return '-';
  const b = Number(bytes) || 0;
  if (b < 1024) return b + ' B';
  const kb = b / 1024;
  if (kb < 1024) return kb.toFixed(2) + ' KB';
  const mb = kb / 1024;
  if (mb < 1024) return mb.toFixed(2) + ' MB';
  const gb = mb / 1024;
  return gb.toFixed(2) + ' GB';
}

async function loadStats() {
  try {
    // Proje sayısı
    document.getElementById('totalProjects').textContent = projects.length;
    
    // Diğer istatistikler için API çağrıları eklenecek
    document.getElementById('totalFiles').textContent = '-';
    document.getElementById('totalUsers').textContent = '-';
    document.getElementById('totalSize').textContent = '-';
    
  } catch (error) {
    console.error('İstatistikler yüklenirken hata:', error);
  }
}

function showMessage(text, type) {
  const message = document.getElementById('message');
  if (!message) return;
  message.textContent = text;
  message.className = 'message ' + type;
  message.style.display = 'block';
  setTimeout(() => message.style.display = 'none', 5000);
}

function logout() {
  fetch('/logout', { method: 'POST', credentials: 'include' })
    .then(() => window.location.href = '/admin/login')
    .catch(() => alert('Çıkış yaparken hata oluştu'));
}

// Wire the remaining event listeners that reference functions defined in the rest of the extracted file
function setupEventListeners() {
  const projectsBtn = document.getElementById('projectsBtn');
  if (projectsBtn) projectsBtn.addEventListener('click', () => { window.location.href = '/projects'; });
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
  
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const tabName = e.target.dataset.tab;
      switchTab(tabName);
    });
  });

  const uploadBtn = document.getElementById('uploadBtn');
  if (uploadBtn) uploadBtn.addEventListener('click', uploadFiles);

  const addUserBtn = document.getElementById('addUserBtn');
  if (addUserBtn) addUserBtn.addEventListener('click', showAddUserForm);

  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('download-btn')) {
      // rendered buttons use data-file-path
      const filePath = e.target.getAttribute('data-file-path') || e.target.dataset.filePath;
      if (filePath) {
        // compute full URL for downloads — if filePath is already absolute URL it will work with window.open
        const url = filePath.startsWith('http') ? filePath : `${window.location.protocol}//${window.location.host}/upload/${filePath.replace(/^\/*/, '')}`;
        downloadFile(url);
      }
    }
    if (e.target.classList.contains('delete-btn')) {
      const filePath = e.target.getAttribute('data-file-path') || e.target.dataset.filePath;
      const category = e.target.getAttribute('data-category') || e.target.dataset.category;
      const filename = e.target.getAttribute('data-filename') || e.target.dataset.filename;
      if (filePath) {
        // call delete using filePath
        // server expects DELETE at /admin/projects/:projectId/files with body { filePath }
        (async () => {
          if (!selectedProject) return showMessage('Proje seçili değil', 'warning');
          try {
            const resp = await fetch(`/admin/projects/${selectedProject.id}/files`, { method: 'DELETE', credentials: 'include', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ filePath }) });
            if (resp.ok) { showMessage('Dosya silindi','success'); await loadProjectFiles(selectedProject.id); }
            else { const err = await resp.json().catch(()=>({})); showMessage(err.error || 'Dosya silinemedi', 'error'); }
          } catch (e) { showMessage('Silme hatası', 'error'); }
        })();
      } else if (selectedProject && category && filename) {
        // fallback to category+filename
        deleteFile(selectedProject.id, category, filename);
      }
    }
    if (e.target.classList.contains('rename-btn')) {
      const filePath = e.target.getAttribute('data-file-path') || e.target.dataset.filePath;
      const category = e.target.getAttribute('data-category') || e.target.dataset.category;
      const filename = e.target.getAttribute('data-filename') || e.target.dataset.filename;
      // show a prompt and call rename
      const newName = prompt('Yeni dosya adını girin', filename || '');
      if (!newName) return;
      if (!selectedProject) return showMessage('Proje seçili değil', 'warning');
      if (filePath) {
        renameFile(selectedProject.id, { filePath, newName });
      } else if (category && filename) {
        renameFile(selectedProject.id, { category, oldName: filename, newName });
      }
    }
    if (e.target.classList.contains('project-item') || e.target.closest('.project-item')) {
      const projectItem = e.target.classList.contains('project-item') ? e.target : e.target.closest('.project-item');
      const projectId = projectItem.dataset.projectId;
      if (projectId) selectProject(parseInt(projectId));
    }
    if (e.target.classList.contains('edit-user-btn')) {
      const userId = e.target.dataset.userId;
      editUser(userId);
    }
    if (e.target.classList.contains('delete-user-btn')) {
      const userId = e.target.dataset.userId;
      deleteUser(userId);
    }
  });
}

// Ensure setupEventListeners is also run after DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
  setupEventListeners();
});
