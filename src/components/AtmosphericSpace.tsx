import React, { useEffect, useRef } from 'react';

export const AtmosphericSpace: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Particle splash pool for atmospheric cursor effect
    interface SplashParticle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      alpha: number;
      color: string;
    }

    const particles: SplashParticle[] = [];
    const MAX_PARTICLES = 35;
    const baseColor = '#A855F7'; // Lavender accent

    const addSplat = (x: number, y: number) => {
      if (particles.length > MAX_PARTICLES) {
        particles.shift();
      }
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
        radius: Math.random() * 30 + 20,
        alpha: 0.35,
        color: baseColor,
      });
    };

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0]?.clientY : e.clientY;
      if (clientX !== undefined && clientY !== undefined) {
        addSplat(clientX, clientY);
      }
    };

    window.addEventListener('mousemove', handlePointerMove, { passive: true });
    window.addEventListener('touchmove', handlePointerMove, { passive: true });

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Render lingering splash glows
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha *= 0.96; // Density dissipation
        p.radius *= 1.01;

        if (p.alpha <= 0.01) {
          particles.splice(i, 1);
          continue;
        }

        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
        gradient.addColorStop(0, `rgba(168, 85, 247, ${p.alpha})`);
        gradient.addColorStop(0.5, `rgba(168, 85, 247, ${p.alpha * 0.4})`);
        gradient.addColorStop(1, 'rgba(168, 85, 247, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('touchmove', handlePointerMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
      {/* 1. Deep cosmic atmospheric ambient gradient */}
      <div className="absolute inset-0 bg-[#07050D]" />

      {/* 2. Central Lavender Nebula Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] sm:w-[650px] h-[480px] sm:h-[650px] rounded-full bg-gradient-to-tr from-purple-900/20 via-purple-600/10 to-transparent blur-3xl opacity-50 animate-lavender-breathe" />

      {/* 3. Subtle Mint Cream highlight far in deep space */}
      <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] rounded-full bg-teal-500/5 blur-3xl opacity-30" />

      {/* 4. Interactive pointer splash canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-60" />
    </div>
  );
};
