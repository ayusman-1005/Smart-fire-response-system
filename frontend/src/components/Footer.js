import React from 'react';
import '../App.css';

const developers = [
  { name: 'Ayusman Behera', initials: 'AB', color: '#ea580c', link: 'https://www.linkedin.com/in/ayusman-behera-43354b270/' },
  { name: 'Udaynath Hota', initials: 'UH', color: '#dc2626', link: 'https://www.linkedin.com/in/udaynath-hota/' },
  { name: 'Stephen Nayak', initials: 'SN', color: '#9333ea', link: '#' },
  { name: 'Anas Ahmed', initials: 'AA', color: '#2563eb', link: '#' },
  { name: 'Mayank Lohan', initials: 'ML', color: '#059669', link: '#' },
  { name: 'Ansh Rajpal', initials: 'AR', color: '#0891b2', link: '#' }
];

export default function Footer() {
  return (
    <footer className="footer-section">
      <div className="devs-container">
        <h2>OUR DEVELOPERS</h2>
        <div className="dev-grid">
          {developers.map((dev, i) => (
            <a key={i} href={dev.link} target="_blank" rel="noreferrer" className="dev-card">
              <div className="dev-avatar" style={{ backgroundColor: dev.color }}>
                {dev.initials}
              </div>
              <span className="dev-name">{dev.name}</span>
            </a>
          ))}
        </div>
      </div>

      <div className="footer-bottom">
        <div className="footer-col" style={{ maxWidth: '300px' }}>
          <h3>About Fire Monitor</h3>
          <p>Real-time fire quality monitoring system providing accurate thermal readings and automated safety responses across the grid.</p>
        </div>
        <div className="footer-col">
          <h3>Features</h3>
          <p>Real-time Active Risk Monitoring</p>
          <p>Temperature & Flame Tracking</p>
          <p>Automated Siren & Pump Triggers</p>
          <p>Safety Recommendations</p>
        </div>
        <div className="footer-col">
           <h3>Resources</h3>
           <p>Fire Scale Information</p>
           <p>Safety Guidelines</p>
           <p>Node Map Sources</p>
           <p>Support</p>
        </div>
      </div>
    </footer>
  );
}