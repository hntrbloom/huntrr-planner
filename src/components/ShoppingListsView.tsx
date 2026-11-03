import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, onSnapshot, setDoc } from '../lib/workspaceStore';
import { useAuth } from '../lib/AuthContext';
import { GUEST_SAMPLE_SHOPPING_LISTS } from '../lib/guestSampleData';
import { ShoppingCart, Plus, Trash2, ChevronLeft, CheckCircle2, Circle } from 'lucide-react';
import { TopBar } from './TopBar';

export interface ShoppingItem {
  id: string;
  name: string;
  quantity?: string;
  completed: boolean;
  createdAt: number;
}

export interface ShoppingList {
  id: string;
  name: string;
  items: ShoppingItem[];
  createdAt: number;
  updatedAt: number;
}

export function ShoppingListsView() {
  const { user } = useAuth();
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [isRenaming, setIsRenaming] = useState(false);
  const [listName, setListName] = useState('');
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [isAddingList, setIsAddingList] = useState(false);
  const [newListName, setNewListName] = useState('');

  // Quick Add Item State
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('');

  // Editing State
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemQty, setEditItemQty] = useState('');

  // Fetch Data
  useEffect(() => {
    if (!user || user.isAnonymous) {
      setLists(GUEST_SAMPLE_SHOPPING_LISTS);
      return;
    }

    const docRef = doc(db, `users/${user.uid}/preferences`, 'shoppingListsData');
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists() && docSnap.data().lists) {
          setLists(docSnap.data().lists);
        } else {
          setLists([]);
        }
      },
      (err) => {
        console.error("Error fetching shopping lists:", err);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Save Data
  const saveLists = async (updatedLists: ShoppingList[]) => {
    setLists(updatedLists);
    if (!user || user.isAnonymous) return; // Guests don't persist to cloud

    try {
      const docRef = doc(db, `users/${user.uid}/preferences`, 'shoppingListsData');
      await setDoc(docRef, { lists: updatedLists }, { merge: true });
    } catch (err) {
      console.error("Error saving shopping lists:", err);
    }
  };

  const createList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;

    const newList: ShoppingList = {
      id: `list-${Date.now()}`,
      name: newListName.trim(),
      items: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    saveLists([newList, ...lists]);
    setNewListName('');
    setIsAddingList(false);
    setActiveListId(newList.id);
  };

  const deleteList = (listId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    saveLists(lists.filter(l => l.id !== listId));
    if (activeListId === listId) {
      setActiveListId(null);
    }
  };

  const addItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !activeListId) return;

    const listIndex = lists.findIndex(l => l.id === activeListId);
    if (listIndex === -1) return;

    const updatedLists = [...lists];
    const newItem: ShoppingItem = {
      id: `item-${Date.now()}`,
      name: newItemName.trim(),
      quantity: newItemQty.trim(),
      completed: false,
      createdAt: Date.now()
    };

    updatedLists[listIndex].items.push(newItem);
    updatedLists[listIndex].updatedAt = Date.now();
    saveLists(updatedLists);
    setNewItemName('');
    setNewItemQty('');
  };

  const toggleItem = (itemId: string) => {
    if (!activeListId) return;
    const listIndex = lists.findIndex(l => l.id === activeListId);
    if (listIndex === -1) return;

    const updatedLists = [...lists];
    const item = updatedLists[listIndex].items.find(i => i.id === itemId);
    if (item) {
      item.completed = !item.completed;
      updatedLists[listIndex].updatedAt = Date.now();
      saveLists(updatedLists);
    }
  };

  const deleteItem = (itemId: string) => {
    if (!activeListId) return;
    const listIndex = lists.findIndex(l => l.id === activeListId);
    if (listIndex === -1) return;

    const updatedLists = [...lists];
    updatedLists[listIndex].items = updatedLists[listIndex].items.filter(i => i.id !== itemId);
    updatedLists[listIndex].updatedAt = Date.now();
    saveLists(updatedLists);
  };

  const startEditingItem = (item: ShoppingItem) => {
    setEditingItemId(item.id);
    setEditItemName(item.name);
    setEditItemQty(item.quantity || '');
  };

  const saveEditItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeListId || !editingItemId || !editItemName.trim()) {
      setEditingItemId(null);
      return;
    }

    const listIndex = lists.findIndex(l => l.id === activeListId);
    if (listIndex === -1) return;

    const updatedLists = [...lists];
    const itemIndex = updatedLists[listIndex].items.findIndex(i => i.id === editingItemId);
    if (itemIndex !== -1) {
      updatedLists[listIndex].items[itemIndex].name = editItemName.trim();
      updatedLists[listIndex].items[itemIndex].quantity = editItemQty.trim();
      updatedLists[listIndex].updatedAt = Date.now();
      saveLists(updatedLists);
    }
    setEditingItemId(null);
  };

  const clearCompleted = () => {
    if (!activeListId) return;
    const listIndex = lists.findIndex(l => l.id === activeListId);
    if (listIndex === -1) return;

    const updatedLists = [...lists];
    updatedLists[listIndex].items = updatedLists[listIndex].items.filter(i => !i.completed);
    updatedLists[listIndex].updatedAt = Date.now();
    saveLists(updatedLists);
  };

  const activeList = lists.find(l => l.id === activeListId);

  return (
    <div className="flex-1 md:overflow-y-auto flex flex-col">
      <TopBar />
      <main className="flex-1 md:overflow-y-auto px-margin-mobile md:px-margin-desktop py-6 md:py-8 bg-transparent relative">
        <div className="w-full bg-surface-container-lowest border border-outline-variant/20 shadow-md rounded-xl min-h-[1200px] relative flex flex-col overflow-hidden mb-8">
          <div className="absolute left-6 sm:left-14 md:left-24 top-0 bottom-0 w-[2px] bg-primary/20 z-0"></div>
          <div className="flex-1 lined-paper relative z-10 px-4 md:px-8 pt-8 pb-safe-nav">
            <div className="pl-6 sm:pl-16 md:pl-24 h-full flex flex-col">

              {activeList ? (
                /* Detail View */
                <div className="flex-1 w-full mx-auto py-4 pb-24 md:pb-12 pr-4 md:pr-12 lg:pr-24">
                  <div className="flex justify-between items-end mb-8 border-b border-primary/20 pb-4">
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={() => setActiveListId(null)}
                        className="flex items-center text-[#888888] hover:text-[#222222] transition-colors text-sm font-medium -ml-1"
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Back to Lists
                      </button>
                      {isRenaming ? <form onSubmit={event => {
                        event.preventDefault(); if (!listName.trim()) return;
                        void saveLists(lists.map(list => list.id === activeList.id ? { ...list, name: listName.trim(), updatedAt: Date.now() } : list));
                        setIsRenaming(false);
                      }} className="flex flex-wrap gap-2">
                        <input aria-label="List name" value={listName} onChange={event => setListName(event.target.value)} autoFocus className="min-w-0 w-full border rounded-lg p-2" />
                        <button type="submit" disabled={!listName.trim()} className="bg-primary text-on-primary rounded-lg px-3 py-2">Save name</button>
                        <button type="button" onClick={() => setIsRenaming(false)}>Cancel</button>
                      </form> : <>
                        <h1 className="text-3xl font-headline-md tracking-tight text-[#1c1b1d] break-words">{activeList.name}</h1>
                        <button className="text-primary text-sm underline text-left" onClick={() => { setListName(activeList.name); setIsRenaming(true); }}>Rename list</button>
                      </>}
                    </div>
                    <button
                      onClick={() => deleteList(activeList.id)}
                      className="p-2 text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors mb-1"
                      title="Delete List"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Add Item Form */}
                  <form onSubmit={addItem} className="flex gap-3 mb-8 items-center bg-white p-2 rounded-xl shadow-sm border border-primary/20">
                    <input
                      type="text"
                      placeholder="Add item..."
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      className="flex-1 min-w-0 bg-transparent px-3 py-2 text-base outline-none text-[#1c1b1d] placeholder:text-[#999999]"
                      autoFocus
                    />
                    <input
                      type="text"
                      placeholder="Qty (opt)"
                      value={newItemQty}
                      onChange={(e) => setNewItemQty(e.target.value)}
                      className="w-24 bg-transparent px-3 py-2 text-sm outline-none text-[#555555] placeholder:text-[#999999] border-l border-primary/20"
                    />
                    <button
                      type="submit"
                      disabled={!newItemName.trim()}
                      className="bg-primary text-on-primary p-2.5 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 flex items-center justify-center shrink-0"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </form>

                  {/* Items List */}
                  <div className="space-y-1">
                    {/* Sort items inline: incomplete first, then by createdAt */}
                    {[...activeList.items].sort((a, b) => (a.completed === b.completed ? a.createdAt - b.createdAt : (a.completed ? 1 : -1))).map(item => (
                      <div
                        key={item.id}
                        className={`group flex items-center gap-3 py-2 border-b border-dashed border-primary/10 transition-all ${item.completed ? 'opacity-50' : 'opacity-100'}`}
                      >
                        {editingItemId === item.id ? (
                          <form onSubmit={saveEditItem} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) saveEditItem(); }} className="flex-1 flex gap-2 items-center bg-white p-1 rounded-lg border border-primary/30">
                            <input
                              type="text"
                              aria-label="Item name"
                              value={editItemName}
                              onChange={(e) => setEditItemName(e.target.value)}
                              className="flex-1 min-w-0 bg-transparent px-2 py-1 text-base outline-none text-[#1c1b1d]"
                              autoFocus

                            />
                            <input
                              type="text"
                              value={editItemQty}
                              onChange={(e) => setEditItemQty(e.target.value)}
                              className="w-12 sm:w-20 bg-transparent px-2 py-1 text-sm outline-none text-[#555555] border-l border-primary/20"
                              aria-label="Item quantity"
                              placeholder="Qty"

                            />
                            <button type="submit" className="bg-primary text-on-primary rounded-lg p-2 text-sm">Save</button>
                          </form>
                        ) : (
                          <>
                            <button
                              aria-label={`Mark ${item.name} ${item.completed ? 'incomplete' : 'complete'}`}
                              onClick={() => toggleItem(item.id)}
                              className={`shrink-0 transition-colors ${item.completed ? 'text-primary' : 'text-[#cccccc] hover:text-primary'}`}
                            >
                              {item.completed ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                            </button>

                            <div
                              className="flex-1 flex items-baseline gap-2 overflow-hidden cursor-pointer"
                              role="button" tabIndex={0} aria-label={`Edit ${item.name}`}
                              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEditingItem(item); } }}
                              onClick={() => startEditingItem(item)}
                            >
                              <span className={`text-lg font-medium text-[#1c1b1d] truncate ${item.completed ? 'line-through text-[#666666]' : ''}`}>
                                {item.name}
                              </span>
                              {item.quantity && (
                                <span className={`text-sm shrink-0 font-medium ${item.completed ? 'text-[#888888]' : 'text-primary'}`}>
                                  ({item.quantity})
                                </span>
                              )}
                            </div>

                            <button
                              onClick={() => deleteItem(item.id)}
                              className="opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 p-2 text-rose-700 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-all shrink-0"
                              aria-label="Delete item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    ))}

                    {activeList.items.length === 0 && (
                      <div className="text-center py-12 text-[#999999] italic">
                        This list is empty. Add some items above!
                      </div>
                    )}
                  </div>

                  {activeList.items.some(i => i.completed) && (
                    <div className="mt-8 flex justify-end">
                      <button
                        onClick={clearCompleted}
                        className="text-sm font-medium text-primary hover:text-primary-dark hover:underline flex items-center gap-1 transition-colors"
                      >
                        Clear completed items
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Dashboard View */
                <div className="flex-1 w-full mx-auto py-4 pb-24 md:pb-12 pr-4 md:pr-12 lg:pr-24">
                  <div className="flex justify-between items-end mb-8">
                    <div>
                      <h1 className="text-3xl md:text-[40px] leading-[1.1] font-normal font-headline-md text-[#1c1b1d] tracking-tight mb-2">
                        Shopping Lists
                      </h1>
                    </div>
                    {!isAddingList && (
                      <button
                        onClick={() => setIsAddingList(true)}
                        className="hidden sm:flex bg-primary text-on-primary px-4 py-2.5 rounded-full font-semibold text-[14px] hover:bg-primary-dark transition-colors items-center gap-2 shadow-sm"
                      >
                        <Plus className="w-4 h-4" /> New List
                      </button>
                    )}
                  </div>

                  {isAddingList && (
                    <form onSubmit={createList} className="mb-8 bg-white p-4 rounded-2xl shadow-sm border border-primary/20 flex gap-3 items-center">
                      <input
                        type="text"
                        placeholder="List name (e.g., Target Run)"
                        value={newListName}
                        onChange={(e) => setNewListName(e.target.value)}
                        className="flex-1 bg-surface px-4 py-3 rounded-xl border-none outline-none focus:ring-2 focus:ring-primary/50 text-[#1c1b1d]"
                        autoFocus
                      />
                      <button
                        type="submit"
                        disabled={!newListName.trim()}
                        className="bg-primary text-on-primary px-5 py-3 rounded-xl font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 whitespace-nowrap"
                      >
                        Create
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsAddingList(false)}
                        className="px-4 py-3 text-[#666666] hover:bg-surface-variant rounded-xl font-semibold transition-colors"
                      >
                        Cancel
                      </button>
                    </form>
                  )}

                  {/* Lists Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                    {lists.map(list => {
                      const totalItems = list.items.length;
                      const completedItems = list.items.filter(i => i.completed).length;
                      const remainingItems = totalItems - completedItems;
                      const previewItems = list.items.slice(0, 3);
                      const hasMore = totalItems > 3;

                      return (
                        <div
                          key={list.id}
                          onClick={() => setActiveListId(list.id)}
                          className="bg-white rounded-sm shadow-md border-[2px] border-gray-400 flex flex-col group relative cursor-pointer hover:-translate-y-1 transition-transform"
                        >
                          <div className="absolute -top-3 right-4 w-3 h-7 border-[2px] border-gray-400 rounded-full bg-transparent rotate-[15deg] shadow-[1px_1px_1px_rgba(0,0,0,0.1)] z-10 pointer-events-none"></div>

                          {/* Cute List Header */}
                          <div className="bg-[#FFF0F4]/40 px-5 py-4 border-b-[2px] border-black/5 flex items-start justify-between">
                            <div>
                              <h3 className="text-xl font-semibold text-[#1c1b1d] tracking-tight group-hover:text-primary transition-colors">{list.name}</h3>
                              <div className="text-sm font-medium text-[#777777] mt-1 flex gap-2">
                                {remainingItems === 0 && totalItems > 0 ? (
                                  <span className="text-emerald-500">All done! 🎉</span>
                                ) : (
                                  <>
                                    <span className="text-primary">{remainingItems} to buy</span>
                                    <span>•</span>
                                    <span>{completedItems} completed</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm border border-gray-200 group-hover:scale-105 transition-transform text-primary">
                              <ShoppingCart className="w-4 h-4" />
                            </div>
                          </div>

                          {/* Items Preview */}
                          <div className="p-5 flex-1 bg-white lined-paper relative min-h-[140px]">
                             <div className="space-y-3 relative z-10">
                              {previewItems.length > 0 ? (
                                <>
                                  {previewItems.map(item => (
                                    <div key={item.id} className={`flex items-center gap-2 text-sm ${item.completed ? 'opacity-50 text-[#888888] line-through' : 'text-[#333333]'}`}>
                                      {item.completed ? <CheckCircle2 className="w-4 h-4 shrink-0 text-primary" /> : <Circle className="w-4 h-4 shrink-0 text-[#cccccc]" />}
                                      <span className="truncate">{item.name} {item.quantity && `(${item.quantity})`}</span>
                                    </div>
                                  ))}
                                  {hasMore && (
                                    <div className="text-xs text-[#999999] font-medium pl-6 pt-1">
                                      + {totalItems - 3} more items...
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="text-sm text-[#999999] italic py-2 text-center h-full flex items-center justify-center">
                                  Empty list
                                </div>
                              )}
                             </div>
                          </div>

                          {/* Actions */}
                          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                            <button
                               onClick={(e) => deleteList(list.id, e)}
                               className="p-1.5 bg-white text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-full shadow-sm transition-colors border border-rose-100"
                               title="Delete List"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Empty State / Add Card */}
                    {!isAddingList && lists.length === 0 && (
                      <div
                        onClick={() => setIsAddingList(true)}
                        className="bg-white rounded-sm shadow-md border-[2px] border-dashed border-gray-400/50 flex flex-col items-center justify-center text-center p-8 cursor-pointer hover:bg-gray-50 transition-colors min-h-[200px]"
                      >
                         <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-primary shadow-sm border border-gray-200 mb-4">
                           <Plus className="w-6 h-6" />
                         </div>
                         <h3 className="text-lg font-semibold text-[#1c1b1d] mb-1">Create your first list</h3>
                         <p className="text-sm text-[#666666]">Groceries, supplies, and more</p>
                      </div>
                    )}
                  </div>

                  {/* Mobile Add Button FAB */}
                  {!isAddingList && (
                    <button
                      onClick={() => setIsAddingList(true)}
                      className="sm:hidden fixed bottom-[90px] right-6 w-14 h-14 bg-primary text-on-primary rounded-full shadow-lg flex items-center justify-center hover:bg-primary-dark transition-all hover:scale-105 active:scale-95 z-50"
                    >
                      <Plus className="w-7 h-7" />
                    </button>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
