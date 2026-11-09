import React, { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCw, Upload, Sparkles, X, Check, AlertCircle } from 'lucide-react';
import { soundFX } from '../utils/audioEffects';
import { SAMPLE_PORTRAITS } from '../data/historicalEras';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPhotoCaptured: (imageDataUrl: string) => void;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onPhotoCaptured,
}) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      setCapturedPreview(null);
      setCountdown(null);
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.warn('Camera access issue:', err);
      setCameraError(
        'Camera access not available or permission was denied. You can still upload a photo or choose a sample portrait below!'
      );
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const flipCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  // Start 3-second booth countdown
  const triggerCountdown = () => {
    if (countdown !== null) return;
    setCountdown(3);
    soundFX.playCountdownBeep(false);

    let count = 3;
    const timer = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdown(count);
        soundFX.playCountdownBeep(false);
      } else {
        clearInterval(timer);
        setCountdown(null);
        takeSnapshot();
      }
    }, 1000);
  };

  const takeSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 800;
    canvas.height = video.videoHeight || 600;
    const ctx = canvas.getContext('2d')!;

    // If front camera, mirror for intuitive photo
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

    // Audio & Flash
    soundFX.playShutter();
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 500);

    setCapturedPreview(dataUrl);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        soundFX.playShutter();
        setCapturedPreview(result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Draw procedural sample portraits on canvas to generate clean sample base64 data
  const handleSampleSelect = (sample: typeof SAMPLE_PORTRAITS[0]) => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 600;
    const ctx = canvas.getContext('2d')!;

    // Background gradient
    const grad = ctx.createRadialGradient(300, 300, 50, 300, 300, 350);
    grad.addColorStop(0, '#334155');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 600, 600);

    // Face base oval
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.ellipse(300, 290, 130, 160, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = sample.color;
    ctx.beginPath();
    ctx.arc(300, 240, 140, Math.PI, 0);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(250, 275, 12, 0, Math.PI * 2);
    ctx.arc(350, 275, 12, 0, Math.PI * 2);
    ctx.fill();

    // Smile
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(300, 320, 50, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    soundFX.playGearClick();
    setCapturedPreview(dataUrl);
  };

  const confirmPhoto = () => {
    if (capturedPreview) {
      onPhotoCaptured(capturedPreview);
      onClose();
    }
  };

  const retakePhoto = () => {
    setCapturedPreview(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="relative w-full max-w-2xl bg-stone-900 border border-amber-600/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800 bg-stone-950/80">
          <div className="flex items-center gap-3">
            <span className="text-xl">📸</span>
            <div>
              <h2 className="font-serif text-lg font-bold text-amber-300">
                Temporal Photo Capture
              </h2>
              <p className="text-xs text-stone-400">
                Position your face within the guide for optimal time-warp alignment
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport Area */}
        <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[380px]">
          {/* Flash animation layer */}
          {isFlashing && (
            <div className="absolute inset-0 bg-white z-40 animate-flash pointer-events-none" />
          )}

          {/* Countdown overlay */}
          {countdown !== null && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40">
              <span className="text-8xl font-serif font-black text-amber-400 animate-ping">
                {countdown}
              </span>
            </div>
          )}

          {/* Live Video / Captured Review */}
          {!capturedPreview ? (
            <>
              {cameraError ? (
                <div className="p-8 text-center max-w-md space-y-4">
                  <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <p className="text-sm text-stone-300">{cameraError}</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-stone-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors"
                  >
                    <Upload className="w-4 h-4" /> Upload a Portrait Photo
                  </button>
                </div>
              ) : (
                <div className="relative w-full h-full flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover max-h-[420px] ${
                      facingMode === 'user' ? '-scale-x-100' : ''
                    }`}
                  />

                  {/* Face Alignment Oval Target Overlay */}
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                    <div className="w-52 h-72 border-2 border-dashed border-amber-400/70 rounded-[50%] shadow-[0_0_30px_rgba(245,158,11,0.25)] flex items-center justify-center">
                      <div className="w-4 h-4 border-t-2 border-l-2 border-amber-400/90 -mt-16 -ml-16" />
                      <div className="w-4 h-4 border-t-2 border-r-2 border-amber-400/90 -mt-16 ml-16" />
                      <div className="w-4 h-4 border-b-2 border-l-2 border-amber-400/90 mt-16 -ml-16" />
                      <div className="w-4 h-4 border-b-2 border-r-2 border-amber-400/90 mt-16 ml-16" />
                    </div>
                    <span className="mt-3 text-[11px] font-medium tracking-wide text-amber-300/80 bg-stone-950/80 px-3 py-1 rounded-full border border-amber-500/30">
                      Center eyes & smile in oval
                    </span>
                  </div>

                  {/* Camera Flip Button */}
                  <button
                    onClick={flipCamera}
                    className="absolute top-4 right-4 p-2.5 rounded-full bg-stone-950/70 border border-stone-700 text-stone-300 hover:text-white hover:bg-stone-800 transition-colors"
                    title="Flip camera"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="relative w-full h-full flex items-center justify-center p-4">
              <img
                src={capturedPreview}
                alt="Captured Snapshot"
                className="max-h-[380px] rounded-xl object-contain border border-amber-500/40 shadow-xl"
              />
            </div>
          )}
        </div>

        {/* Controls Footer */}
        <div className="p-4 border-t border-stone-800 bg-stone-950/90 flex flex-col gap-3">
          {!capturedPreview ? (
            <div className="flex items-center justify-between gap-4">
              {/* File upload hidden input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-stone-300 hover:text-white bg-stone-800/80 hover:bg-stone-800 border border-stone-700 rounded-lg transition-colors"
              >
                <Upload className="w-4 h-4 text-amber-400" />
                Upload Photo
              </button>

              <button
                type="button"
                onClick={triggerCountdown}
                disabled={cameraError !== null}
                className={`flex items-center gap-2 px-8 py-3 rounded-xl font-serif font-bold text-sm tracking-wide transition-all shadow-lg ${
                  cameraError
                    ? 'bg-stone-800 text-stone-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 shadow-amber-500/20 hover:scale-105 active:scale-95'
                }`}
              >
                <Camera className="w-4 h-4" />
                Capture (3s Timer)
              </button>

              <div className="text-right">
                <span className="text-[11px] text-stone-400 block">or instant</span>
                <button
                  type="button"
                  onClick={takeSnapshot}
                  disabled={cameraError !== null}
                  className="text-xs text-amber-400 hover:underline disabled:opacity-40"
                >
                  Snap Now
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={retakePhoto}
                className="px-4 py-2.5 text-xs font-semibold text-stone-300 hover:text-white bg-stone-800 rounded-lg border border-stone-700 transition-colors"
              >
                Retake
              </button>
              <button
                type="button"
                onClick={confirmPhoto}
                className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold font-serif text-stone-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-md transition-all active:scale-95"
              >
                <Check className="w-4 h-4" />
                Use This Portrait
              </button>
            </div>
          )}

          {/* Sample quick test portraits */}
          <div className="pt-2 border-t border-stone-800/70 flex items-center justify-between text-xs">
            <span className="text-stone-400 text-[11px] flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Quick demo faces:
            </span>
            <div className="flex items-center gap-2">
              {SAMPLE_PORTRAITS.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => handleSampleSelect(sample)}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-300 transition-colors"
                >
                  <span>{sample.avatarSvg}</span>
                  <span>{sample.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
