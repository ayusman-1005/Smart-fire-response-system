const fs = require('fs');

const css = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

:root {
  --bg-color: #121212;
  --bg-card: #1c1c1e;
  --bg-panel: #252528;
  --text-main: #e0e0e0;
  --text-muted: #aaa;
  --border-color: #333;
}

[data-theme='light'] {
  --bg-color: #f4f6f8;
  --bg-card: #ffffff;
  --bg-panel: #f0f0f0;
  --text-main: #111111;
  --text-muted: #666666;
  --border-color: #ddd;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

body {
  background-color: var(--bg-color);
  color: var(--text-main);
  transition: background-color 0.3s;
}

.app { display: flex; flex-direction: column; min-height: 100vh; }
.app-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 40px; background: var(--bg-card); border-bottom: 1px solid var(--border-color); }
.header-left { display: flex; align-items: center; gap: 15px; }
.header-icon { font-size: 28px; color: #ff3b30; }
.header-left h1 { font-size: 24px; font-weight: 700; color: var(--text-main); margin: 0; }
.header-nav { display: flex; gap: 10px; }
.nav-btn { background: transparent; border: none; color: var(--text-muted); font-weight: 600; font-size: 13px; text-transform: uppercase; padding: 8px 16px; border-radius: 8px; cursor: pointer; transition: 0.2s; }
.nav-btn:hover { color: var(--text-main); }
.nav-btn.active { background: #ff3b30; color: #fff; }
.live-badge { padding: 6px 12px; background: rgba(50, 215, 75, 0.2); color: #32d74b; border-radius: 20px; font-weight: 700; font-size: 12px; }
.theme-btn { background: transparent; border: 1px solid var(--border-color); color: var(--text-main); padding: 6px 12px; border-radius: 20px; cursor: pointer; font-size: 16px; }

.app-main { padding: 30px; }

/* Grid Layout for Cards */
.node-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; margin-bottom: 30px; }

/* Control Panel */
.control-panel { background: var(--bg-card); padding: 25px; border-radius: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-top: 30px; border: 1px solid var(--border-color); }
.section-title { font-size: 18px; font-weight: 600; color: var(--text-main); margin-bottom: 20px; display: block; }
.control-status { display: flex; gap: 15px; margin-bottom: 20px; }
.status-pill { background: var(--bg-panel); padding: 8px 16px; border-radius: 8px; font-weight: 600; color: var(--text-main); }
.control-duration-row { margin-bottom: 20px; color: var(--text-main); font-size: 14px; }
.duration-select { padding: 8px; background: var(--bg-panel); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 6px; margin-left: 15px; }

.control-grid { display: flex; gap: 15px; flex-wrap: wrap; }
.action-btn { padding: 12px 24px; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; transition: 0.2s; background: var(--bg-panel); color: var(--text-main); }
.action-btn:hover { filter: brightness(1.2); }
.action-btn.active-pressed { box-shadow: inset 0 3px 5px rgba(0,0,0,0.5); transform: scale(0.98); }

.action-btn.danger { background: rgba(255,59,48,0.2); color: #ff3b30; border: 1px solid #ff3b30; }
.action-btn.danger.active-pressed { background: #ff3b30; color: #fff; }

.action-btn.warn { background: rgba(255,140,0,0.2); color: #ff8c00; border: 1px solid #ff8c00; }
.action-btn.warn.active-pressed { background: #ff8c00; color: #fff; }

.action-btn.auto { background: rgba(50,215,75,0.2); color: #32d74b; border: 1px solid #32d74b; }
.action-btn.auto.active-pressed { background: #32d74b; color: #fff; }

.alerts-table { width: 100%; border-collapse: collapse; margin-top: 20px; color: var(--text-main); }
.alerts-table th, .alerts-table td { padding: 15px; text-align: left; border-bottom: 1px solid var(--border-color); }
.aqi-badge { padding: 4px 8px; border-radius: 4px; font-weight: bold; }

/* Developers & Footer */
.dev-section { padding: 60px 40px; text-align: center; background: var(--bg-card); margin-top: 40px; border-top: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color); }
.dev-title { font-size: 24px; letter-spacing: 2px; font-weight: 800; margin-bottom: 40px; color: var(--text-main); text-transform: uppercase; }
.dev-grid { display: flex; justify-content: center; gap: 40px; flex-wrap: wrap; }
.dev-card { cursor: pointer; transition: transform 0.3s; text-decoration: none; color: var(--text-main); }
.dev-card:hover { transform: translateY(-5px); }
.dev-avatar { width: 100px; height: 100px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 32px; font-weight: 800; color: #fff; margin: 0 auto 15px auto; box-shadow: 0 4px 10px rgba(0,0,0,0.3); border: 4px solid var(--border-color); }
.dev-name { font-size: 14px; font-weight: 700; max-width: 120px; text-transform: uppercase; }

.footer { background: var(--bg-color); padding: 40px; display: flex; justify-content: space-around; flex-wrap: wrap; font-size: 13px; color: var(--text-muted); border-top: 1px solid var(--border-color); margin-top: auto; }
.footer h4 { color: var(--text-main); font-size: 14px; font-weight: 700; margin-bottom: 15px; }
.footer ul { list-style: none; }
.footer ul li { margin-bottom: 8px; cursor: pointer; transition: color 0.2s; }
.footer ul li:hover { color: var(--text-main); }

`;

fs.writeFileSync('c:/Users/ayusm/projects/IOT project/Project IoT/Project IoT/frontend/src/App.css', css, 'utf8');
console.log('Done fixing css');
