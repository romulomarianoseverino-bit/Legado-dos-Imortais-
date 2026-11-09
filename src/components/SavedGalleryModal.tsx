import React from 'react';
import { SavedExcursion } from '../types/timeTravel';
import { X, Trash2, Download, ExternalLink, Calendar, MapPin } from 'lucide-react';
import { soundFX } from '../utils/audioEffects';

interface SavedGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedExcursions: SavedExcursion[];
  onSelectExcursion: (excursion: SavedExcursion) => void;
  onDeleteExcursion: (id: string) => void;
}

export const SavedGalleryModal: React.FC<SavedGalleryModalProps> = ({
  isOpen,
  onClose,
  savedExcursions,
  onSelectExcursion,
  onDeleteExcursion,
}) => {
  if (!isOpen) return null;

  const downloadImage = (item: SavedExcursion) => {
    soundFX.playGearClick();
    const link = document.createElement('a');
    link.href = item.imageDataUrl;
    link.download = `Chronos_${item.eraId}_${item.eraYear}.jpg`;
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="relative w-full max-w-4xl bg-stone-900 border border-amber-600/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800 bg-stone-950/80">
          <div>
            <h2 className="font-serif text-lg font-bold text-amber-300">
              Temporal Passport Gallery
            </h2>
            <p className="text-xs text-stone-400">
              Your saved historical portraits and time-travel expeditions
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Gallery Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-stone-950">
          {savedExcursions.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <span className="text-4xl">⏳</span>
              <h3 className="font-serif text-base font-bold text-stone-300">
                No Temporal Journeys Recorded Yet
              </h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                Step into the booth, capture your photo, and transport your face to Ancient Egypt,
                the Renaissance, or the Wild West!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedExcursions.map((item) => (
                <div
                  key={item.id}
                  className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden flex flex-col group hover:border-amber-500/40 transition-all"
                >
                  <div className="relative aspect-[3/4] bg-stone-950 overflow-hidden cursor-pointer" onClick={() => onSelectExcursion(item)}>
                    <img
                      src={item.imageDataUrl}
                      alt={item.eraName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-stone-950/80 border border-stone-700 text-amber-300">
                      {item.eraYear}
                    </div>
                  </div>

                  <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-serif text-sm font-bold text-stone-100 truncate">
                        {item.eraName}
                      </h4>
                      <p className="text-xs text-amber-400 font-medium truncate">
                        {item.role}
                      </p>
                      <span className="text-[11px] text-stone-500 flex items-center gap-1 mt-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(item.timestamp).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-stone-800 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => downloadImage(item)}
                        className="p-1.5 text-stone-400 hover:text-amber-400 hover:bg-stone-800 rounded transition-colors"
                        title="Download Portrait"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectExcursion(item);
                            onClose();
                          }}
                          className="px-3 py-1 text-xs font-medium rounded bg-stone-800 hover:bg-amber-500 hover:text-stone-950 text-stone-300 transition-colors"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteExcursion(item.id)}
                          className="p-1.5 text-stone-500 hover:text-red-400 hover:bg-stone-800 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
