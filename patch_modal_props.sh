sed -i '1805,1810c\
        <FurnitureFormModal items={items} printSets={printSets}\
          item={editingItem}\
          draftItem={draftFormData}\
          initialType={selectedInitialType}\
          onChangeType={(currentData) => {\
            setDraftFormData(currentData);\
            setIsFormOpen(false);\
            setIsTypeSelectorOpen(true);\
          }}\
          categories={categories}\
          onClose={() => { setIsFormOpen(false); setEditingItem(null); setDraftFormData(null); }}\
          onSave={handleSaveItem}\
        />' src/components/MiniFurnitureView.tsx
