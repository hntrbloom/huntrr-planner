// Organizer profiles are local and do not confer a cloud API identity.
export async function apiHeaders(): Promise<Record<string, string>> {
  return { 'Content-Type': 'application/json' };
}
