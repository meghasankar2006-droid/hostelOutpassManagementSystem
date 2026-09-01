const fs=require('fs');
const path=require('path');
const files=['student-dashboard.html','department-dashboard.html','warden-dashboard.html','admin-dashboard.html'];
files.forEach(file=>{
  const filepath=path.join(__dirname,'frontend',file);
  if(!fs.existsSync(filepath))return;
  let content=fs.readFileSync(filepath,'utf8');
  const profileSecStart = '<section id="section-profile"';
  const profileSecEnd = '</section>';
  if(content.includes(profileSecStart)) {
    const startIdx = content.indexOf(profileSecStart);
    const endIdx = content.indexOf(profileSecEnd, startIdx) + profileSecEnd.length;
    const sectionStr = content.substring(startIdx, endIdx);
    content = content.substring(0, startIdx) + content.substring(endIdx);
    
    // Instead of after main, let's put it right before </main>
    if(content.includes('</main>')) {
        content = content.replace('</main>', sectionStr + '\n</main>');
    }
    
    fs.writeFileSync(filepath, content);
    console.log('Fixed', file);
  }
});
