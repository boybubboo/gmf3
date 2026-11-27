import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const msg =
      event.reason instanceof Error
        ? event.reason.message
        : typeof event.reason === 'string'
        ? event.reason
        : '';
    if (msg.includes('WebSocket closed without opened')) {
      event.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(<App />);
