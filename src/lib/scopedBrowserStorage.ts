import { getAccountOwner } from './accountStore';

// Preserve legacy keys in place; email accounts use their own cache namespace.
export const scopedBrowserKey = (key: string) => {
  const owner = getAccountOwner();
  return owner ? `${key}:account:${owner}` : key;
};
