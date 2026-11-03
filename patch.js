const fs = require('fs');
const content = fs.readFileSync('src/components/CharacterWikiView.tsx', 'utf-8');

const target = `            const payload: any = {
              ...(initialData || {}),
              ...formData,
              mainColor: sanitizedMainColor,
              colors: sanitizedColors,
              additionalPalette: sanitizedColors
            };`;

const replacement = `            let finalCompanyId = formData.companyId;
            if (formData.company && !formData.companyId) {
              const matched = franchiseList.find(f => f.name.toLowerCase() === formData.company!.trim().toLowerCase());
              if (matched) {
                finalCompanyId = matched.id;
              } else {
                const newId = Date.now().toString();
                await onSaveEntity('franchise', [...franchiseList, { id: newId, name: formData.company.trim(), createdAt: Date.now() }]);
                finalCompanyId = newId;
              }
            }
            
            let finalSeriesId = formData.seriesId;
            if (formData.series && !formData.seriesId) {
              const matched = seriesList.find(s => s.name.toLowerCase() === formData.series!.trim().toLowerCase());
              if (matched) {
                finalSeriesId = matched.id;
              } else {
                const newId = (Date.now() + 1).toString();
                await onSaveEntity('series', [...seriesList, { id: newId, name: formData.series.trim(), createdAt: Date.now() }]);
                finalSeriesId = newId;
              }
            }

            const payload: any = {
              ...(initialData || {}),
              ...formData,
              companyId: finalCompanyId,
              company: formData.company?.trim(),
              seriesId: finalSeriesId,
              series: formData.series?.trim(),
              mainColor: sanitizedMainColor,
              colors: sanitizedColors,
              additionalPalette: sanitizedColors
            };`;

fs.writeFileSync('src/components/CharacterWikiView.tsx', content.replace(target, replacement));
