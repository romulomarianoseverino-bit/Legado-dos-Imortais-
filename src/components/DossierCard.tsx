import React, { useState } from 'react';
import { TimeTravelDossier } from '../types/timeTravel';
import { FileText, Award, Send, Radio, Compass, Sparkles } from 'lucide-react';
import { soundFX } from '../utils/audioEffects';

interface DossierCardProps {
  dossier: TimeTravelDossier | null;
  eraName: string;
  eraYear: string;
  role: string;
  isLoading?: boolean;
}

export const DossierCard: React.FC<DossierCardProps> = ({
  dossier,
  eraName,
  eraYear,
  role,
  isLoading = false,
}) => {
  const [dispatchText, setDispatchText] = useState<string | null>(null);
  const [isDispatchLoading, setIsDispatchLoading] = useState(false);

  const fetchDispatch = async () => {
    setIsDispatchLoading(true);
    soundFX.playGearClick();
    try {
      const res = await fetch('/api/time-warp/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eraName,
          eraYear,
          role,
          travelerName: dossier?.historicalName,
        }),
      });
      const data = await res.json();
      setDispatchText(data.dispatch);
    } catch {
      setDispatchText(
        `Field message from the High Continuum: You are well-positioned in ${eraYear}. Maintain discretion.`
      );
    } finally {
      setIsDispatchLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-stone-900 border border-amber-600/30 rounded-xl p-5 text-center space-y-3 animate-pulse">
        <div className="w-10 h-10 mx-auto rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400">
          <Radio className="w-5 h-5 animate-spin" />
        </div>
        <h4 className="font-serif text-sm font-bold text-amber-300">
          Decrypting Temporal Dossier...
        </h4>
        <p className="text-xs text-stone-400">
          Accessing historical birth records and guild registries in {eraYear}
        </p>
      </div>
    );
  }

  if (!dossier) return null;

  return (
    <div className="bg-gradient-to-br from-stone-900 via-stone-950 to-stone-900 border border-amber-600/40 rounded-xl p-5 shadow-xl relative overflow-hidden">
      {/* Decorative Wax Seal */}
      <div className="absolute top-4 right-4 w-12 h-12 rounded-full bg-gradient-to-br from-red-700 to-amber-900 border-2 border-amber-400/80 shadow-md flex items-center justify-center rotate-12 pointer-events-none">
        <Award className="w-6 h-6 text-amber-200" />
      </div>

      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4 text-amber-400" />
        <span className="text-[10px] font-mono tracking-widest uppercase text-amber-400/80">
          OFFICIAL TEMPORAL ARCHIVE RECORD
        </span>
      </div>

      <div className="space-y-3 text-xs">
        <div>
          <span className="text-stone-400 block text-[11px]">Historical Identity:</span>
          <h3 className="font-serif text-lg font-bold text-amber-200">
            {dossier.historicalName}
          </h3>
          <p className="text-stone-300 font-medium">
            {dossier.stationTitle} · {dossier.location} ({dossier.eraYear})
          </p>
        </div>

        <div className="p-3 bg-stone-950/80 border border-stone-800 rounded-lg space-y-1.5">
          <p className="text-stone-300 leading-relaxed italic">
            "{dossier.biography}"
          </p>
          <div className="pt-1.5 border-t border-stone-800/80 flex items-center justify-between text-[11px] text-stone-400">
            <span className="flex items-center gap-1">
              <Compass className="w-3 h-3 text-amber-400" />
              Artifact: {dossier.historicalArtifact}
            </span>
            <span className="font-mono text-emerald-400 font-semibold">
              {dossier.temporalStability}
            </span>
          </div>
        </div>

        {/* Telegram dispatch message */}
        {dispatchText && (
          <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-lg text-amber-200 text-xs font-serif leading-relaxed">
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-amber-400 mb-1">
              <Radio className="w-3 h-3 animate-pulse" />
              <span>INTERCEPTED TELEGRAM / FIELD DISPATCH:</span>
            </div>
            {dispatchText}
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={fetchDispatch}
            disabled={isDispatchLoading}
            className="flex items-center gap-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            {isDispatchLoading ? 'Decoding Message...' : 'Request Era Dispatch Telegram'}
          </button>
          <span className="text-[10px] text-stone-500 font-mono">
            ID: CHR-{Math.floor(1000 + Math.random() * 9000)}
          </span>
        </div>
      </div>
    </div>
  );
};
