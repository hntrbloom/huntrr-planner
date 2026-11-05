import { useSyncExternalStore } from 'react';
import { getAccountOwner, getAccountSyncState, subscribeAccountSync } from '../lib/accountStore';

export function AccountSyncIndicator() {
  const state = useSyncExternalStore(subscribeAccountSync, getAccountSyncState);
  return getAccountOwner() ? <span className="account-sync-indicator" role="status" title="Cloud sync">{state}</span> : null;
}
