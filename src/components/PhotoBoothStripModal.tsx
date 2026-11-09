import React, { useState } from 'react';
import { X, Download, Sparkles, Printer } from 'lucide-react';
import { soundFX } from '../utils/audioEffects';

interface PhotoBoothStripModalProps {
  isOpen: boolean;
  onClose: () => void;
  stripImageUrl: string | null;
  onDownload: () => void;
}

export const PhotoBoothStripModal: React.FC<PhotoBoothStripModalProps> = ({
  isOpen,
  onClose,
  stripImageUrl,
  onDownload,
}) => {
  if (!isOpen || !stripImageUrl) return null;

  const handlePrint = () => {
    const win = window.open('');
    if (win) {
      win.document.write(`
        <html>
          <head><title>Chronos Photobooth Strip</title></head>
          <body style="margin:0;display:flex;justify-content:center;align-items:center;background:#111;min-height:100vh;">
            <img src="${stripImageUrl}" style="max-height:95vh;box-shadow:0 0 20px rgba(0,0,0,0.5);border-radius:4px;" />
          </body>
        </html>
      `);
      win.document.close();
      win.focus();
      win.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="relative w-full max-w-md bg-stone-900 border border-amber-600/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-stone-800 bg-stone-950/80">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h3 className="font-serif text-sm font-bold text-amber-300">
              Vintage 4-Photo Booth Strip
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Strip Image Display */}
        <div className="flex-1 bg-stone-950 p-6 overflow-y-auto flex items-center justify-center">
          <img
            src={stripImageUrl}
            alt="Photobooth Strip"
            className="max-h-[68vh] shadow-2xl rounded border border-stone-200"
          />
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-stone-800 bg-stone-950 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-300 hover:text-white bg-stone-800 rounded-lg border border-stone-700 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" /> Print
          </button>

          <button
            type="button"
            onClick={onDownload}
            className="flex items-center gap-2 px-5 py-2 text-xs font-bold font-serif text-stone-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-md transition-all active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            Download Strip (JPG)
          </button>
        </div>
      </div>
    </div>
  );
};
