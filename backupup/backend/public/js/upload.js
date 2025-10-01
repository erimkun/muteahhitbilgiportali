// Extracted from inline script in upload.html
let selectedProject = null;
let projects = [];

// Sayfa yüklendiğinde admin bilgilerini ve projeleri getir
async function loadAdminInfo() {
  try {
    const response = await fetch('/session', { credentials: 'include' });
    if (response.status === 401) {
      // Not authenticated - redirect to login
      window.location.href = '/admin/login';
      return null;
    }
    if (response.ok) {
      const data = await response.json();
      if (data.admin) {
        document.getElementById('adminInfo').textContent =
          `Admin: ${data.admin.phone} (${data.admin.role})`;
        return data;
      }
    }
    return null;
  } catch (error) {
    console.error('Admin bilgileri yüklenemedi:', error);
    return null;
  }
}

async function loadProjects() {
  try {
    const response = await fetch('/api/projects', { credentials: 'include' });
    if (response.status === 401) {
      // Not authenticated - redirect to login
      window.location.href = '/admin/login';
      return;
    }
    if (response.ok) {
      const data = await response.json();
      projects = data.data;
      updateProjectSelect();
    } else {
      showMessage('Projeler yüklenemedi', 'error');
    }
  } catch (error) {
    showMessage('Projeler yüklenirken hata oluştu: ' + error.message, 'error');
  }
}

function updateProjectSelect() {
  const select = document.getElementById('projectSelect');
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

function logout() {
  fetch('/logout', { method: 'POST', credentials: 'include' })
    .then(() => window.location.href = '/admin/login')
    .catch(() => alert('Çıkış yaparken hata oluştu'));
}

function showMessage(text, type) {
  const message = document.getElementById('message');
  message.textContent = text;
  message.className = 'message ' + type;
  message.style.display = 'block';
  setTimeout(() => message.style.display = 'none', 5000);
}

// Proje seçimi değiştiğinde
document.addEventListener('change', function (e) {
  if (e.target && e.target.id === 'projectSelect') {
    selectedProject = e.target.value;
  }
});

// Drag & Drop fonksiyonları
function setupDragDrop(dropZone, fileInput) {
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
  });

  dropZone.addEventListener('drop', function (e) {
    const files = e.dataTransfer.files;
    fileInput.files = files;
    updateFileList(files, dropZone.closest('.upload-section'));
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }
}

// Dosya listesini güncelle
function updateFileList(files, section) {
  const fileList = section.querySelector('.file-list');
  fileList.innerHTML = '';

  Array.from(files).forEach(file => {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.innerHTML = `
          <span>📄 ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)</span>
          <span>${file.type}</span>
        `;
    fileList.appendChild(fileItem);
  });
}

// Form gönderme fonksiyonu
async function uploadFiles(form, progressBar, progressFill, button) {
  if (!selectedProject) {
    showMessage('Lütfen önce bir proje seçin', 'error');
    return;
  }

  const formData = new FormData(form);
  formData.append('project', selectedProject);

  button.disabled = true;
  button.textContent = 'Yükleniyor...';
  progressBar.style.display = 'block';

  try {
    const xhr = new XMLHttpRequest();
    // Include cookies/credentials so session cookie is sent with the upload
    xhr.withCredentials = true;

    xhr.upload.addEventListener('progress', function (e) {
      if (e.lengthComputable) {
        const percentComplete = (e.loaded / e.total) * 100;
        progressFill.style.width = percentComplete + '%';
      }
    });

    xhr.onreadystatechange = function () {
      if (xhr.readyState === XMLHttpRequest.DONE) {
        button.disabled = false;
        button.textContent = button.id.includes('general') ? 'Dosyaları Yükle' : 'İmajları Yükle';
        progressBar.style.display = 'none';
        progressFill.style.width = '0%';

        if (xhr.status === 200) {
          const result = JSON.parse(xhr.responseText);
          showMessage('Dosyalar başarıyla yüklendi!', 'success');
          form.reset();
          form.querySelector('.file-list').innerHTML = '';
        } else {
          const error = JSON.parse(xhr.responseText);
          showMessage('Yükleme hatası: ' + (error.error || 'Bilinmeyen hata'), 'error');
        }
      }
    };

    xhr.open('POST', '/upload');
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    xhr.send(formData);

  } catch (error) {
    button.disabled = false;
    button.textContent = button.id.includes('general') ? 'Dosyaları Yükle' : 'İmajları Yükle';
    progressBar.style.display = 'none';
    showMessage('Yükleme hatası: ' + error.message, 'error');
  }
}

// Event listener'lar
// Initialize UI event handlers (only call this after auth check passes)
function initPage() {
  // Drag & Drop kurulumu
  const generalDropZone = document.querySelector('#generalUploadForm .file-drop-zone');
  const imageDropZone = document.querySelector('#imageUploadForm .file-drop-zone');

  setupDragDrop(generalDropZone, document.getElementById('generalFiles'));
  setupDragDrop(imageDropZone, document.getElementById('imageFiles'));

  // Dosya seçimi değiştiğinde listeleri güncelle
  document.getElementById('generalFiles').addEventListener('change', function () {
    updateFileList(this.files, this.closest('.upload-section'));
  });

  document.getElementById('imageFiles').addEventListener('change', function () {
    updateFileList(this.files, this.closest('.upload-section'));
  });

  // Form gönderme
  document.getElementById('generalUploadForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const progressBar = document.getElementById('generalProgress');
    const progressFill = document.getElementById('generalProgressFill');
    const button = document.getElementById('generalUploadBtn');
    uploadFiles(this, progressBar, progressFill, button);
  });

  document.getElementById('imageUploadForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const progressBar = document.getElementById('imageProgress');
    const progressFill = document.getElementById('imageProgressFill');
    const button = document.getElementById('imageUploadBtn');
    uploadFiles(this, progressBar, progressFill, button);
  });
}

// On load: check authentication first. If OK, initialize UI and load projects.
document.addEventListener('DOMContentLoaded', async function () {
  const session = await loadAdminInfo();
  if (!session) {
    // loadAdminInfo already redirected on 401; if it returned null for other reasons, avoid initializing UI
    return;
  }

  // Initialize page now that auth is confirmed
  initPage();
  // Load projects (loadProjects will redirect if unauthorized)
  loadProjects();
});
