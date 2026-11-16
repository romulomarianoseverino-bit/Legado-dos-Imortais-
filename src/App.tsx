import React, { useState, useEffect, useRef } from 'react';
import { Camera, Sparkles, Download, Layers, History, Volume2, VolumeX, Wand2, RefreshCw, Bookmark, Share2, Compass, AlertCircle } from 'lucide-react';
import { HISTORICAL_ERAS, SAMPLE_PORTRAITS } from './data/historicalEras';
import { HistoricalEra, FaceAdjustments, TimeTravelDossier, SavedExcursion } from './types/timeTravel';
import { compositeHistoricalScene, generatePhotoBoothStrip } from './utils/canvasCompositor';
import { soundFX } from './utils/audioEffects';
import { CameraCaptureModal } from './components/CameraCaptureModal';
import { EraSelector } from './components/EraSelector';
import { StudioControls } from './components/StudioControls';
import { DossierCard } from './components/DossierCard';
import { PhotoBoothStripModal } from './components/PhotoBoothStripModal';
import { SavedGalleryModal } from './components/SavedGalleryModal';

export default function App() {
  // Core State
  const [userImageSrc, setUserImageSrc] = useState<string | null>(null);
  const [selectedEra, setSelectedEra] = useState<HistoricalEra>(HISTORICAL_ERAS[0]);
  const [selectedRole, setSelectedRole] = useState<string>(HISTORICAL_ERAS[0].defaultRole);
  const [compositeUrl, setCompositeUrl] = useState<string | null>(null);
  const [aiGeneratedUrl, setAiGeneratedUrl] = useState<string | null>(null);
  const [dossier, setDossier] = useState<TimeTravelDossier | null>(null);

  // Fine-tuning adjustments
  const [adjustments, setAdjustments] = useState<FaceAdjustments>({
    scale: 1.0,
    offsetX: 0,
    offsetY: 0,
    rotation: 0,
    brightness: 100,
    contrast: 105,
    warmth: HISTORICAL_ERAS[0].filterProfile.warmth,
    featherRadius: 22,
    selectedAccessoryId: HISTORICAL_ERAS[0].accessoryOptions[0]?.id || null,
    frameStyle: 'ornate-gold',
  });

  // UI Modals & Loading
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isStripModalOpen, setIsStripModalOpen] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [stripImageUrl, setStripImageUrl] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiErrorNotice, setAiErrorNotice] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState<'composite' | 'ai'>('composite');

  // Saved excursions list in localStorage
  const [savedExcursions, setSavedExcursions] = useState<SavedExcursion[]>(() => {
    try {
      const stored = localStorage.getItem('chronos_saved_excursions');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Hidden image object for canvas rendering
  const userImgElementRef = useRef<HTMLImageElement | null>(null);

  // Initialize with a default sample portrait on mount
  useEffect(() => {
    // Generate clean initial sample face
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 600;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createRadialGradient(300, 300, 50, 300, 300, 350);
    grad.addColorStop(0, '#334155');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 600, 600);

    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.ellipse(300, 290, 130, 160, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(300, 240, 140, Math.PI, 0);
    ctx.fill();

    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(250, 275, 12, 0, Math.PI * 2);
    ctx.arc(350, 275, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(300, 320, 50, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    const initialDataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setUserImageSrc(initialDataUrl);
  }, []);

  // Sync warmth adjustment default when era changes
  useEffect(() => {
    setAdjustments((prev) => ({
      ...prev,
      warmth: selectedEra.filterProfile.warmth,
      selectedAccessoryId: selectedEra.accessoryOptions[0]?.id || null,
    }));
  }, [selectedEra]);

  // Re-composite when image, era, role, or adjustments change
  useEffect(() => {
    if (!userImageSrc) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = userImageSrc;
    img.onload = () => {
      userImgElementRef.current = img;
      renderComposite();
    };
  }, [userImageSrc, selectedEra, selectedRole, adjustments]);

  const renderComposite = () => {
    if (!userImgElementRef.current) return;
    try {
      const result = compositeHistoricalScene({
        userImage: userImgElementRef.current,
        era: selectedEra,
        role: selectedRole,
        adjustments: adjustments,
        outputWidth: 900,
        outputHeight: 1200,
      });
      setCompositeUrl(result);
    } catch (e) {
      console.error('Composite failed', e);
    }
  };

  // Handle Photo captured from webcam or file
  const handlePhotoCaptured = (imageDataUrl: string) => {
    setUserImageSrc(imageDataUrl);
    setAiGeneratedUrl(null);
    setActiveTab('composite');
    if (soundEnabled) soundFX.playTimeWarp();
  };

  // Trigger Gemini AI Deep Time Warp
  const handleAiTimeWarp = async () => {
    if (!userImageSrc) return;
    setIsAiLoading(true);
    setAiErrorNotice(null);
    if (soundEnabled) soundFX.playTimeWarp();

    try {
      const res = await fetch('/api/time-warp/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userImageBase64: userImageSrc,
          eraId: selectedEra.id,
          eraName: selectedEra.name,
          eraYear: selectedEra.year,
          characterRole: selectedRole,
          artStyle: `${selectedEra.name} fine period portraiture`,
        }),
      });

      const data = await res.json();
      if (data.dossier) {
        setDossier(data.dossier);
      }

      if (data.generatedImageUrl) {
        setAiGeneratedUrl(data.generatedImageUrl);
        setActiveTab('ai');
      } else {
        // If image model is unavailable (e.g. requires paid key), notify and keep canvas composite active with generated dossier
        setAiErrorNotice(
          'Gemini historical persona dossier generated! High-fidelity composite ready in Studio mode.'
        );
      }
    } catch (err: any) {
      console.warn('AI Time warp error:', err);
      setAiErrorNotice(
        'Temporal relay timeout. Your studio canvas portrait remains fully available!'
      );
    } finally {
      setIsAiLoading(false);
    }
  };

  // Download high-res portrait
  const handleDownloadPortrait = () => {
    const targetUrl = activeTab === 'ai' && aiGeneratedUrl ? aiGeneratedUrl : compositeUrl;
    if (!targetUrl) return;
    if (soundEnabled) soundFX.playGearClick();

    const link = document.createElement('a');
    link.href = targetUrl;
    link.download = `Chronos_${selectedEra.id}_${selectedEra.year.replace(/\s+/g, '_')}.jpg`;
    link.click();
  };

  // Generate 4-Photo Booth Strip
  const handleGenerateStrip = () => {
    if (!userImgElementRef.current) return;
    if (soundEnabled) soundFX.playShutter();

    // Generate 4 distinct era composite frames using current face
    const frameEras = [
      selectedEra,
      HISTORICAL_ERAS[(HISTORICAL_ERAS.indexOf(selectedEra) + 2) % HISTORICAL_ERAS.length],
      HISTORICAL_ERAS[(HISTORICAL_ERAS.indexOf(selectedEra) + 4) % HISTORICAL_ERAS.length],
      HISTORICAL_ERAS[(HISTORICAL_ERAS.indexOf(selectedEra) + 6) % HISTORICAL_ERAS.length],
    ];

    const frames = frameEras.map((era) =>
      compositeHistoricalScene({
        userImage: userImgElementRef.current!,
        era: era,
        role: era.defaultRole,
        adjustments: { ...adjustments, frameStyle: 'none' },
        outputWidth: 600,
        outputHeight: 750,
      })
    );

    const strip = generatePhotoBoothStrip(frames, `${selectedEra.year} - PRESENT`);
    setStripImageUrl(strip);
    setIsStripModalOpen(true);
  };

  // Save current portrait to local gallery
  const handleSaveToGallery = () => {
    const targetUrl = activeTab === 'ai' && aiGeneratedUrl ? aiGeneratedUrl : compositeUrl;
    if (!targetUrl) return;
    if (soundEnabled) soundFX.playGearClick();

    const newExcursion: SavedExcursion = {
      id: `excursion_${Date.now()}`,
      timestamp: Date.now(),
      eraId: selectedEra.id,
      eraName: selectedEra.name,
      eraYear: selectedEra.year,
      role: selectedRole,
      imageDataUrl: targetUrl,
      dossier: dossier || undefined,
    };

    const updated = [newExcursion, ...savedExcursions];
    setSavedExcursions(updated);
    try {
      localStorage.setItem('chronos_saved_excursions', JSON.stringify(updated));
    } catch {}
  };

  const handleDeleteExcursion = (id: string) => {
    const updated = savedExcursions.filter((item) => item.id !== id);
    setSavedExcursions(updated);
    try {
      localStorage.setItem('chronos_saved_excursions', JSON.stringify(updated));
    } catch {}
  };

  const handleSelectSavedExcursion = (item: SavedExcursion) => {
    const matchedEra = HISTORICAL_ERAS.find((e) => e.id === item.eraId);
    if (matchedEra) {
      setSelectedEra(matchedEra);
      setSelectedRole(item.role);
    }
    setCompositeUrl(item.imageDataUrl);
    if (item.dossier) setDossier(item.dossier);
  };

  const displayedImage = activeTab === 'ai' && aiGeneratedUrl ? aiGeneratedUrl : compositeUrl;

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top Bar Contract: 3 zones (Brand wordmark, nav links, primary action) */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-stone-800/80 bg-stone-950/90 backdrop-blur-md sticky top-0 z-40">
        {/* Zone 1: Brand title wordmark */}
        <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-stone-950 font-bold shadow-md shadow-amber-500/20">
            ⏳
          </div>
          <span className="font-serif text-lg font-bold tracking-tight text-amber-200">
            Chronos Time-Travel Booth
          </span>
        </div>

        {/* Zone 2: Single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-stone-400">
          <button
            type="button"
            onClick={() => setIsCameraOpen(true)}
            className="hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Take Portrait
          </button>
          <a
            href="#eras"
            className="hover:text-amber-300 transition-colors whitespace-nowrap shrink-0"
          >
            Historical Eras
          </a>
          <button
            type="button"
            onClick={handleGenerateStrip}
            className="hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            4-Photo Strip
          </button>
          <button
            type="button"
            onClick={() => setIsGalleryOpen(true)}
            className="hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
          >
            <span>Passport Gallery</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-stone-800 text-amber-400">
              {savedExcursions.length}
            </span>
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setSoundEnabled((prev) => !prev)}
            className="p-2 rounded-lg bg-stone-900 border border-stone-800 text-stone-400 hover:text-white transition-colors"
            title={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => setIsCameraOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-serif font-bold text-stone-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-lg shadow-md transition-all active:scale-95 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            Step Into Booth
          </button>
        </div>
      </header>

      {/* Main Studio Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Notice alert banner if AI status updated */}
        {aiErrorNotice && (
          <div className="bg-amber-950/50 border border-amber-600/40 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{aiErrorNotice}</span>
            </div>
            <button
              onClick={() => setAiErrorNotice(null)}
              className="text-stone-400 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* 2-Column Responsive Layout: Stage Left (Portrait Viewer) / Stage Right (Era & Tuning) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Portrait Viewport & Actions (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Viewport Frame */}
            <div className="relative aspect-[3/4] w-full max-w-md mx-auto bg-stone-900 border-2 border-amber-600/30 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center">
              {displayedImage ? (
                <img
                  src={displayedImage}
                  alt={`${selectedEra.name} Portrait`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center p-8 space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 animate-spin">
                    <Compass className="w-6 h-6" />
                  </div>
                  <p className="text-xs text-stone-400">Rendering temporal portrait...</p>
                </div>
              )}

              {/* Loading Vortex Overlay */}
              {isAiLoading && (
                <div className="absolute inset-0 bg-stone-950/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <div className="w-16 h-16 rounded-full border-4 border-amber-400/20 border-t-amber-400 animate-spin flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-amber-400 animate-pulse" />
                  </div>
                  <h4 className="font-serif text-sm font-bold text-amber-300">
                    Traversing the Temporal Rift...
                  </h4>
                  <p className="text-xs text-stone-400 max-w-xs">
                    Synthesizing period pigments, historical garments, and facial coordinates for{' '}
                    {selectedEra.year}
                  </p>
                </div>
              )}

              {/* Viewport Mode Switch (Studio Canvas vs AI Deep Warp) */}
              {aiGeneratedUrl && (
                <div className="absolute top-3 left-3 z-20 flex items-center gap-1 p-1 bg-stone-950/80 backdrop-blur-md rounded-lg border border-stone-800">
                  <button
                    type="button"
                    onClick={() => setActiveTab('composite')}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                      activeTab === 'composite'
                        ? 'bg-amber-400 text-stone-950 font-bold'
                        : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    Studio Fit
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('ai')}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                      activeTab === 'ai'
                        ? 'bg-amber-400 text-stone-950 font-bold'
                        : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    AI Portrait
                  </button>
                </div>
              )}

              {/* Era Watermark stamp */}
              <div className="absolute bottom-3 left-3 z-10 px-2.5 py-1 rounded-md bg-stone-950/70 backdrop-blur-sm border border-stone-800 text-[10px] font-mono text-amber-300">
                {selectedEra.year} · {selectedRole}
              </div>
            </div>

            {/* Quick Primary Actions Toolbar */}
            <div className="w-full max-w-md mx-auto grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={handleDownloadPortrait}
                disabled={!displayedImage}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-serif font-bold text-stone-950 bg-amber-400 hover:bg-amber-300 transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Download Portrait
              </button>

              <button
                type="button"
                onClick={handleGenerateStrip}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-medium text-stone-200 bg-stone-900 hover:bg-stone-800 border border-stone-700 transition-all active:scale-95 cursor-pointer"
              >
                <Layers className="w-4 h-4 text-amber-400" />
                4-Photo Strip
              </button>

              <button
                type="button"
                onClick={handleSaveToGallery}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-stone-300 bg-stone-950 hover:bg-stone-900 border border-stone-800 transition-colors cursor-pointer"
              >
                <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                Save to Passport
              </button>

              <button
                type="button"
                onClick={() => setIsCameraOpen(true)}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-stone-300 bg-stone-950 hover:bg-stone-900 border border-stone-800 transition-colors cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5 text-amber-400" />
                Retake Photo
              </button>
            </div>

            {/* AI Deep Time Warp Button */}
            <div className="w-full max-w-md mx-auto p-4 rounded-xl bg-gradient-to-br from-amber-950/40 via-stone-900 to-purple-950/40 border border-amber-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-serif font-bold text-amber-300 flex items-center gap-1.5">
                  <Wand2 className="w-4 h-4 text-amber-400" />
                  Gemini Temporal Synthesis
                </span>
                <span className="text-[10px] font-mono text-purple-300 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-600/40">
                  AI-Powered
                </span>
              </div>
              <p className="text-[11px] text-stone-400">
                Generate an archival passport dossier and deep AI historical transformation for{' '}
                {selectedEra.year}.
              </p>
              <button
                type="button"
                onClick={handleAiTimeWarp}
                disabled={isAiLoading}
                className="w-full py-2.5 px-4 rounded-lg font-serif font-bold text-xs tracking-wide text-stone-950 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-400 hover:brightness-110 shadow-lg shadow-amber-500/10 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                {isAiLoading ? 'Synthesizing Coordinates...' : 'Activate AI Deep Time-Warp'}
              </button>
            </div>
          </div>

          {/* Right Column: Era Picker, Studio Fitting, and Historical Dossier (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Era Selection Carousel */}
            <div id="eras">
              <EraSelector
                selectedEra={selectedEra}
                onSelectEra={setSelectedEra}
                selectedRole={selectedRole}
                onSelectRole={setSelectedRole}
              />
            </div>

            {/* Studio Fitting & Lighting Sliders */}
            <StudioControls
              adjustments={adjustments}
              onChange={setAdjustments}
              selectedEra={selectedEra}
            />

            {/* Historical Passport Dossier */}
            <DossierCard
              dossier={dossier}
              eraName={selectedEra.name}
              eraYear={selectedEra.year}
              role={selectedRole}
              isLoading={isAiLoading}
            />

            {/* Historical Era Lore Card */}
            <div className="p-4 bg-stone-900/60 border border-stone-800 rounded-xl space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-stone-400">
                ERA CHRONICLES · {selectedEra.region}
              </span>
              <p className="text-xs text-stone-300 leading-relaxed font-serif italic">
                {selectedEra.sampleQuote}
              </p>
              <p className="text-xs text-stone-400 leading-relaxed">{selectedEra.fullDesc}</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-stone-800/80 bg-stone-950 py-6 px-6 text-center text-xs text-stone-400 space-y-1">
        <p className="font-serif text-stone-400">
          Chronos Time-Travel Photo Booth · Continuous Temporal Engine
        </p>
        <p className="text-[11px] text-stone-400">
          Portraits rendered securely via client canvas and server-side Gemini intelligence.
        </p>
      </footer>

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onPhotoCaptured={handlePhotoCaptured}
      />

      {/* 4-Photo Booth Strip Modal */}
      <PhotoBoothStripModal
        isOpen={isStripModalOpen}
        onClose={() => setIsStripModalOpen(false)}
        stripImageUrl={stripImageUrl}
        onDownload={() => {
          if (!stripImageUrl) return;
          const link = document.createElement('a');
          link.href = stripImageUrl;
          link.download = `Chronos_Photobooth_Strip_${Date.now()}.jpg`;
          link.click();
        }}
      />

      {/* Saved Gallery Modal */}
      <SavedGalleryModal
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        savedExcursions={savedExcursions}
        onSelectExcursion={handleSelectSavedExcursion}
        onDeleteExcursion={handleDeleteExcursion}
      />
    </div>
  );
}
