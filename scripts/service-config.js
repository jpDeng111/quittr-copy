const fs = require('node:fs');
const path = require('node:path');
const { root, dataDir } = require('./config');
const xml = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
const target = path.join(dataDir, 'com.quittr.server.plist');
fs.writeFileSync(target, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.quittr.server</string>
  <key>ProgramArguments</key><array><string>${xml(process.execPath)}</string><string>${xml(path.join(root, 'server.js'))}</string></array>
  <key>WorkingDirectory</key><string>${xml(root)}</string>
  <key>EnvironmentVariables</key><dict><key>NODE_ENV</key><string>production</string><key>QUITTR_DATA_DIR</key><string>${xml(dataDir)}</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>${xml(path.join(dataDir, 'server.log'))}</string>
  <key>StandardErrorPath</key><string>${xml(path.join(dataDir, 'service.err.log'))}</string>
</dict></plist>
`, { mode: 0o600 });
console.log(`已生成 ${target}。安装与启停步骤见 DEPLOYMENT.md。`);
