import { useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { getStatus, subscribe, sync } from '../sync';

// Long label for the sidebar, short one for the phone tab bar.
const LABEL = {
  synced: ['Synced', 'Synced'],
  syncing: ['Syncing…', 'Syncing'],
  offline: ['Offline', 'Offline'],
  error: ['Sync failed', 'Failed'],
  'signed-out': ['Log in to sync', 'Log in'],
};

export default function SyncStatus() {
  const status = useSyncExternalStore(subscribe, getStatus);
  const [long, short] = LABEL[status];
  const content = (
    <>
      <span className="sync-dot" />
      <span className="sync-long">{long}</span>
      <span className="sync-short">{short}</span>
    </>
  );
  if (status === 'signed-out') {
    return <Link to="/settings" className={`sync ${status}`}>{content}</Link>;
  }
  return (
    <button type="button" className={`sync ${status}`} onClick={() => sync()} title="Sync now">{content}</button>
  );
}
