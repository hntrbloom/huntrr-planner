import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const app = initializeApp({ projectId: 'ai-studio-huntrrworkspace-d7ae5fa2-be9a-46f0-ac07-95dab5c07625' });
const db = getFirestore(app);

async function check() {
  const users = await getDocs(collection(db, 'users'));
  for (const u of users.docs) {
     const mf = await getDocs(collection(db, `users/${u.id}/miniFurniture`));
     let found = 0;
     for (const doc of mf.docs) {
         const data = doc.data();
         if (data.category?.toLowerCase() === 'keychain' || data.category?.toLowerCase() === 'keychains') {
            console.log("Found in miniFurniture category:", data.name);
            found++;
         }
         if (data.type?.toLowerCase() === 'keychain' || data.type?.toLowerCase() === 'keychains') {
            console.log("Found in miniFurniture type:", data.name);
            found++;
         }
         if (data.madeFor?.toLowerCase() === 'keychain' || data.madeFor?.toLowerCase() === 'keychains') {
            console.log("Found in miniFurniture madeFor:", data.name);
            found++;
         }
     }
     console.log(`User ${u.id} has ${found} keychains in miniFurniture`);

     const prints = await getDocs(collection(db, `users/${u.id}/prints`));
     let foundPrints = 0;
     for (const doc of prints.docs) {
         const data = doc.data();
         if (data.category?.toLowerCase() === 'keychain' || data.category?.toLowerCase() === 'keychains') {
            console.log("Found in prints category:", data.name);
            foundPrints++;
         }
     }
     console.log(`User ${u.id} has ${foundPrints} keychains in prints`);
  }
}
check().then(()=>process.exit(0)).catch(console.error);
