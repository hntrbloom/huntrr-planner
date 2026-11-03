const fs = require('fs');
let code = fs.readFileSync('src/components/WikiDriveImagePicker.tsx', 'utf8');

const oldBackdrop = `<div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">`;
const newBackdrop = `<div className="fixed inset-0 z-[200] flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">`;
code = code.replace(oldBackdrop, newBackdrop);

const oldContainer = `<div className="bg-white rounded-[24px] w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">`;
const newContainer = `<div className="bg-white rounded-none sm:rounded-[24px] w-full max-w-2xl h-[100dvh] max-h-[100dvh] sm:h-auto sm:max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">`;
code = code.replace(oldContainer, newContainer);

const oldFooter = `<div className="p-4 border-t border-[#FFB8CD]/30 bg-gray-50 flex justify-end gap-3 rounded-b-[24px]">`;
const newFooter = `<div className="p-4 pb-[max(env(safe-area-inset-bottom),16px)] sm:pb-4 border-t border-[#FFB8CD]/30 bg-gray-50 flex justify-end gap-3 sm:rounded-b-[24px]">`;
code = code.replace(oldFooter, newFooter);

fs.writeFileSync('src/components/WikiDriveImagePicker.tsx', code);
