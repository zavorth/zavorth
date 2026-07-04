const fs = require('fs');
const path = require('path');

const dashboardDir = path.join(__dirname, '..', 'src', 'domain', 'surface', 'presentation', 'dashboard');

function deleteDir(dir) {
  if (fs.existsSync(dir)) {
    fs.readdirSync(dir).forEach(file => {
      const curPath = path.join(dir, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        deleteDir(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(dir);
    console.log(`Deleted: ${dir}`);
  }
}

deleteDir(dashboardDir);
console.log('Dashboard directory removed successfully');
