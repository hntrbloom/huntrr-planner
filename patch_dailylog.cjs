const fs = require('fs');
const file = './src/components/DailyLogView.tsx';
let code = fs.readFileSync(file, 'utf8');

const modalStateCode = `
  const [historyModalCategory, setHistoryModalCategory] = useState<string | null>(null);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeColorPicker, setActiveColorPicker] = useState<string | null>(null);

  const openHistory = async (categoryId: string) => {
    setHistoryModalCategory(categoryId);
    setLoadingHistory(true);
    setHistoryLogs([]);

    if (user?.isAnonymous) {
       setHistoryLogs([
         { date: '2023-10-01', items: [{ text: 'Sample past task', completed: true, status: 'done' }] }
       ]);
       setLoadingHistory(false);
       return;
    }

    try {
      const q = query(
        collection(db, \`users/\${user.uid}/dailyLogs\`),
        where(documentId(), '<', todayStr),
        orderBy(documentId(), 'desc'),
        limit(30)
      );
      const snaps = await safeGetDocs(q);
      const logs: any[] = [];
      snaps.forEach(snap => {
         const date = snap.id;
         const data = snap.data();
         let catItems: any[] = [];
         if (data.items) {
           catItems = data.items.filter((i: any) => i.category === categoryId);
         } else {
           if (categoryId === 'Tasks') catItems = (data.tasks || []).map((t:any) => ({...t, category: 'Tasks'}));
           if (categoryId === 'Chores') catItems = (data.chores || []).map((t:any) => ({...t, category: 'Chores'}));
         }
         if (catItems.length > 0) {
           logs.push({ date, items: catItems });
         }
      });
      setHistoryLogs(logs);
    } catch (err) {
      console.error(err);
    }
    setLoadingHistory(false);
  };
`;

code = code.replace(
  "const [inputValue, setInputValue] = useState('');",
  "const [inputValue, setInputValue] = useState('');\n" + modalStateCode
);

const handleAddSubmitCode = `
  const handleAddSubmit = (text: string, catId: string) => {
    if (text) {
      saveState([...items, { id: Date.now().toString(), text, completed: false, category: catId, status: 'todo' }]);
    }
  };
`;

code = code.replace(
  /const handleAddSubmit = \(\) => {[\s\S]*?};/,
  handleAddSubmitCode
);


