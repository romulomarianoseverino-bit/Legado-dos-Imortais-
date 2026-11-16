import { HistoricalEra, FaceAdjustments } from '../types/timeTravel';

interface CompositeOptions {
  userImage: HTMLImageElement | HTMLCanvasElement;
  era: HistoricalEra;
  role: string;
  adjustments: FaceAdjustments;
  outputWidth?: number;
  outputHeight?: number;
}

// Master Canvas Compositor for Time-Travel Portraits
export function compositeHistoricalScene({
  userImage,
  era,
  role,
  adjustments,
  outputWidth = 900,
  outputHeight = 1200,
}: CompositeOptions): string {
  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext('2d')!;

  const W = outputWidth;
  const H = outputHeight;

  // 1. Draw Historical Background Scene
  drawEraBackground(ctx, era, W, H);

  // 2. Draw Historical Costume Base (Shoulders & Torso)
  drawEraCostume(ctx, era, role, W, H);

  // 3. Composite User Face into Historical Aperture
  drawBlendedUserFace(ctx, userImage, adjustments, W, H);

  // 4. Draw Foreground Garment Collar / Armor Neckpiece (overlaps neck naturally)
  drawEraCollar(ctx, era, W, H);

  // 5. Draw Selected Historical Accessories (Hats, Crowns, Goggles, Helmets)
  drawEraAccessories(ctx, era, adjustments, W, H);

  // 6. Apply Historical Texture, Grain, Vignette & Lighting Filter
  applyEraAtmosphere(ctx, era, adjustments, W, H);

  // 7. Render Selected Frame (Ornate Gold, Wanted Poster, Vintage Polaroid, etc.)
  drawSelectedFrame(ctx, era, role, adjustments.frameStyle, W, H);

  return canvas.toDataURL('image/jpeg', 0.94);
}

