import React from 'react';
import { createRoot } from 'react-dom/client';
import { MainWindow } from './MainWindow';
import { ComponentGallery } from '../../components/gallery';
import { startWindowLagMonitor } from '../../lag-monitor';
import '../../styles/tokens.css';
import '../../styles/components.css';

startWindowLagMonitor();

const params = new URLSearchParams(window.location.search);
const isGallery = params.get('gallery') === 'true';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      {isGallery ? <ComponentGallery /> : <MainWindow />}
    </React.StrictMode>
  );
}