const fullCategoryNotepadCode = `
const FullCategoryNotepad = ({ categoryId, categoryName, color, activeItems, doneItems }: any) => {
  const [localInput, setLocalInput] = useState('');
  return (
    <div className="relative rounded-sm shadow-md border-[2px] border-gray-400 flex flex-col p-4 sm:p-6 transition-colors duration-300" style={{ backgroundColor: color }}>
      <div className="absolute top-4 right-4 z-20 flex gap-2">
        <button 
          onClick={() => openHistory(categoryId)}
          className="p-1.5 hover:bg-black/10 rounded-full text-black/40 hover:text-black transition-colors"
          title="History"
        >
          <Clock className="w-4 h-4" />
        </button>
        <div className="relative">
          <button 
            onClick={() => setActiveColorPicker(activeColorPicker === categoryId ? null : categoryId)}
            className="p-1.5 hover:bg-black/10 rounded-full text-black/40 hover:text-black transition-colors"
          >
            <PaintBucket className="w-4 h-4" />
          </button>
          {activeColorPicker === categoryId && (
            <div className="absolute top-full right-0 mt-2 p-2 bg-white rounded-xl shadow-xl border border-gray-200 flex gap-2 z-30">
              <button
                onClick={() => { handleCategoryColorChange(categoryId, undefined); setActiveColorPicker(null); }}
                className="w-6 h-6 rounded-full border border-gray-300 bg-[#F5F5F5]"
                title="Default"
              />
              {PAD_COLORS.map(c => (
                 <button
                   key={c}
                   onClick={() => { handleCategoryColorChange(categoryId, c); setActiveColorPicker(null); }}
                   className="w-6 h-6 rounded-full border border-gray-300 hover:scale-110 transition-transform"
                   style={{ backgroundColor: c }}
                 />
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="absolute -top-5 right-8 w-4 h-12 border-[3px] border-gray-400/90 rounded-full bg-transparent rotate-[15deg] shadow-[1px_2px_2px_rgba(0,0,0,0.1)] z-10"></div>
      <div className="absolute top-4 left-4 w-2 h-2 rounded-full bg-black/15 shadow-inner"></div>
      <div className="absolute bottom-4 left-4 w-2 h-2 rounded-full bg-black/15 shadow-inner"></div>
      
      <div className="relative z-10 flex flex-col h-full mt-2">
        <div className="flex items-center justify-center gap-2 mb-6 pb-2 border-b-[3px] border-black/10 self-center px-4 w-full">
          <h3 className="text-[20px] md:text-[24px] font-bold text-black/70 uppercase tracking-widest text-center m-0 line-clamp-1">{categoryName}</h3>
        </div>
        
        <div className="flex-1 flex flex-col gap-4 w-full">
          <div className="grid grid-cols-1 gap-3 w-full">
            {activeItems.map(renderTaskItem)}
            {activeItems.length === 0 && (
              <div className="col-span-full flex items-center justify-center py-6">
                <p className="text-[14px] text-black/40 italic font-medium">Nothing added yet.</p>
              </div>
            )}
          </div>

          <div className="mt-2 flex items-center h-[48px] w-full">
            <div 
              className="inline-flex items-center h-full gap-2 px-3 rounded-xl transition-colors w-full"
              style={{ backgroundColor: 'rgba(255, 240, 244, 0.35)', border: '1px solid rgba(255, 184, 205, 0.35)', boxShadow: '0 3px 10px rgba(255, 184, 205, 0.25)' }}
            >
              <button 
                type="button"
                onClick={() => { if(localInput.trim()) { handleAddSubmit(localInput.trim(), categoryId); setLocalInput(''); } }}
                disabled={!localInput.trim()}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-black/5 hover:bg-black/10 disabled:opacity-50 text-black/60 transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
              <input 
                type="text" 
                value={localInput}
                onChange={(e) => setLocalInput(e.target.value)}
                placeholder={\`Add to \${categoryName}...\`}
                onKeyDown={(e) => { if (e.key === 'Enter' && localInput.trim()) { handleAddSubmit(localInput.trim(), categoryId); setLocalInput(''); } }}
                className="bg-transparent border-none outline-none text-[15px] font-medium text-black placeholder:text-black/30 flex-1 w-full min-w-0"
              />
            </div>
          </div>
        </div>

        {doneItems.length > 0 && (
          <div className="mt-6 pt-4 border-t-[2px] border-black/10 flex flex-col gap-3">
            <h4 className="text-[14px] font-bold text-black/50 uppercase tracking-widest text-center">Done</h4>
            <div className="grid grid-cols-1 gap-3 w-full opacity-70 hover:opacity-100 transition-opacity">
              {doneItems.map(renderTaskItem)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
`;

code = code.replace(
  "  const renderTaskItem = (item: TaskItem) => (",
  fullCategoryNotepadCode + "\n  const renderTaskItem = (item: TaskItem) => ("
);

// fix editTask.category || selectedCategoryId
code = code.replace(
  "value={editTask.category || selectedCategoryId}",
  "value={editTask.category || item.category}"
);

