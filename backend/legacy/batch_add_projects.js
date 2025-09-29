#!/usr/bin/env node
/**
 * Toplu Proje Ekleme Scripti
 * CSV dosyasından projeleri otomatik ekler
 */

const fs = require('fs').promises;
const { createProject } = require('./add_project');

const projectsData = [
  { code: "600_100", name: "Rezidans A Blok", desc: "Rezidans projesi A blok" },
  { code: "600_200", name: "Rezidans B Blok", desc: "Rezidans projesi B blok" },
  { code: "700_300", name: "AVM Projesi", desc: "Merkezi AVM geliştirme projesi" }
];

async function batchCreateProjects() {
  console.log(`🚀 Adding ${projectsData.length} projects...`);
  
  for (const project of projectsData) {
    console.log(`\n📦 Processing: ${project.code}`);
    await createProject(project.code, project.name, project.desc);
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 saniye bekle
  }
  
  console.log('\n🎉 All projects created successfully!');
}

if (require.main === module) {
  batchCreateProjects().catch(console.error);
}