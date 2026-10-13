import { useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { getStatus, subscribe, sync } from '../sync';

const LABEL = {
  synced: 'Synced',
  syncing: 'Syncing…',
  offline: 'Offline',
  error: 'Sync failed',
  'signed-out': 'Log in to sync',
};

export default function SyncStatus() {
  const status = useSyncExternalStore(subscribe, getStatus);
  if (status === 'signed-out') {
    return <Link to="/account" className={`sync ${status}`}><span>{LABEL[status]}</span></Link>;
  }
  return (
    <button type="button" className={`sync ${status}`} onClick={() => sync()} title="Sync now">
      <span>{LABEL[status]}</span>
    </button>
  );
}
