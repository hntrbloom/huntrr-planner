sed -i '2404,2412c\
              <div className="flex items-center justify-between p-3 bg-surface-variant/30 rounded-xl border border-outline-variant/30 mb-4">\
                <div className="flex items-center gap-2">\
                  <span className="text-sm font-medium text-on-surface-variant">Type:</span>\
                  <span className="text-sm font-bold text-on-surface">{formData.madeFor || "Mini Furniture"}</span>\
                </div>\
                {onChangeType && (\
                  <button type="button" onClick={() => onChangeType(formData)} className="text-xs font-bold text-primary hover:text-primary/80 transition-colors px-2 py-1 bg-primary/5 rounded-lg">\
                    Change\
                  </button>\
                )}\
              </div>' src/components/MiniFurnitureView.tsx
