const fs=require('fs');
const path=require('path');
const files=['student-dashboard.html','department-dashboard.html','warden-dashboard.html','admin-dashboard.html'];
files.forEach(file=>{
  const filepath=path.join(__dirname,'frontend',file);
  if(!fs.existsSync(filepath)) return;
  let content=fs.readFileSync(filepath,'utf8');
  content = content.replace('<section id="section-profile" class="dashboard-section hidden">', '<section id="view-profile" class="view-section" style="display:none;">');
  fs.writeFileSync(filepath, content);
  console.log('Fixed', file);
});
