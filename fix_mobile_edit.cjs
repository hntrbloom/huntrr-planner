const fs = require('fs');
let code = fs.readFileSync('src/components/CharacterWikiView.tsx', 'utf8');

// 1. Fix the modal backdrop and container
const oldBackdrop = `<div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 md:p-6 bg-black/40 backdrop-blur-sm pointer-events-auto overflow-hidden">`;
const newBackdrop = `<div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-5 md:p-6 bg-black/40 backdrop-blur-sm pointer-events-auto overflow-hidden">`;
code = code.replace(oldBackdrop, newBackdrop);

const oldContainer = `<div className="w-full max-w-2xl max-h-[85vh] sm:max-h-[80vh] my-auto bg-white rounded-2xl md:rounded-3xl shadow-[0_12px_40px_rgba(0,0,0,0.18)] border border-[#FFB8CD]/40 flex flex-col animate-in fade-in zoom-in-95 duration-200 box-border overflow-hidden">`;
const newContainer = `<div className="w-full max-w-2xl h-[100dvh] max-h-[100dvh] sm:h-auto sm:max-h-[85vh] md:max-h-[80vh] my-0 sm:my-auto bg-white rounded-none sm:rounded-2xl md:rounded-3xl shadow-[0_12px_40px_rgba(0,0,0,0.18)] sm:border border-[#FFB8CD]/40 flex flex-col animate-in fade-in zoom-in-95 duration-200 box-border overflow-hidden">`;
code = code.replace(oldContainer, newContainer);

// 2. Add overflow-y-auto to the form content
const oldContent = `<div className="flex-1 p-4 md:p-5 space-y-4 min-h-0">`;
const newContent = `<div className="flex-1 p-4 md:p-5 space-y-4 min-h-0 overflow-y-auto">`;
code = code.replace(oldContent, newContent);

// 3. Just in case, the Cancel and Save buttons container should have flex-shrink-0 and pb-safe to not be cut off by iOS home indicator
const oldFooter = `<div className="border-t border-[#FFB8CD]/30 px-4 py-2.5 md:px-5 md:py-3 flex justify-end gap-2.5 box-border shrink-0 bg-[#FFF0F4]/40 rounded-b-2xl md:rounded-b-3xl z-10">`;
const newFooter = `<div className="border-t border-[#FFB8CD]/30 px-4 py-2.5 pb-[max(env(safe-area-inset-bottom),10px)] md:px-5 md:py-3 md:pb-3 flex justify-end gap-2.5 box-border shrink-0 bg-[#FFF0F4]/40 sm:rounded-b-2xl md:rounded-b-3xl z-10">`;
code = code.replace(oldFooter, newFooter);

fs.writeFileSync('src/components/CharacterWikiView.tsx', code);
