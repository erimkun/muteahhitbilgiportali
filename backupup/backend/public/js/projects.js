// Externalized from projects.html
// Uses event delegation and avoids inline handlers so CSP nonces are sufficient for inline blocks.

let projects = [];

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

async function logout() {
  try {
    await fetch('/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/admin/login';
  } catch (error) {
    alert('Çıkış yaparken hata oluştu');
  }
}

async function loadProjects() {
  try {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('projectsTable').style.display = 'none';

    const response = await fetch('/api/projects', {
      credentials: 'include'
    });

    if (response.ok) {
      const data = await response.json();
      projects = data.data || [];
      renderProjectsTable();
    } else {
      showMessage('Projeler yüklenirken hata oluştu', 'error');
    }
  } catch (error) {
    showMessage('Bağlantı hatası: ' + error.message, 'error');
  } finally {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('projectsTable').style.display = 'table';
  }
}

function renderProjectsTable() {
  const tbody = document.getElementById('projectsTableBody');
  tbody.innerHTML = '';

  projects.forEach(project => {
    const row = document.createElement('tr');
    const formattedDate = new Date(project.created_at).toLocaleDateString('tr-TR');

    // Format numeric values or show dash if null/undefined
    const formatValue = (value) => {
      if (value === null || value === undefined || value === '') return '-';
      return value;
    };

    // Use data attributes for identifying actions instead of inline onclick
    row.innerHTML =
      '<td>' + project.id + '</td>' +
      '<td><strong>' + project.project_code + '</strong></td>' +
      '<td>' + project.name + '</td>' +
      '<td>' + (project.description || '-') + '</td>' +
      '<td>' + formatValue(project.toplam_insaat_alan) + '</td>' +
      '<td>' + formatValue(project.parsel_alan) + '</td>' +
      '<td>' + formatValue(project.bina_sayisi) + '</td>' +
      '<td>' + formatValue(project.bagimsiz_birim_sayi) + '</td>' +
      '<td>' +
        '<span class="status-badge ' + (project.is_active ? 'status-active' : 'status-inactive') + '">' +
          (project.is_active ? 'Aktif' : 'Pasif') +
        '</span>' +
      '</td>' +
      '<td>' + formattedDate + '</td>' +
      '<td>' +
        '<div class="action-buttons">' +
          '<button class="btn-small btn-edit" data-action="edit" data-id="' + project.id + '">Düzenle</button>' +
          '<button class="btn-small btn-toggle" data-action="toggle" data-id="' + project.id + '">' + (project.is_active ? 'Pasifleştir' : 'Aktifleştir') + '</button>' +
          '<button class="btn-small btn-delete" data-action="delete" data-id="' + project.id + '">Sil</button>' +
        '</div>' +
      '</td>';
    tbody.appendChild(row);
  });
}

async function createProject(e) {
  e.preventDefault();

  const formData = new FormData(e.target);
  const projectData = {
    project_code: formData.get('project_code'),
    name: formData.get('name'),
    description: formData.get('description'),
    toplam_insaat_alan: formData.get('toplam_insaat_alan') || null,
    parsel_alan: formData.get('parsel_alan') || null,
    bina_sayisi: formData.get('bina_sayisi') || null,
    bagimsiz_birim_sayi: formData.get('bagimsiz_birim_sayi') || null
  };

  const createBtn = document.getElementById('createBtn');
  createBtn.disabled = true;
  createBtn.textContent = 'Oluşturuluyor...';

  try {
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(projectData),
      credentials: 'include'
    });

    const result = await response.json();

    if (response.ok) {
      showMessage('Proje başarıyla oluşturuldu!', 'success');
      document.getElementById('createProjectForm').reset();
      loadProjects();
    } else {
      showMessage(result.error || 'Proje oluşturulurken hata oluştu', 'error');
    }
  } catch (error) {
    showMessage('Bağlantı hatası: ' + error.message, 'error');
  } finally {
    createBtn.disabled = false;
    createBtn.textContent = 'Proje Oluştur';
  }
}

async function toggleProjectStatus(projectId) {
  if (!confirm('Proje durumunu değiştirmek istediğinizden emin misiniz?')) {
    return;
  }

  try {
    const response = await fetch('/api/projects/' + projectId + '/toggle-status', {
      method: 'POST',
      credentials: 'include'
    });

    const result = await response.json();

    if (response.ok) {
      showMessage('Proje durumu başarıyla güncellendi', 'success');
      loadProjects();
    } else {
      showMessage(result.error || 'Durum güncellenirken hata oluştu', 'error');
    }
  } catch (error) {
    showMessage('Bağlantı hatası: ' + error.message, 'error');
  }
}

