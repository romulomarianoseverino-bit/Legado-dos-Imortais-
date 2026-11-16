import React from 'react';
import { HISTORICAL_ERAS } from '../data/historicalEras';
import { HistoricalEra } from '../types/timeTravel';
import { soundFX } from '../utils/audioEffects';
import { Clock, MapPin, Shield } from 'lucide-react';

interface EraSelectorProps {
  selectedEra: HistoricalEra;
  onSelectEra: (era: HistoricalEra) => void;
  selectedRole: string;
  onSelectRole: (role: string) => void;
}

export const EraSelector: React.FC<EraSelectorProps> = ({
  selectedEra,
  onSelectEra,
  selectedRole,
  onSelectRole,
}) => {
  const handleEraClick = (era: HistoricalEra) => {
    soundFX.playGearClick();
    onSelectEra(era);
    onSelectRole(era.defaultRole);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-base font-bold text-amber-300 tracking-wide">
            1. Select Temporal Destination
          </h2>
          <p className="text-xs text-stone-400">
            Choose an iconic era from antiquity to the future
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-amber-400/80 bg-amber-950/40 border border-amber-500/30 px-3 py-1 rounded-lg">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span>{selectedEra.year}</span>
        </div>
      </div>

      {/* Horizontal Scrollable Era Carousel */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
        {HISTORICAL_ERAS.map((era) => {
          const isSelected = era.id === selectedEra.id;
          return (
            <button
              key={era.id}
              type="button"
              onClick={() => handleEraClick(era)}
              className={`shrink-0 w-52 p-3 text-left rounded-xl transition-all duration-200 border cursor-pointer relative overflow-hidden ${
                isSelected
                  ? `bg-stone-900 border-amber-400 shadow-lg shadow-amber-500/20 ring-1 ring-amber-400 scale-[1.02]`
                  : `bg-stone-900/60 border-stone-800 hover:border-stone-700 hover:bg-stone-900 text-stone-400`
              }`}
            >
              <div className="flex items-start justify-between mb-1.5">
                <span className="font-mono text-[11px] font-bold text-amber-400">
                  {era.year}
                </span>
                <span className="text-[10px] text-stone-400 font-medium px-1.5 py-0.5 rounded bg-stone-950 border border-stone-800">
                  {era.periodTag}
                </span>
              </div>

              <h3
                className={`font-serif text-sm font-bold truncate ${
                  isSelected ? 'text-amber-200' : 'text-stone-200'
                }`}
              >
                {era.name}
              </h3>

              <div className="flex items-center gap-1 text-[11px] text-stone-400 mt-1 truncate">
                <MapPin className="w-3 h-3 shrink-0 text-stone-500" />
                <span className="truncate">{era.region.split('&')[0]}</span>
              </div>

              {isSelected && (
                <div className="mt-2.5 pt-2 border-t border-stone-800 flex items-center justify-between text-[11px]">
                  <span className="text-amber-400/90 font-medium">Synchronized</span>
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Role Selector for Current Era */}
      <div className="p-3 bg-stone-900/90 border border-stone-800 rounded-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-serif font-semibold text-stone-200">
            Historical Identity in {selectedEra.year}:
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {selectedEra.roles.map((role) => {
            const isRoleActive = role === selectedRole;
            return (
              <button
                key={role}
                type="button"
                onClick={() => {
                  soundFX.playGearClick();
                  onSelectRole(role);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  isRoleActive
                    ? 'bg-amber-500 text-stone-950 font-semibold shadow-sm'
                    : 'bg-stone-950 hover:bg-stone-800 text-stone-300 border border-stone-800'
                }`}
              >
                {role}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
