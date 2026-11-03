// A local workspace is browser storage, never a Firebase identity or a cloud sync.
export const LOCAL_USER_ID = 'huntrr-local-workspace';
export const LOCAL_SESSION_KEY = 'huntrr.organizer.local-workspace.v1';
export const isLocalUser = (user: { uid: string } | null | undefined) => user?.uid === LOCAL_USER_ID;
export const isLocalPath = (path: string) => path === `users/${LOCAL_USER_ID}` || path.startsWith(`users/${LOCAL_USER_ID}/`);
