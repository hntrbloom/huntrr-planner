sed -i '/{isFormOpen && (/i\
      {isTypeSelectorOpen && (\
        <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">\
          <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-fade-in">\
            <div className="px-6 py-5 border-b border-outline-variant/20 flex justify-between items-center bg-white">\
              <h2 className="text-xl font-headline-md font-semibold text-on-surface">\
                What type of print is this?\
              </h2>\
              <button onClick={() => { setIsTypeSelectorOpen(false); setDraftFormData(null); }} className="p-2 text-on-surface-variant hover:bg-surface-variant/50 rounded-full transition-colors">\
                <X className="w-5 h-5" />\
              </button>\
            </div>\
            <div className="p-6 flex flex-col gap-3 bg-surface/30">\
              {[ { type: "Mini Furniture", desc: "Furniture items and main pieces" }, { type: "Object", desc: "Small accessories and decor" }, { type: "Charm", desc: "Standard charms with loops" }, { type: "Mini Charm", desc: "Small standalone charms" } ].map((opt) => (\
                <button\
                  key={opt.type}\
                  onClick={() => {\
                    if (draftFormData) {\
                      setDraftFormData({ ...draftFormData, madeFor: opt.type });\
                      setIsTypeSelectorOpen(false);\
                      setIsFormOpen(true);\
                    } else {\
                      setSelectedInitialType(opt.type);\
                      setIsTypeSelectorOpen(false);\
                      setIsFormOpen(true);\
                    }\
                  }}\
                  className="w-full text-left p-4 rounded-2xl border border-outline-variant/30 bg-white hover:border-primary/50 hover:bg-primary/5 hover:shadow-md transition-all flex flex-col gap-1 active:scale-[0.98]"\
                >\
                  <span className="text-lg font-bold text-on-surface">{opt.type}</span>\
                  <span className="text-sm text-on-surface-variant">{opt.desc}</span>\
                </button>\
              ))}\
            </div>\
          </div>\
        </div>\
      )}\
' src/components/MiniFurnitureView.tsx
