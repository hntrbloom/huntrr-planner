import re

with open('src/lib/reset.ts', 'r') as f:
    content = f.read()

new_cases = """    case 'sets':
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
"""

content = content.replace("case 'keychains':", new_cases + "\n    case 'keychains':")

with open('src/lib/reset.ts', 'w') as f:
    f.write(content)
