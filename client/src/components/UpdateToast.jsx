import { useRegisterSW } from 'virtual:pwa-register/react';

// Shown when a new build has been deployed and its service worker is waiting.
export default function UpdateToast() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div className="toast" role="status">
      Update available <button type="button" onClick={() => updateServiceWorker(true)}>Reload</button>
    </div>
  );
}
