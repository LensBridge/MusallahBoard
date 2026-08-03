import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { resolveDeviceId } from './utils/cookies.js';
import './styles.css';

// Settle identity before the first render so a board provisioned via
// `?deviceId=` never paints its unpaired screen. See resolveDeviceId().
resolveDeviceId();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
