import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const app = initializeApp({ projectId: 'ai-studio-huntrrworkspace-d7ae5fa2-be9a-46f0-ac07-95dab5c07625' });
const db = getFirestore(app);

async function check() {
  const users = await getDocs(collection(db, 'users'));
  for (const u of users.docs) {
     const mf = await getDocs(collection(db, `users/${u.id}/miniFurniture`));
     for (const doc of mf.docs) {
         const data = doc.data();
         if (data.madeFor?.toLowerCase().includes('set') || data.category?.toLowerCase().includes('set')) {
            console.log("Found:", data.name, data.madeFor, data.category);
         }
     }
  }
}
check().then(()=>process.exit(0)).catch(console.error);
