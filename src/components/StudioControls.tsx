import React from 'react';
import { FaceAdjustments, HistoricalEra } from '../types/timeTravel';
import { Sliders, Sun, RotateCw, ZoomIn, Frame, Undo2 } from 'lucide-react';
import { soundFX } from '../utils/audioEffects';

interface StudioControlsProps {
  adjustments: FaceAdjustments;
  onChange: (adjustments: FaceAdjustments) => void;
  selectedEra: HistoricalEra;
}

export const StudioControls: React.FC<StudioControlsProps> = ({
  adjustments,
  onChange,
  selectedEra,
}) => {
  const update = (partial: Partial<FaceAdjustments>) => {
    onChange({ ...adjustments, ...partial });
  };

  const handleReset = () => {
    soundFX.playGearClick();
    onChange({
      scale: 1.0,
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      brightness: 100,
      contrast: 105,
      warmth: selectedEra.filterProfile.warmth,
      featherRadius: 20,
      selectedAccessoryId: selectedEra.accessoryOptions[0]?.id || null,
      frameStyle: 'ornate-gold',
    });
  };

  return (
    <div className="bg-stone-900/95 border border-stone-800 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-stone-800">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-amber-400" />
          <h3 className="font-serif text-sm font-bold text-stone-200">
            Portrait Fitting & Color Tone
          </h3>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="text-[11px] text-stone-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
        >
          <Undo2 className="w-3 h-3" /> Reset
        </button>
      </div>

      {/* Geometry Sliders: Scale, X, Y, Rotate */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div>
          <div className="flex justify-between text-stone-400 mb-1">
            <span className="flex items-center gap-1">
              <ZoomIn className="w-3 h-3" /> Face Scale
            </span>
            <span className="font-mono">{adjustments.scale.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min="0.6"
            max="1.6"
            step="0.02"
            value={adjustments.scale}
            onChange={(e) => update({ scale: parseFloat(e.target.value) })}
            className="w-full accent-amber-500 h-1.5 bg-stone-950 rounded-lg cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between text-stone-400 mb-1">
            <span className="flex items-center gap-1">
              <RotateCw className="w-3 h-3" /> Rotation
            </span>
            <span className="font-mono">{adjustments.rotation}°</span>
          </div>
          <input
            type="range"
            min="-25"
            max="25"
            step="1"
            value={adjustments.rotation}
            onChange={(e) => update({ rotation: parseInt(e.target.value) })}
            className="w-full accent-amber-500 h-1.5 bg-stone-950 rounded-lg cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between text-stone-400 mb-1">
            <span>Pan Horizontal (X)</span>
            <span className="font-mono">{adjustments.offsetX}px</span>
          </div>
          <input
            type="range"
            min="-100"
            max="100"
            step="2"
            value={adjustments.offsetX}
            onChange={(e) => update({ offsetX: parseInt(e.target.value) })}
            className="w-full accent-amber-500 h-1.5 bg-stone-950 rounded-lg cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between text-stone-400 mb-1">
            <span>Pan Vertical (Y)</span>
            <span className="font-mono">{adjustments.offsetY}px</span>
          </div>
          <input
            type="range"
            min="-100"
            max="100"
            step="2"
            value={adjustments.offsetY}
            onChange={(e) => update({ offsetY: parseInt(e.target.value) })}
            className="w-full accent-amber-500 h-1.5 bg-stone-950 rounded-lg cursor-pointer"
          />
        </div>
      </div>

      {/* Tone & Lighting Sliders */}
      <div className="pt-2 border-t border-stone-800/80 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div>
          <div className="flex justify-between text-stone-400 mb-1">
            <span className="flex items-center gap-1">
              <Sun className="w-3 h-3" /> Brightness
            </span>
            <span className="font-mono">{adjustments.brightness}%</span>
          </div>
          <input
            type="range"
            min="70"
            max="135"
            step="1"
            value={adjustments.brightness}
            onChange={(e) => update({ brightness: parseInt(e.target.value) })}
            className="w-full accent-amber-500 h-1.5 bg-stone-950 rounded-lg cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between text-stone-400 mb-1">
            <span>Contrast</span>
            <span className="font-mono">{adjustments.contrast}%</span>
          </div>
          <input
            type="range"
            min="80"
            max="140"
            step="1"
            value={adjustments.contrast}
            onChange={(e) => update({ contrast: parseInt(e.target.value) })}
            className="w-full accent-amber-500 h-1.5 bg-stone-950 rounded-lg cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between text-stone-400 mb-1">
            <span>Color Warmth</span>
            <span className="font-mono">
              {adjustments.warmth > 0 ? `+${adjustments.warmth}` : adjustments.warmth}
            </span>
          </div>
          <input
            type="range"
            min="-40"
            max="40"
            step="2"
            value={adjustments.warmth}
            onChange={(e) => update({ warmth: parseInt(e.target.value) })}
            className="w-full accent-amber-500 h-1.5 bg-stone-950 rounded-lg cursor-pointer"
          />
        </div>
      </div>

      {/* Frame Style Selector */}
      <div className="pt-2 border-t border-stone-800/80 space-y-1.5">
        <label className="text-xs font-semibold text-stone-300 flex items-center gap-1.5">
          <Frame className="w-3.5 h-3.5 text-amber-400" />
          Souvenir Frame Style:
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {[
            { id: 'ornate-gold', label: 'Baroque Gold' },
            { id: 'wanted-poster', label: 'Wanted Poster' },
            { id: 'vintage-polaroid', label: 'Polaroid' },
            { id: 'archive-slate', label: 'Archive Tag' },
          ].map((frame) => (
            <button
              key={frame.id}
              type="button"
              onClick={() => {
                soundFX.playGearClick();
                update({ frameStyle: frame.id as any });
              }}
              className={`py-1.5 px-2 rounded-lg font-medium transition-all text-center ${
                adjustments.frameStyle === frame.id
                  ? 'bg-amber-500 text-stone-950 font-semibold'
                  : 'bg-stone-950 hover:bg-stone-800 text-stone-300 border border-stone-800'
              }`}
            >
              {frame.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
