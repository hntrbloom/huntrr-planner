import { db } from './firebase';
import { collection, getDocs, writeBatch, doc, deleteDoc } from 'firebase/firestore';
import { clearKeychainsIDB, clearInspirationPhotosIDB } from './idb';

export type TabId = 'prints' | 'goals' | 'habits' | 'jobs' | 'boards' | 'receipts' | 'shopping' | 'dailylogs' | 'notes' | 'reminders' | 'keychains' | 'wiki' | 'blog' | 'sets' | 'charms' | 'objects' | 'nail_charms' | 'mini_furniture';

export async function deleteTabData(userId: string, tabId: TabId) {
  let collectionsToClear: string[] = [];
  let docsToClear: string[] = [];

  switch (tabId) {
    case 'prints':
      collectionsToClear = ['prints', 'miniFurniture', 'printing'];
      docsToClear = ['preferences/miniFurnitureCategories', 'preferences/miniFurnitureSets'];
      break;
    case 'goals':
      collectionsToClear = ['goals'];
      docsToClear = ['preferences/goalsData'];
      break;
    case 'habits':
      docsToClear = ['preferences/habitsData', 'preferences/focusData'];
      break;
    case 'jobs':
      collectionsToClear = ['jobs', 'job_applications'];
      docsToClear = ['preferences/jobApplicationsData'];
      break;
    case 'boards':
      collectionsToClear = ['boards', 'photos'];
      try { await clearInspirationPhotosIDB(); } catch (e) { console.error(e); }
      break;
    case 'receipts':
      docsToClear = ['preferences/clientReceiptsData'];
      break;
    case 'shopping':
      docsToClear = ['preferences/shoppingListsData'];
      break;
    case 'dailylogs':
      collectionsToClear = ['dailyLogs', 'activity', 'moods'];
      docsToClear = ['preferences/dailyLog'];
      break;
    case 'notes':
      collectionsToClear = ['notes'];
      docsToClear = ['preferences/notesData'];
      break;
    case 'reminders':
      collectionsToClear = ['reminders'];
      docsToClear = ['preferences/remindersData'];
      break;
        case 'sets':
    case 'charms':
    case 'objects':
    case 'nail_charms':
    case 'mini_furniture':
      try {
        const printsSnap = await getDocs(collection(db, `users/${userId}/prints`));
        const mfSnap = await getDocs(collection(db, `users/${userId}/miniFurniture`));
        
        let batch = writeBatch(db);
        let count = 0;

        const checkAndAdd = (docSnap: any, colName: string) => {
          const data = docSnap.data();
          const category = (data.category || '').toLowerCase().trim();
          const type = (data.type || '').toLowerCase().trim();
          const madeFor = (data.madeFor || '').toLowerCase().trim();

          const isNail = (
             ['nail charm', 'nail charms', 'nailcharm', 'nailcharms', 'mini charm', 'mini charms', 'minicharm', 'minicharms'].includes(category) ||
             ['nail charm', 'nail charms', 'nailcharm', 'nailcharms', 'mini charm', 'mini charms', 'minicharm', 'minicharms'].includes(type) ||
             ['nail charm', 'nail charms', 'nailcharm', 'nailcharms', 'mini charm', 'mini charms', 'minicharm', 'minicharms'].includes(madeFor)
          );

          let isMatch = false;
          if (tabId === 'charms') {
            isMatch = !isNail && (category === 'charm' || category === 'charms' || type === 'charm' || type === 'charms' || madeFor === 'charm' || madeFor === 'charms');
          } else if (tabId === 'nail_charms') {
            isMatch = isNail;
          } else if (tabId === 'objects') {
            isMatch = (category === 'object' || category === 'objects' || type === 'object' || type === 'objects' || madeFor === 'object' || madeFor === 'objects');
          } else if (tabId === 'sets') {
            isMatch = (category === 'set' || category === 'sets' || type === 'set' || type === 'sets' || madeFor === 'set' || madeFor === 'sets');
          } else if (tabId === 'mini_furniture') {
            isMatch = (category === 'mini furniture' || category === 'minifurniture' || type === 'mini furniture' || type === 'minifurniture' || madeFor === 'mini furniture' || madeFor === 'minifurniture' || category === 'furniture' || type === 'furniture' || madeFor === 'furniture');
          }

          if (isMatch) {
            batch.delete(doc(db, `users/${userId}/${colName}`, docSnap.id));
            count++;
            return true;
          }
          return false;
        };

        for (const docSnap of printsSnap.docs) {
          if (checkAndAdd(docSnap, 'prints') && count >= 400) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        }
        for (const docSnap of mfSnap.docs) {
          if (checkAndAdd(docSnap, 'miniFurniture') && count >= 400) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        }
        if (count > 0) {
          await batch.commit();
        }

        if (tabId === 'sets') {
          docsToClear = ['preferences/miniFurnitureSets'];
        }
      } catch (e) {
        console.error(`Failed to clear ${tabId} from Prints collections`, e);
        throw e;
      }
      break;

    case 'keychains':
      try {
        const printsSnap = await getDocs(collection(db, `users/${userId}/prints`));
        const mfSnap = await getDocs(collection(db, `users/${userId}/miniFurniture`));
        
        let batch = writeBatch(db);
        let count = 0;

        const checkAndAdd = (docSnap: any, colName: string) => {
          const data = docSnap.data();
          const category = (data.category || '').toLowerCase().trim();
          const type = (data.type || '').toLowerCase().trim();
          const madeFor = (data.madeFor || '').toLowerCase().trim();

          if (
            category === 'keychain' || category === 'keychains' ||
            type === 'keychain' || type === 'keychains' ||
            madeFor === 'keychain' || madeFor === 'keychains'
          ) {
            batch.delete(doc(db, `users/${userId}/${colName}`, docSnap.id));
            count++;
            return true;
          }
          return false;
        };

        for (const docSnap of printsSnap.docs) {
          if (checkAndAdd(docSnap, 'prints') && count >= 400) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        }
        for (const docSnap of mfSnap.docs) {
          if (checkAndAdd(docSnap, 'miniFurniture') && count >= 400) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        }

        if (count > 0) {
          await batch.commit();
        }
        
        collectionsToClear = ['keychains'];
        try { await clearKeychainsIDB(); } catch (e) { console.error(e); }
      } catch (e) {
        console.error('Failed to clear keychains from Prints collections', e);
        throw e;
      }
      break;
    case 'wiki':
      docsToClear = ['preferences/characterWiki'];
      break;
    case 'blog':
      collectionsToClear = ['blog'];
      break;
  }

  // Clear single documents
  for (const docPath of docsToClear) {
    try {
      await deleteDoc(doc(db, `users/${userId}/${docPath}`));
    } catch (e) {
      console.error(`Failed to delete document ${docPath}`, e);
    }
  }

  // Clear collections in batches
  for (const colName of collectionsToClear) {
    try {
      const snap = await getDocs(collection(db, `users/${userId}/${colName}`));
      
      let batch = writeBatch(db);
      let count = 0;
      for (const docSnap of snap.docs) {
        batch.delete(doc(db, `users/${userId}/${colName}`, docSnap.id));
        count++;
        if (count >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
      if (count > 0) {
        await batch.commit();
      }
    } catch (e) {
      console.error(`Failed to wipe collection ${colName}`, e);
    }
  }
}

export async function deleteAllData(userId: string) {
  try {
    await clearKeychainsIDB();
    await clearInspirationPhotosIDB();
  } catch (e) {
    console.error(e);
  }

  const collections = [
    'preferences',
    'dailyLogs',
    'boards',
    'photos',
    'notes',
    'goals',
    'keychains',
    'minifurniture',
    'reminders',
    'blog',
    'jobs'
  ];

  for (const colName of collections) {
    try {
      const snap = await getDocs(collection(db, `users/${userId}/${colName}`));
      
      // Batch delete in chunks of 500
      let batch = writeBatch(db);
      let count = 0;
      for (const docSnap of snap.docs) {
        batch.delete(doc(db, `users/${userId}/${colName}`, docSnap.id));
        count++;
        if (count >= 500) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
      if (count > 0) {
        await batch.commit();
      }
    } catch (e) {
      console.error(`Failed to wipe collection ${colName}`, e);
    }
  }
}