// Background environment generator
function drawEraBackground(
  ctx: CanvasRenderingContext2D,
  era: HistoricalEra,
  W: number,
  H: number
) {
  ctx.save();

  switch (era.id) {
    case 'ancient-egypt': {
      // Golden twilight sky over Nile & Pyramids
      const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.7);
      skyGrad.addColorStop(0, '#1c1917');
      skyGrad.addColorStop(0.35, '#78350f');
      skyGrad.addColorStop(0.7, '#d97706');
      skyGrad.addColorStop(1, '#fde68a');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, H);

      // Distant Great Pyramids
      ctx.fillStyle = '#451a03';
      ctx.beginPath();
      ctx.moveTo(W * 0.05, H * 0.65);
      ctx.lineTo(W * 0.28, H * 0.42);
      ctx.lineTo(W * 0.52, H * 0.65);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.moveTo(W * 0.45, H * 0.65);
      ctx.lineTo(W * 0.68, H * 0.45);
      ctx.lineTo(W * 0.92, H * 0.65);
      ctx.closePath();
      ctx.fill();

      // Temple Sandstone Pillars
      ctx.fillStyle = '#292524';
      ctx.fillRect(0, 0, W * 0.16, H);
      ctx.fillRect(W * 0.84, 0, W * 0.16, H);

      // Hieroglyphic golden relief markings on pillars
      ctx.fillStyle = 'rgba(245, 158, 11, 0.4)';
      for (let y = 80; y < H * 0.8; y += 70) {
        ctx.fillRect(W * 0.04, y, W * 0.08, 12);
        ctx.fillRect(W * 0.88, y, W * 0.08, 12);
      }

      // Torches glow
      const torchGlow = ctx.createRadialGradient(W * 0.5, H * 0.5, 50, W * 0.5, H * 0.5, W * 0.7);
      torchGlow.addColorStop(0, 'rgba(251, 191, 36, 0.25)');
      torchGlow.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
      ctx.fillStyle = torchGlow;
      ctx.fillRect(0, 0, W, H);
      break;
    }

    case 'ancient-rome': {
      // Roman Forum blue sky with marble colonnade
      const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.6);
      skyGrad.addColorStop(0, '#0369a1');
      skyGrad.addColorStop(0.6, '#38bdf8');
      skyGrad.addColorStop(1, '#bae6fd');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, H);

      // Distant Roman Amphitheater arches
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(W * 0.2, H * 0.35, W * 0.6, H * 0.25);
      ctx.fillStyle = '#0f172a';
      for (let x = W * 0.25; x < W * 0.75; x += W * 0.12) {
        ctx.beginPath();
        ctx.arc(x + 25, H * 0.45, 20, Math.PI, 0);
        ctx.lineTo(x + 45, H * 0.6);
        ctx.lineTo(x + 5, H * 0.6);
        ctx.closePath();
        ctx.fill();
      }

      // Foreground Corinthian fluted marble columns
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, W * 0.22, H);
      ctx.fillRect(W * 0.78, 0, W * 0.22, H);

      // Fluting lines
      ctx.fillStyle = '#cbd5e1';
      for (let i = 1; i <= 3; i++) {
        ctx.fillRect(W * 0.05 * i, 0, 4, H);
        ctx.fillRect(W * 0.78 + W * 0.05 * i, 0, 4, H);
      }
      break;
    }

    case 'medieval-knights': {
      // Gothic Castle stone hall with torch fire
      const wallGrad = ctx.createRadialGradient(W * 0.5, H * 0.4, 60, W * 0.5, H * 0.4, W * 0.8);
      wallGrad.addColorStop(0, '#44403c');
      wallGrad.addColorStop(0.6, '#1c1917');
      wallGrad.addColorStop(1, '#0c0a09');
      ctx.fillStyle = wallGrad;
      ctx.fillRect(0, 0, W, H);

      // Pointed Gothic Arch in background
      ctx.strokeStyle = '#292524';
      ctx.lineWidth = 18;
      ctx.beginPath();
      ctx.moveTo(W * 0.2, H * 0.75);
      ctx.lineTo(W * 0.2, H * 0.35);
      ctx.arcTo(W * 0.5, H * 0.05, W * 0.8, H * 0.35, 220);
      ctx.lineTo(W * 0.8, H * 0.75);
      ctx.stroke();

      // Royal Tapestry heraldry banner
      ctx.fillStyle = '#7f1d1d';
      ctx.fillRect(W * 0.1, H * 0.1, W * 0.15, H * 0.4);
      ctx.fillStyle = '#eab308';
      ctx.beginPath();
      ctx.arc(W * 0.175, H * 0.25, 25, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'renaissance-florence': {
      // Florentine Arched Loggia overlooking Tuscan hills
      const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.5);
      skyGrad.addColorStop(0, '#1e293b');
      skyGrad.addColorStop(0.5, '#d97706');
      skyGrad.addColorStop(1, '#fed7aa');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, H);

      // Rolling cypress Tuscan hills
      ctx.fillStyle = '#365314';
      ctx.beginPath();
      ctx.arc(W * 0.3, H * 0.65, W * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(W * 0.7, H * 0.68, W * 0.45, 0, Math.PI * 2);
      ctx.fill();

      // Renaissance Stone Arch frame
      ctx.fillStyle = '#451a03';
      ctx.beginPath();
      ctx.arc(W * 0.5, H * 0.3, W * 0.45, Math.PI, 0);
      ctx.lineTo(W, 0);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'pirate-golden-age': {
      // Tropical Caribbean stormy sunset & ocean swells
      const seaGrad = ctx.createLinearGradient(0, 0, 0, H);
      seaGrad.addColorStop(0, '#0f172a');
      seaGrad.addColorStop(0.3, '#134e4a');
      seaGrad.addColorStop(0.55, '#f97316');
      seaGrad.addColorStop(0.7, '#042f2e');
      seaGrad.addColorStop(1, '#021817');
      ctx.fillStyle = seaGrad;
      ctx.fillRect(0, 0, W, H);

      // Ship Rigging and Masts
      ctx.strokeStyle = '#292524';
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(W * 0.15, 0);
      ctx.lineTo(W * 0.15, H);
      ctx.moveTo(W * 0.85, 0);
      ctx.lineTo(W * 0.85, H);
      ctx.stroke();

      // Rope shrouds
      ctx.strokeStyle = 'rgba(217, 119, 6, 0.4)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 7; i++) {
        ctx.beginPath();
        ctx.moveTo(W * 0.15, H * 0.1 * i);
        ctx.lineTo(W * 0.02, H * 0.7);
        ctx.stroke();
      }
      break;
    }

    case 'wild-west': {
      // Monument valley orange mesa sunset
      const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.6);
      skyGrad.addColorStop(0, '#451a03');
      skyGrad.addColorStop(0.4, '#c2410c');
      skyGrad.addColorStop(0.8, '#fbbf24');
      skyGrad.addColorStop(1, '#fde68a');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, H);

      // Distant Red Rock Mesas
      ctx.fillStyle = '#78350f';
      ctx.fillRect(W * 0.1, H * 0.42, W * 0.35, H * 0.2);
      ctx.fillRect(W * 0.65, H * 0.45, W * 0.3, H * 0.18);

      // Weathered Saloon Wooden Timber frame
      ctx.fillStyle = '#292524';
      ctx.fillRect(0, 0, W * 0.18, H);
      ctx.fillRect(W * 0.82, 0, W * 0.18, H);
      ctx.fillRect(0, 0, W, H * 0.12);
      break;
    }

    case 'victorian-steampunk': {
      // Brass airship bridge & Victorian London twilight
      const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
      skyGrad.addColorStop(0, '#1c1917');
      skyGrad.addColorStop(0.5, '#78350f');
      skyGrad.addColorStop(1, '#0c0a09');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, H);

      // Brass Clockwork Gears in background
      ctx.strokeStyle = 'rgba(202, 138, 4, 0.3)';
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.arc(W * 0.2, H * 0.3, 140, 0, Math.PI * 2);
      ctx.arc(W * 0.8, H * 0.35, 120, 0, Math.PI * 2);
      ctx.stroke();

      // Victorian arched observation window
      ctx.strokeStyle = '#ca8a04';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(W * 0.5, H * 0.35, W * 0.45, Math.PI, 0);
      ctx.stroke();
      break;
    }

    case 'roaring-twenties': {
      // Art Deco geometric fan arches & speakeasy velvet
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, W, H);

      // Art Deco Sunburst Rays
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.2)';
      ctx.lineWidth = 3;
      for (let angle = 0; angle <= Math.PI; angle += Math.PI / 16) {
        ctx.beginPath();
        ctx.moveTo(W * 0.5, H * 0.6);
        ctx.lineTo(W * 0.5 + Math.cos(angle) * W, H * 0.6 - Math.sin(angle) * H);
        ctx.stroke();
      }

      // Warm speakeasy table lamp glow
      const lampGlow = ctx.createRadialGradient(W * 0.5, H * 0.4, 20, W * 0.5, H * 0.4, W * 0.6);
      lampGlow.addColorStop(0, 'rgba(251, 191, 36, 0.35)');
      lampGlow.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
      ctx.fillStyle = lampGlow;
      ctx.fillRect(0, 0, W, H);
      break;
    }

    case 'apollo-moon-1969': {
      // Deep space black starfield, glowing blue Earth, grey moon surface
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, W, H);

      // Stars
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 90; i++) {
        const sx = ((i * 137) % W);
        const sy = ((i * 241) % (H * 0.65));
        const r = (i % 3 === 0) ? 2 : 1;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Beautiful glowing Blue Marble Earth
      const earthGrad = ctx.createRadialGradient(W * 0.25, H * 0.2, 10, W * 0.25, H * 0.2, 70);
      earthGrad.addColorStop(0, '#67e8f9');
      earthGrad.addColorStop(0.6, '#0284c7');
      earthGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = earthGrad;
      ctx.beginPath();
      ctx.arc(W * 0.25, H * 0.2, 50, 0, Math.PI * 2);
      ctx.fill();

      // Moon powdery grey surface horizon
      const moonGrad = ctx.createLinearGradient(0, H * 0.6, 0, H);
      moonGrad.addColorStop(0, '#334155');
      moonGrad.addColorStop(0.3, '#64748b');
      moonGrad.addColorStop(1, '#1e293b');
      ctx.fillStyle = moonGrad;
      ctx.beginPath();
      ctx.ellipse(W * 0.5, H * 0.75, W * 0.6, H * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'retro-synth-1984': {
      // 80s Wireframe Grid & Neon Sun
      const synthSky = ctx.createLinearGradient(0, 0, 0, H * 0.65);
      synthSky.addColorStop(0, '#2e1065');
      synthSky.addColorStop(0.5, '#701a75');
      synthSky.addColorStop(1, '#f43f5e');
      ctx.fillStyle = synthSky;
      ctx.fillRect(0, 0, W, H);

      // Glowing Neon Sun with horizontal slats
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(W * 0.5, H * 0.45, 140, 0, Math.PI * 2);
      ctx.fill();

      // Sun slats (synthwave cutouts)
      ctx.fillStyle = '#701a75';
      for (let y = H * 0.42; y < H * 0.58; y += 12) {
        ctx.fillRect(W * 0.3, y, W * 0.4, 5);
      }

      // Neon 3D wireframe ground
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, H * 0.6, W, H * 0.4);

      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2;
      // Perspective perspective lines
      for (let x = -W * 0.5; x <= W * 1.5; x += W * 0.15) {
        ctx.beginPath();
        ctx.moveTo(W * 0.5, H * 0.6);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      // Horizontal grid rungs
      for (let y = H * 0.62; y < H; y += (y - H * 0.58) * 0.6) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      break;
    }

    default: {
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(0, 0, W, H);
    }
  }

  ctx.restore();
}

