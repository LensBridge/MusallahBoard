import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
// Fonts are bundled, not loaded from Google Fonts: an offline board has no
// route to it, and an online one shouldn't blank its type when Google is slow.
// Weights match what styles.css uses; each file carries every subset (Amiri's
// includes Arabic) behind unicode-range, so only the glyphs drawn are fetched.
import '@fontsource/cinzel/400.css';
import '@fontsource/cinzel/500.css';
import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/montserrat/400.css';
import '@fontsource/montserrat/500.css';
import '@fontsource/montserrat/600.css';
import '@fontsource/montserrat/700.css';
import '@fontsource/montserrat/400-italic.css';
import '@fontsource/montserrat/500-italic.css';
import '@fontsource/amiri/400.css';
import '@fontsource/amiri/700.css';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
