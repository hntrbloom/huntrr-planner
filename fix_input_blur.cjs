const fs = require('fs');
let code = fs.readFileSync('src/components/EntitySelector.tsx', 'utf8');

const regexInput = /onChange=\{\(e\) => \{([\s\S]*?)\}\}/;
const replacement = `onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
            setIsManaging(false);
            const matched = entities.find(ent => ent.name.toLowerCase() === e.target.value.trim().toLowerCase());
            if (matched) {
              onChange(matched.id, matched.name);
            } else {
              onChange('', e.target.value);
            }
          }}
          onBlur={() => {
            // Give a slight delay so clicks on dropdown items can register before we close
            setTimeout(() => {
              // We do not save to Firebase here; the form handles saving.
              // We just make sure the dropdown closes nicely when tapping away.
              // We also ensure that if they typed something, we notify parent one last time
              const matched = entities.find(ent => ent.name.toLowerCase() === inputValue.trim().toLowerCase());
              if (matched) {
                onChange(matched.id, matched.name);
              } else if (inputValue.trim()) {
                onChange('', inputValue);
              }
              setIsOpen(false);
            }, 200);
          }}`;

code = code.replace(regexInput, replacement);
fs.writeFileSync('src/components/EntitySelector.tsx', code);