async function deleteProject(projectId) {
  if (!confirm('Bu projeyi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz ve tüm proje dosyaları silinecektir!')) {
    return;
  }

  try {
    const response = await fetch('/api/projects/' + projectId, {
      method: 'DELETE',
      credentials: 'include'
    });

    const result = await response.json();

    if (response.ok) {
      showMessage('Proje başarıyla silindi', 'success');
      loadProjects();
    } else {
      showMessage(result.error || 'Proje silinirken hata oluştu', 'error');
    }
  } catch (error) {
    showMessage('Bağlantı hatası: ' + error.message, 'error');
  }
}

function editProject(projectId) {
  const project = projects.find(p => p.id === projectId);
  if (project) {
    const newName = prompt('Yeni proje adı:', project.name);
    if (newName === null) return; // User cancelled
    
    const newDesc = prompt('Yeni açıklama:', project.description || '');
    if (newDesc === null) return; // User cancelled
    
    const newToplamInsaatAlan = prompt('Toplam İnşaat Alanı (m²):', project.toplam_insaat_alan || '');
    if (newToplamInsaatAlan === null) return; // User cancelled
    
    const newParselAlan = prompt('Parsel Alanı (m²):', project.parsel_alan || '');
    if (newParselAlan === null) return; // User cancelled
    
    const newBinaSayisi = prompt('Bina Sayısı:', project.bina_sayisi || '');
    if (newBinaSayisi === null) return; // User cancelled
    
    const newBagimsizBirimSayi = prompt('Bağımsız Birim Sayısı:', project.bagimsiz_birim_sayi || '');
    if (newBagimsizBirimSayi === null) return; // User cancelled

    updateProject(projectId, {
      name: newName,
      description: newDesc,
      toplam_insaat_alan: newToplamInsaatAlan || null,
      parsel_alan: newParselAlan || null,
      bina_sayisi: newBinaSayisi || null,
      bagimsiz_birim_sayi: newBagimsizBirimSayi || null
    });
  }
}

async function updateProject(projectId, updateData) {
  try {
    const response = await fetch('/api/projects/' + projectId, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData),
      credentials: 'include'
    });

    const result = await response.json();

    if (response.ok) {
      showMessage('Proje başarıyla güncellendi', 'success');
      loadProjects();
    } else {
      showMessage(result.error || 'Proje güncellenirken hata oluştu', 'error');
    }
  } catch (error) {
    showMessage('Bağlantı hatası: ' + error.message, 'error');
  }
}

async function deleteProject(projectId) {
  const project = projects.find(p => p.id === projectId);
  if (!project) {
    showMessage('Proje bulunamadı', 'error');
    return;
  }

  const confirmation = confirm(
    `UYARI: Bu işlem geri alınamaz!\n\n` +
    `"${project.name}" (${project.project_code}) projesini ve tüm ilişkili dosyalarını silmek istediğinizden emin misiniz?\n\n` +
    `Silinecekler:\n` +
    `- Proje veritabanı kaydı\n` +
    `- Tüm proje dosyaları (3D modeller, fotoğraflar, dökümanlar)\n` +
    `- Kullanıcı atamaları\n` +
    `- Galeri resimleri\n` +
    `- Proje ayarları\n\n` +
    `Devam etmek için "Tamam"ı tıklayın.`
  );

  if (!confirmation) {
    return;
  }

  // Double confirmation for extra safety
  const doubleCheck = prompt(
    `Son onay: Projeyi tamamen silmek için "${project.project_code}" yazın:`
  );

  if (doubleCheck !== project.project_code) {
    showMessage('Proje kodu eşleşmedi. Silme işlemi iptal edildi.', 'error');
    return;
  }

  try {
    const response = await fetch('/admin/projects/' + projectId, {
      method: 'DELETE',
      credentials: 'include'
    });

    const result = await response.json();

    if (response.ok) {
      showMessage('Proje ve tüm ilişkili dosyalar başarıyla silindi', 'success');
      loadProjects();
    } else {
      showMessage(result.error || 'Proje silinirken hata oluştu', 'error');
    }
  } catch (error) {
    showMessage('Bağlantı hatası: ' + error.message, 'error');
  }
}

function showMessage(text, type) {
  const message = document.getElementById('message');
  message.textContent = text;
  message.className = 'message ' + type;
  message.style.display = 'block';
  setTimeout(() => {
    message.style.display = 'none';
  }, 5000);
}

// Event delegation for action buttons
document.addEventListener('click', (ev) => {
  const btn = ev.target.closest('button[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id && Number(btn.dataset.id);
  if (action === 'edit') editProject(id);
  if (action === 'toggle') toggleProjectStatus(id);
  if (action === 'delete') deleteProject(id);
});

// Bind form submit and logout
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('createProjectForm');
  if (form) form.addEventListener('submit', createProject);

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);

  // Initial load
  loadAdminInfo();
  loadProjects();
});
