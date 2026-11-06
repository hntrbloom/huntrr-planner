// Profile IDs double as workspace namespace IDs, never Firebase identities.
export const LOCAL_USER_ID = 'huntrr-local-workspace';
const PROFILE_ID = /^huntrr-profile-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const isProfileId = (id: string) => PROFILE_ID.test(id);
export const isLocalId = (id: string) => id === LOCAL_USER_ID || isProfileId(id);
export const isLocalUser = (user: { uid: string } | null | undefined) => Boolean(user && isLocalId(user.uid));
export const isLocalPath = (path: string) => {
  const [root, id] = path.split('/', 3);
  return root === 'users' && isLocalId(id);
};

export const documentRange = (id: string) => IDBKeyRange.bound(`users/${id}`, `users/${id}0`, false, true);
export const attachmentRange = (id: string) => IDBKeyRange.bound(`${id}/`, `${id}0`, false, true);
