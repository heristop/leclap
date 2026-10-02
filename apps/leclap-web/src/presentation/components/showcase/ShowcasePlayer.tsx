import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/presentation/components/ui/button';
import { mediaPath, type ShowcaseSample } from './catalog';

export function ShowcasePlayer({ sample, requested }: { sample: ShowcaseSample; requested: boolean }) {
  const { t } = useTranslation('showcase');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) return () => {};
    let started = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          video.pause();

          return;
        }

        if (requested && !started && !document.hidden) {
          started = true;
          video.play().catch(() => {
            setFailed(true);
          });
        }
      },
      { threshold: 0.15 }
    );
    const onVisibility = () => {
      if (document.hidden) video.pause();
    };
    observer.observe(video);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      video.pause();
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [requested]);

  const play = () => {
    const video = videoRef.current;

    if (!video) return;
    setFailed(false);
    setWaiting(true);

    if (video.error) video.load();
    video.play().catch(() => {
      setWaiting(false);
      setFailed(true);
    });
  };

  return (
    <div className="showcase-player relative isolate aspect-video overflow-hidden rounded-xl bg-gray-900">
      <video
        ref={videoRef}
        src={mediaPath(sample, 'mp4')}
        poster={mediaPath(sample, 'webp')}
        preload="none"
        muted
        playsInline
        controls={hasStarted}
        aria-label={t('previewOf', { title: sample.title })}
        className="h-full w-full object-contain"
        onPlay={() => {
          setHasStarted(true);
          setPlaying(true);
        }}
        onPause={() => {
          setPlaying(false);
        }}
        onEnded={() => {
          setPlaying(false);
        }}
        onPlaying={() => {
          setPlaying(true);
          setWaiting(false);
        }}
        onWaiting={() => {
          setWaiting(true);
        }}
        onCanPlay={() => {
          setWaiting(false);
        }}
        onError={() => {
          setFailed(true);
          setWaiting(false);
          setPlaying(false);
        }}
      />
      {!playing && !failed && (
        <Button
          variant="secondary"
          className={cn(
            'absolute left-4 min-h-11 rounded-full border-0 bg-background/95 text-foreground shadow-none hover:translate-y-0 active:scale-[0.97] sm:left-6',
            hasStarted ? 'bottom-12 sm:bottom-14' : 'bottom-4 sm:bottom-6'
          )}
          onClick={play}
          aria-label={t('playSample', { title: sample.title })}
        >
          <Play size={17} aria-hidden="true" />
          {t('play')}
        </Button>
      )}
      {waiting && !failed && (
        <div
          role="status"
          className="pointer-events-none absolute inset-0 grid place-content-center bg-gray-900/40 text-white"
        >
          <Loader2 size={28} className="motion-safe:animate-spin" aria-hidden="true" />
          <span className="sr-only">{t('loading')}</span>
        </div>
      )}
      {failed && (
        <div
          role="alert"
          className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground"
        >
          <p>{t('videoError')}</p>
          <Button variant="secondary" onClick={play}>
            <RefreshCw size={18} aria-hidden="true" />
            {t('retry')}
          </Button>
        </div>
      )}
    </div>
  );
}
