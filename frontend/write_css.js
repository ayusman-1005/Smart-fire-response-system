const fs = require('fs');

const cssText = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

body {
  background-color: #0d0f14;
  color: #e0e0e0;
}

.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

/* Header styled like the Vercel app */
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 40px;
  background: #14171f;
  border-bottom: 1px solid #1f2330;
}

.header-left { display: flex; align-items: center; gap: 15px; }
.header-icon { font-size: 28px; color: #ff3b30; }
.header-left h1 { font-size: 24px; font-weight: 700; color: #fff; margin: 0; }

.header-nav { display: flex; gap: 10px; }
.nav-btn {
  background: transparent;
  border: none;
  color: #888c96;
  font-weight: 600;
  font-size: 14px;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: 0.2s;
}
.nav-btn:hover { color: #fff; }
.nav-btn.active {
  background: #ffffff;
  color: #000000;
}

.live-badge {
  padding: 6px 12px;
  background: rgba(50, 215, 75, 0.1);
  color: #32d74b;
  border-radius: 20px;
  font-weight: 700;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.live-badge::before {
  content: '';
  display: inline-block;
  width: 8px;
  height: 8px;
  background: #32d74b;
  border-radius: 50%;
}

.app-main { padding: 30px 40px; max-width: 1400px; margin: 0 auto; width: 100%; }

/* Node Cards styled like the Vercel widgets */
.node-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
  margin-bottom: 40px;
}

.node-card {
  background: #1a1d26;
  padding: 25px;
  border-radius: 16px;
  border: 1px solid #2a2e3b;
  cursor: pointer;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  transition: transform 0.2s ease, border-color 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 15px;
}
.node-card.selected { border: 2px solid #ff3b30; }
.node-card:hover { transform: translateY(-3px); }

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.card-title {
  font-size: 18px;
  font-weight: 700;
  color: #888c96;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.card-aqi {
  font-size: 54px;
  font-weight: 800;
  line-height: 1;
}

.card-category {
  font-size: 14px;
  font-weight: bold;
  padding: 6px 12px;
  border-radius: 12px;
  display: inline-block;
  align-self: flex-start;
}

.card-metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  background: #14171f;
  padding: 15px;
  border-radius: 12px;
  border: 1px solid #1f2330;
}

.metric {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
}
.metric-label {
  color: #888c96;
}
.metric-value {
  color: #fff;
  font-weight: 600;
}

/* Control Panel */
.control-panel {
  background: #1a1d26;
  padding: 25px;
  border-radius: 16px;
  border: 1px solid #2a2e3b;
  margin-top: 30px;
}
.section-title {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 20px;
  display: block;
}

.control-grid {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
}
.action-btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: 0.2s;
  background: #2a2e3b;
  color: #fff;
  position: relative;
  overflow: hidden;
}
.action-btn:hover { background: #3a3e4b; }

/* Active (Pressed) States */
.action-btn.danger.active { background: #ff3b30; color: #fff; border: 1px solid #ff3b30; box-shadow: 0 0 15px rgba(255,59,48,0.5); }
.action-btn.danger { background: rgba(255,59,48,0.1); color: #ff3b30; border: 1px solid #ff3b30; }

.action-btn.warn.active { background: #ff8c00; color: #fff; border: 1px solid #ff8c00; box-shadow: 0 0 15px rgba(255,140,0,0.5); }
.action-btn.warn { background: rgba(255,140,0,0.1); color: #ff8c00; border: 1px solid #ff8c00; }

.action-btn.auto.active { background: #32d74b; color: #111; border: 1px solid #32d74b; }
.action-btn.auto { background: rgba(50,215,75,0.1); color: #32d74b; border: 1px solid #32d74b; }

/* Coordinate Editor */
.coord-editor {
  display: flex;
  gap: 15px;
  align-items: center;
  margin-bottom: 20px;
  background: #14171f;
  padding: 15px;
  border-radius: 12px;
  border: 1px solid #1f2330;
}
.coord-input {
  background: #0d0f14;
  border: 1px solid #2a2e3b;
  color: #fff;
  padding: 8px 12px;
  border-radius: 6px;
  width: 120px;
}
.coord-save-btn {
  background: #3c82f6;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}
.coord-save-btn:hover { background: #2563eb; }

/* Footer / Developers Section */
.footer-section {
  background: #14171f;
  border-top: 1px solid #1f2330;
  padding: 60px 40px;
  margin-top: auto;
}

.devs-container {
  max-width: 1000px;
  margin: 0 auto 50px auto;
  text-align: center;
}

.devs-container h2 {
  color: #fff;
  font-size: 22px;
  letter-spacing: 2px;
  text-transform: uppercase;
  margin-bottom: 40px;
  position: relative;
  display: inline-block;
}
.devs-container h2::after {
  content: "";
  position: absolute;
  bottom: -10px;
  left: 50%;
  transform: translateX(-50%);
  width: 50px;
  height: 3px;
  background: #ff8c00;
}

.dev-grid {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 40px;
}

.dev-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-decoration: none;
  gap: 15px;
}

.dev-avatar {
  width: 90px;
  height: 90px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: 700;
  color: #fff;
  box-shadow: 0 8px 16px rgba(0,0,0,0.3);
  border: 4px solid #1f2330;
  transition: 0.3s;
}

.dev-card:hover .dev-avatar {
  transform: translateY(-5px);
  box-shadow: 0 12px 20px rgba(0,0,0,0.4);
  border-color: #3c82f6;
}

.dev-name {
  color: #fff;
  font-weight: 600;
  font-size: 14px;
  text-transform: uppercase;
  max-width: 120px;
  line-height: 1.4;
}

.footer-bottom {
  display: flex;
  justify-content: space-around;
  border-top: 1px solid #1f2330;
  padding-top: 40px;
  max-width: 1200px;
  margin: 0 auto;
}

.footer-col h3 {
  color: #fff;
  font-size: 16px;
  margin-bottom: 15px;
}
.footer-col p, .footer-col a {
  color: #888c96;
  font-size: 13px;
  text-decoration: none;
  line-height: 2;
  display: block;
}
`;

fs.writeFileSync('src/App.css', cssText.trim(), 'utf8');
console.log('App.css written completely in UTF-8');