// Period-accurate body & torso costume
function drawEraCostume(
  ctx: CanvasRenderingContext2D,
  era: HistoricalEra,
  role: string,
  W: number,
  H: number
) {
  ctx.save();
  const shoulderY = H * 0.62;

  switch (era.id) {
    case 'ancient-egypt': {
      // Linen pleated robe with royal sash
      ctx.fillStyle = '#fafaf9';
      ctx.beginPath();
      ctx.moveTo(W * 0.1, H);
      ctx.lineTo(W * 0.25, shoulderY);
      ctx.quadraticCurveTo(W * 0.5, shoulderY + 80, W * 0.75, shoulderY);
      ctx.lineTo(W * 0.9, H);
      ctx.closePath();
      ctx.fill();

      // Royal Gold & Lapis Lazuli Wesekh broad collar base
      const collarGrad = ctx.createRadialGradient(W * 0.5, shoulderY, 40, W * 0.5, shoulderY, 180);
      collarGrad.addColorStop(0, '#f59e0b');
      collarGrad.addColorStop(0.3, '#0284c7');
      collarGrad.addColorStop(0.6, '#b45309');
      collarGrad.addColorStop(1, '#0369a1');
      ctx.fillStyle = collarGrad;
      ctx.beginPath();
      ctx.arc(W * 0.5, shoulderY - 30, 200, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.fill();
      break;
    }

    case 'ancient-rome': {
      // Senator Toga with Imperial Purple Stripe
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(W * 0.05, H);
      ctx.lineTo(W * 0.22, shoulderY);
      ctx.quadraticCurveTo(W * 0.5, shoulderY + 60, W * 0.78, shoulderY);
      ctx.lineTo(W * 0.95, H);
      ctx.closePath();
      ctx.fill();

      // Tyrian Purple diagonal sash
      ctx.fillStyle = '#7f1d1d';
      ctx.beginPath();
      ctx.moveTo(W * 0.25, shoulderY);
      ctx.lineTo(W * 0.42, shoulderY);
      ctx.lineTo(W * 0.7, H);
      ctx.lineTo(W * 0.5, H);
      ctx.closePath();
      ctx.fill();

      // Gold fibula brooch
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(W * 0.3, shoulderY + 10, 16, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'medieval-knights': {
      // Burnished steel plate armor with brass trim
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.moveTo(W * 0.05, H);
      ctx.lineTo(W * 0.2, shoulderY);
      ctx.lineTo(W * 0.5, shoulderY + 40);
      ctx.lineTo(W * 0.8, shoulderY);
      ctx.lineTo(W * 0.95, H);
      ctx.closePath();
      ctx.fill();

      // Steel highlights
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.ellipse(W * 0.25, shoulderY + 50, 45, 90, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(W * 0.75, shoulderY + 50, 45, 90, 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Golden lion crest badge
      ctx.fillStyle = '#eab308';
      ctx.beginPath();
      ctx.arc(W * 0.5, shoulderY + 90, 24, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'renaissance-florence': {
      // Crimson velvet doublet with gold brocade
      ctx.fillStyle = '#7f1d1d';
      ctx.beginPath();
      ctx.moveTo(W * 0.08, H);
      ctx.lineTo(W * 0.22, shoulderY);
      ctx.quadraticCurveTo(W * 0.5, shoulderY + 70, W * 0.78, shoulderY);
      ctx.lineTo(W * 0.92, H);
      ctx.closePath();
      ctx.fill();

      // Gold floral brocade embroidery lines
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(W * 0.38, shoulderY + 40);
      ctx.lineTo(W * 0.38, H);
      ctx.moveTo(W * 0.62, shoulderY + 40);
      ctx.lineTo(W * 0.62, H);
      ctx.stroke();
      break;
    }

    case 'pirate-golden-age': {
      // Weathered leather frock coat, open collar, gold buttons
      ctx.fillStyle = '#1c1917';
      ctx.beginPath();
      ctx.moveTo(W * 0.05, H);
      ctx.lineTo(W * 0.2, shoulderY);
      ctx.lineTo(W * 0.45, shoulderY + 110);
      ctx.lineTo(W * 0.55, shoulderY + 110);
      ctx.lineTo(W * 0.8, shoulderY);
      ctx.lineTo(W * 0.95, H);
      ctx.closePath();
      ctx.fill();

      // Crimson silk buccaneer sash
      ctx.fillStyle = '#b91c1c';
      ctx.beginPath();
      ctx.moveTo(W * 0.25, shoulderY + 80);
      ctx.lineTo(W * 0.75, H);
      ctx.lineTo(W * 0.6, H);
      ctx.lineTo(W * 0.15, shoulderY + 120);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'wild-west': {
      // Dusty leather duster coat, frontier vest & silver marshal star
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.moveTo(W * 0.05, H);
      ctx.lineTo(W * 0.18, shoulderY);
      ctx.lineTo(W * 0.5, shoulderY + 70);
      ctx.lineTo(W * 0.82, shoulderY);
      ctx.lineTo(W * 0.95, H);
      ctx.closePath();
      ctx.fill();

      // Wool vest
      ctx.fillStyle = '#451a03';
      ctx.beginPath();
      ctx.moveTo(W * 0.35, shoulderY + 50);
      ctx.lineTo(W * 0.65, shoulderY + 50);
      ctx.lineTo(W * 0.65, H);
      ctx.lineTo(W * 0.35, H);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'victorian-steampunk': {
      // Tweed velvet frock coat with brass pocket watch chain
      ctx.fillStyle = '#292524';
      ctx.beginPath();
      ctx.moveTo(W * 0.08, H);
      ctx.lineTo(W * 0.22, shoulderY);
      ctx.lineTo(W * 0.5, shoulderY + 50);
      ctx.lineTo(W * 0.78, shoulderY);
      ctx.lineTo(W * 0.92, H);
      ctx.closePath();
      ctx.fill();

      // Brass watch chain
      ctx.strokeStyle = '#ca8a04';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(W * 0.42, shoulderY + 110, 50, 0, Math.PI * 0.8);
      ctx.stroke();
      break;
    }

    case 'roaring-twenties': {
      // Pinstripe wool tuxedo / Flapper silk dress
      ctx.fillStyle = '#18181b';
      ctx.beginPath();
      ctx.moveTo(W * 0.08, H);
      ctx.lineTo(W * 0.24, shoulderY);
      ctx.lineTo(W * 0.5, shoulderY + 80);
      ctx.lineTo(W * 0.76, shoulderY);
      ctx.lineTo(W * 0.92, H);
      ctx.closePath();
      ctx.fill();

      // Crisp white shirt V-neck & black bow-tie
      ctx.fillStyle = '#f4f4f5';
      ctx.beginPath();
      ctx.moveTo(W * 0.4, shoulderY + 30);
      ctx.lineTo(W * 0.5, shoulderY + 120);
      ctx.lineTo(W * 0.6, shoulderY + 30);
      ctx.closePath();
      ctx.fill();

      // Black silk bowtie
      ctx.fillStyle = '#09090b';
      ctx.beginPath();
      ctx.moveTo(W * 0.44, shoulderY + 35);
      ctx.lineTo(W * 0.56, shoulderY + 45);
      ctx.lineTo(W * 0.56, shoulderY + 35);
      ctx.lineTo(W * 0.44, shoulderY + 45);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'apollo-moon-1969': {
      // NASA A7L White Pressure Spacesuit with chest controls
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(W * 0.05, H);
      ctx.lineTo(W * 0.18, shoulderY - 10);
      ctx.quadraticCurveTo(W * 0.5, shoulderY + 40, W * 0.82, shoulderY - 10);
      ctx.lineTo(W * 0.95, H);
      ctx.closePath();
      ctx.fill();

      // Pressure suit chest pack
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(W * 0.35, shoulderY + 60, W * 0.3, 90);

      // Red & blue anodized connectors
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(W * 0.4, shoulderY + 90, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(W * 0.45, shoulderY + 90, 10, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'retro-synth-1984': {
      // Neon leather motorcycle jacket with pop-up collar
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(W * 0.05, H);
      ctx.lineTo(W * 0.2, shoulderY);
      ctx.lineTo(W * 0.5, shoulderY + 70);
      ctx.lineTo(W * 0.8, shoulderY);
      ctx.lineTo(W * 0.95, H);
      ctx.closePath();
      ctx.fill();

      // Neon Cyan and Magenta lapels
      ctx.fillStyle = '#ec4899';
      ctx.beginPath();
      ctx.moveTo(W * 0.2, shoulderY);
      ctx.lineTo(W * 0.38, shoulderY + 60);
      ctx.lineTo(W * 0.28, H);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#06b6d4';
      ctx.beginPath();
      ctx.moveTo(W * 0.8, shoulderY);
      ctx.lineTo(W * 0.62, shoulderY + 60);
      ctx.lineTo(W * 0.72, H);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }

  ctx.restore();
}

// User Face compositing with feathering, tone grading, and transforms
function drawBlendedUserFace(
  ctx: CanvasRenderingContext2D,
  userImage: HTMLImageElement | HTMLCanvasElement,
  adj: FaceAdjustments,
  W: number,
  H: number
) {
  ctx.save();

  // Face Aperture Center
  const faceCenterX = W * 0.5 + adj.offsetX;
  const faceCenterY = H * 0.42 + adj.offsetY;

  // Face Oval Size
  const ovalRadiusX = 145 * adj.scale;
  const ovalRadiusY = 190 * adj.scale;

  // Create temporary canvas for pre-filtering the user face
  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = ovalRadiusX * 2.8;
  faceCanvas.height = ovalRadiusY * 2.8;
  const fCtx = faceCanvas.getContext('2d')!;

  const fw = faceCanvas.width;
  const fh = faceCanvas.height;

  // Apply Brightness & Contrast CSS filters
  const b = adj.brightness;
  const c = adj.contrast;
  fCtx.filter = `brightness(${b}%) contrast(${c}%)`;

  // Draw user image centered in faceCanvas
  const userAspect = userImage.width / userImage.height;
  let drawW = fw;
  let drawH = fw / userAspect;
  if (drawH < fh) {
    drawH = fh;
    drawW = fh * userAspect;
  }
  fCtx.drawImage(userImage, (fw - drawW) / 2, (fh - drawH) / 2, drawW, drawH);
  fCtx.filter = 'none';

  // Warmth / Cool tint adjustment
  if (adj.warmth !== 0) {
    fCtx.save();
    fCtx.globalCompositeOperation = adj.warmth > 0 ? 'color' : 'color';
    fCtx.fillStyle = adj.warmth > 0 ? 'rgb(245, 158, 11)' : 'rgb(56, 189, 248)';
    fCtx.globalAlpha = Math.min(Math.abs(adj.warmth) / 100, 0.4);
    fCtx.fillRect(0, 0, fw, fh);
    fCtx.restore();
  }

  // Create soft feathered oval mask
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = fw;
  maskCanvas.height = fh;
  const mCtx = maskCanvas.getContext('2d')!;

  const feather = adj.featherRadius;
  const grad = mCtx.createRadialGradient(
    fw / 2,
    fh / 2,
    Math.max(ovalRadiusX - feather * 1.5, 10),
    fw / 2,
    fh / 2,
    ovalRadiusX + feather
  );
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.75, 'rgba(0,0,0,0.85)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');

  mCtx.fillStyle = grad;
  mCtx.beginPath();
  mCtx.ellipse(fw / 2, fh / 2, ovalRadiusX, ovalRadiusY, 0, 0, Math.PI * 2);
  mCtx.fill();

  // Combine face with mask
  fCtx.globalCompositeOperation = 'destination-in';
  fCtx.drawImage(maskCanvas, 0, 0);

  // Draw rotated & positioned masked face onto main canvas
  ctx.translate(faceCenterX, faceCenterY);
  ctx.rotate((adj.rotation * Math.PI) / 180);
  ctx.drawImage(faceCanvas, -fw / 2, -fh / 2);

  ctx.restore();
}

// Foreground neck/collar piece that overlaps the bottom of the face naturally
function drawEraCollar(ctx: CanvasRenderingContext2D, era: HistoricalEra, W: number, H: number) {
  ctx.save();
  const neckY = H * 0.57;

  switch (era.id) {
    case 'ancient-egypt': {
      // Golden Uraeus jewel at neck hollow
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(W * 0.5, neckY - 10, 18, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'renaissance-florence': {
      // Pleated white lace ruff collar
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.ellipse(W * 0.5, neckY - 20, 120, 28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      for (let x = W * 0.4; x <= W * 0.6; x += 12) {
        ctx.beginPath();
        ctx.moveTo(x, neckY - 32);
        ctx.lineTo(x, neckY - 8);
        ctx.stroke();
      }
      break;
    }
    case 'wild-west': {
      // Crimson western bandana knot
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(W * 0.44, neckY - 15);
      ctx.lineTo(W * 0.56, neckY - 15);
      ctx.lineTo(W * 0.5, neckY + 25);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}

// Period accessories overlay (Hats, Crowns, Goggles, Helmets)
function drawEraAccessories(
  ctx: CanvasRenderingContext2D,
  era: HistoricalEra,
  adj: FaceAdjustments,
  W: number,
  H: number
) {
  ctx.save();
  const faceCenterX = W * 0.5 + adj.offsetX;
  const faceCenterY = H * 0.42 + adj.offsetY;

  ctx.translate(faceCenterX, faceCenterY);
  ctx.rotate((adj.rotation * Math.PI) / 180);

  switch (era.id) {
    case 'ancient-egypt': {
      // Golden Nemes headdress crown top
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(-160, -90);
      ctx.quadraticCurveTo(0, -220, 160, -90);
      ctx.lineTo(130, 80);
      ctx.lineTo(100, 40);
      ctx.lineTo(-100, 40);
      ctx.lineTo(-130, 80);
      ctx.closePath();
      ctx.fill();

      // Royal blue striped bands
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 14;
      for (let r = 120; r <= 200; r += 26) {
        ctx.beginPath();
        ctx.arc(0, -50, r, 1.1 * Math.PI, 1.9 * Math.PI);
        ctx.stroke();
      }

      // Golden Cobra Uraeus
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.ellipse(0, -170, 14, 25, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'ancient-rome': {
      // Golden Laurel Wreath
      ctx.fillStyle = '#fbbf24';
      for (let i = -7; i <= 7; i++) {
        const angle = (i * Math.PI) / 18;
        const lx = Math.sin(angle) * 145;
        const ly = -Math.cos(angle) * 135 - 30;
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.ellipse(0, 0, 14, 7, 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      break;
    }

    case 'medieval-knights': {
      // Chainmail coif hood contour around crown
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.arc(0, -50, 150, Math.PI, 0);
      ctx.lineTo(140, 60);
      ctx.lineTo(-140, 60);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'pirate-golden-age': {
      // Plumed Black Tricorn Hat
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(-210, -80);
      ctx.quadraticCurveTo(0, -230, 210, -80);
      ctx.lineTo(120, -100);
      ctx.lineTo(-120, -100);
      ctx.closePath();
      ctx.fill();

      // Golden braid trim
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 8;
      ctx.stroke();

      // Red cockade feather
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.ellipse(-110, -140, 18, 55, -0.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'wild-west': {
      // Frontier Felt Stetson Hat
      ctx.fillStyle = '#78350f';
      // Wide curved brim
      ctx.beginPath();
      ctx.ellipse(0, -90, 220, 40, 0, 0, Math.PI * 2);
      ctx.fill();
      // Crown
      ctx.beginPath();
      ctx.roundRect(-90, -190, 180, 110, [25, 25, 0, 0]);
      ctx.fill();
      // Leather hatband
      ctx.fillStyle = '#451a03';
      ctx.fillRect(-90, -105, 180, 16);
      break;
    }

    case 'victorian-steampunk': {
      // Brass Goggles on forehead
      ctx.fillStyle = '#ca8a04';
      ctx.beginPath();
      ctx.arc(-55, -110, 42, 0, Math.PI * 2);
      ctx.arc(55, -110, 42, 0, Math.PI * 2);
      ctx.fill();

      // Glass tint reflection
      ctx.fillStyle = '#14b8a6';
      ctx.beginPath();
      ctx.arc(-55, -110, 32, 0, Math.PI * 2);
      ctx.arc(55, -110, 32, 0, Math.PI * 2);
      ctx.fill();

      // Leather strap
      ctx.fillStyle = '#451a03';
      ctx.fillRect(-170, -118, 340, 16);
      break;
    }

    case 'roaring-twenties': {
      // Crystal Flapper Headband with feather
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-140, -100, 280, 14);

      // Silver crystal rosette
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-80, -93, 18, 0, Math.PI * 2);
      ctx.fill();

      // Upright black ostrich feather
      ctx.fillStyle = '#09090b';
      ctx.beginPath();
      ctx.ellipse(-80, -170, 16, 70, -0.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'apollo-moon-1969': {
      // Gold reflective astronaut helmet visor ring
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 26;
      ctx.beginPath();
      ctx.ellipse(0, -15, 175, 210, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Subtle gold reflective visor glare
      const visorGrad = ctx.createLinearGradient(-150, -180, 150, 180);
      visorGrad.addColorStop(0, 'rgba(251, 191, 36, 0.25)');
      visorGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
      visorGrad.addColorStop(1, 'rgba(2, 132, 199, 0.2)');
      ctx.fillStyle = visorGrad;
      ctx.beginPath();
      ctx.ellipse(0, -15, 162, 197, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'retro-synth-1984': {
      // Chrome Sunset Aviators
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(-85, -25, 75, 55, [8, 8, 24, 24]);
      ctx.roundRect(10, -25, 75, 55, [8, 8, 24, 24]);
      ctx.fill();

      // Sunset gradient lens reflection
      const sunGrad = ctx.createLinearGradient(0, -25, 0, 30);
      sunGrad.addColorStop(0, '#f43f5e');
      sunGrad.addColorStop(0.6, '#fbbf24');
      sunGrad.addColorStop(1, '#06b6d4');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.roundRect(-80, -20, 65, 45, [6, 6, 20, 20]);
      ctx.roundRect(15, -20, 65, 45, [6, 6, 20, 20]);
      ctx.fill();
      break;
    }
  }

  ctx.restore();
}

// Atmospheric grading, film grain, and vignette
function applyEraAtmosphere(
  ctx: CanvasRenderingContext2D,
  era: HistoricalEra,
  adj: FaceAdjustments,
  W: number,
  H: number
) {
  ctx.save();

  // 1. Warmth / Sepia Color Wash
  const fp = era.filterProfile;
  if (fp.sepia > 0) {
    ctx.fillStyle = 'rgba(112, 66, 20, 0.16)';
    ctx.fillRect(0, 0, W, H);
  }

  // 2. Vintage Vignette
  const vignette = ctx.createRadialGradient(W * 0.5, H * 0.5, W * 0.35, W * 0.5, H * 0.5, W * 0.75);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, `rgba(0, 0, 0, ${fp.vignetteIntensity})`);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);

  // 3. Procedural Film / Canvas Grain
  const grainCanvas = document.createElement('canvas');
  grainCanvas.width = 120;
  grainCanvas.height = 120;
  const gCtx = grainCanvas.getContext('2d')!;
  const imgData = gCtx.createImageData(120, 120);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const val = Math.random() * 255;
    imgData.data[i] = val;
    imgData.data[i + 1] = val;
    imgData.data[i + 2] = val;
    imgData.data[i + 3] = Math.random() * 45;
  }
  gCtx.putImageData(imgData, 0, 0);

  ctx.globalAlpha = fp.grainOpacity;
  const pattern = ctx.createPattern(grainCanvas, 'repeat');
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.restore();
}

// Frame overlay (Ornate Gold, Wanted Poster, Vintage Polaroid, etc.)
function drawSelectedFrame(
  ctx: CanvasRenderingContext2D,
  era: HistoricalEra,
  role: string,
  style: FaceAdjustments['frameStyle'],
  W: number,
  H: number
) {
  if (style === 'none') return;
  ctx.save();

  if (style === 'ornate-gold') {
    // Heavy Baroque Gilded Gold Frame
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 32;
    ctx.strokeRect(16, 16, W - 32, H - 32);

    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 8;
    ctx.strokeRect(36, 36, W - 72, H - 72);

    // Gilded Brass Plaque at bottom
    ctx.fillStyle = '#78350f';
    ctx.fillRect(W * 0.2, H - 65, W * 0.6, 45);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.strokeRect(W * 0.2, H - 65, W * 0.6, 45);

    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 16px "Cinzel", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${era.name.toUpperCase()} · ${era.year}`, W * 0.5, H - 36);
  } else if (style === 'wanted-poster') {
    // Weathered Western Wanted Poster Header & Footer
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(0, 0, W, 85);
    ctx.fillRect(0, H - 85, W, 85);

    ctx.fillStyle = '#451a03';
    ctx.font = '900 38px "Cinzel", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('WANTED', W * 0.5, 55);

    ctx.font = 'bold 18px "Cinzel", serif';
    ctx.fillText(`REWARD: $5,000 IN GOLD · ${role.toUpperCase()}`, W * 0.5, H - 40);
  } else if (style === 'vintage-polaroid') {
    // Classic Instant Photo Border
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, W, 25);
    ctx.fillRect(0, 0, 25, H);
    ctx.fillRect(W - 25, 0, 25, H);
    ctx.fillRect(0, H - 110, W, 110);

    ctx.fillStyle = '#1e293b';
    ctx.font = 'italic 20px "Cinzel", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Chronos Expedition: ${era.name} (${era.year})`, W * 0.5, H - 50);
  } else if (style === 'archive-slate') {
    // Modern Archival Metadata Bar
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.fillRect(0, H - 50, W, 50);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '13px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`TEMPORAL ARCHIVE // ${era.year} · ${era.region}`, 24, H - 20);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#f59e0b';
    ctx.fillText(`PERSONA: ${role.toUpperCase()}`, W - 24, H - 20);
  }

  ctx.restore();
}

// Photobooth 4-Frame Strip Generator
export function generatePhotoBoothStrip(
  portraitDataUrls: string[],
  timestampStr: string
): string {
  const stripW = 480;
  const frameH = 580;
  const margin = 24;
  const headerH = 70;
  const footerH = 100;
  const totalFrames = Math.min(portraitDataUrls.length, 4);

  const stripH = headerH + totalFrames * (frameH + margin) + footerH;

  const canvas = document.createElement('canvas');
  canvas.width = stripW;
  canvas.height = stripH;
  const ctx = canvas.getContext('2d')!;

  // Vintage photobooth paper card background
  ctx.fillStyle = '#fdfbf7';
  ctx.fillRect(0, 0, stripW, stripH);

  // Perforated edge markers
  ctx.fillStyle = '#cbd5e1';
  for (let y = 15; y < stripH; y += 22) {
    ctx.fillRect(4, y, 4, 10);
    ctx.fillRect(stripW - 8, y, 4, 10);
  }

  // Header
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 20px "Cinzel", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('CHRONOS TIME-TRAVEL BOOTH', stripW * 0.5, 45);

  let currentY = headerH;

  // Draw each frame synchronously if loaded
  portraitDataUrls.slice(0, 4).forEach((dataUrl) => {
    const img = new Image();
    img.src = dataUrl;
    if (img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, margin, currentY, stripW - margin * 2, frameH);
    } else {
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(margin, currentY, stripW - margin * 2, frameH);
    }
    // Subtle border around each photobooth frame
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.strokeRect(margin, currentY, stripW - margin * 2, frameH);

    currentY += frameH + margin;
  });

  // Footer stamp
  ctx.fillStyle = '#64748b';
  ctx.font = '600 12px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`TEMPORAL EXPEDITION · ${timestampStr}`, stripW * 0.5, stripH - 55);
  ctx.font = '10px "JetBrains Mono", monospace';
  ctx.fillText('STAMPED & VERIFIED AT CONTINUUM ZERO', stripW * 0.5, stripH - 35);

  return canvas.toDataURL('image/jpeg', 0.95);
}