const mainViewCode = `
              <div className="lg:hidden flex flex-col">
                <FullCategoryNotepad 
                  categoryId={selectedCategoryId} 
                  categoryName={getCategoryName(selectedCategoryId)} 
                  color={getCategoryColor(selectedCategoryId) || selectedColor.bg} 
                  activeItems={activeItems} 
                  doneItems={doneItems} 
                />
              </div>

              <div className="hidden lg:grid grid-cols-3 gap-8 w-full mt-4">
                {activeOrder.map((catId, index) => {
                  const catColor = getCategoryColor(catId) || palette[index]?.bg || '#F5F5F5';
                  const cItems = items.filter(i => i.category === catId);
                  const cActive = cItems.filter(i => !i.completed).sort((a, b) => (a.important && !b.important ? -1 : (!a.important && b.important ? 1 : 0)));
                  const cDone = cItems.filter(i => i.completed).sort((a, b) => (a.important && !b.important ? -1 : (!a.important && b.important ? 1 : 0)));
                  return (
                    <FullCategoryNotepad 
                      key={catId}
                      categoryId={catId}
                      categoryName={getCategoryName(catId)}
                      color={catColor}
                      activeItems={cActive}
                      doneItems={cDone}
                    />
                  );
                })}
              </div>
`;

// Replace the two large relative divs (lines ~694 to 813) with mainViewCode
// We'll use regex to match from <div className={`relative mt-8 rounded-sm shadow-md border-[2px] border-gray-400... to the end of the DONE block.
// Wait, the DONE block ends right before </div>\n          )}

const searchRegex = /<div className=\{`relative mt-8 rounded-sm shadow-md border-\[2px\] border-gray-400 flex flex-col p-6 sm:p-10 min-h-\[500px\] transition-colors duration-300`\}[\s\S]*?No completed tasks yet\.<\/p>\s*<\/div>\s*\)\}\s*<\/div>\s*<\/div>\s*<\/div>/;

if (searchRegex.test(code)) {
    code = code.replace(searchRegex, mainViewCode);
} else {
    console.error("Regex didn't match main view code!");
}

const historyModalRender = `
      {/* History Modal */}
      {historyModalCategory && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex justify-end">
           <div className="w-full max-w-md bg-surface h-full shadow-2xl flex flex-col animate-in slide-in-from-right relative">
              <div className="flex items-center justify-between p-6 border-b border-outline-variant/20 bg-surface-container-low">
                 <div>
                   <h2 className="text-xl font-bold">{getCategoryName(historyModalCategory)} History</h2>
                   <p className="text-sm text-on-surface-variant">Past 30 days</p>
                 </div>
                 <button onClick={() => setHistoryModalCategory(null)} className="p-2 hover:bg-black/10 rounded-full">
                    <X className="w-5 h-5" />
                 </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                 {loadingHistory ? (
                   <div className="text-center text-on-surface-variant py-8">Loading history...</div>
                 ) : historyLogs.length === 0 ? (
                   <div className="text-center text-on-surface-variant py-8">No past logs found for this category.</div>
                 ) : (
                   historyLogs.map(log => (
                     <div key={log.date} className="flex flex-col gap-2">
                        <h3 className="font-bold text-sm text-on-surface-variant/80 border-b border-outline-variant/20 pb-1">
                           {new Date(log.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        </h3>
                        <div className="flex flex-col gap-2">
                           {log.items.map((item: any, i: number) => (
                              <div key={i} className="flex items-start gap-2 bg-surface-container-lowest p-3 rounded-lg border border-outline-variant/20">
                                 <div className={\`mt-0.5 w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center border \${item.completed ? 'bg-green-100 border-green-300' : 'bg-gray-100 border-gray-300'}\`}>
                                    {item.completed && <Check className="w-3 h-3 text-green-700" />}
                                 </div>
                                 <div className={\`flex-1 text-sm \${item.completed ? 'opacity-60 line-through text-on-surface-variant' : 'text-on-surface'}\`}>
                                    {item.text}
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>
                   ))
                 )}
              </div>
           </div>
        </div>
      )}
`;

code = code.replace("{/* Category Management Modal */}", historyModalRender + "\n      {/* Category Management Modal */}");


fs.writeFileSync(file, code);
console.log('done');
