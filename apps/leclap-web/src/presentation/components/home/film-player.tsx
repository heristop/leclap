import { useCallback, useEffect, useRef, useState } from 'react';
import { useInView } from '@/hooks/useInView';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { Captions, CaptionsOff, Pause, Play } from '@/presentation/components/icons';
import { playWithSound, readSound, tellVideo } from '@/lib/landing-sound';
import { FilmScreen, FilmStage, FrameButton, SoundControl, useFilmSound } from '@/presentation/components/film-frame';
import type { FilmAsset } from './films';

interface FilmPlayerLabels {
  play: string;
  pause: string;
  captions: string;
}

interface FilmPlayerProps {
  film: FilmAsset;
  /** Accessible name of the film. */
  title: string;
  /** The frame's label pill, e.g. "The film · 1:18". */
  badge: string;
  /** Label of the captions track, and its language. */
  captionsLabel: string;
  captionsLang: string;
  labels: FilmPlayerLabels;
  className?: string;
}

// Save-Data visitors get the poster and the play button: nothing streams until they ask for it.
const prefersSaveData = (): boolean =>
  typeof navigator !== 'undefined' &&
  (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;

// A film in the page's one video frame (film-frame.tsx), like the in-browser render: it loads as it nears the
// viewport, plays while on screen and rests off-screen. It speaks with the landing's one sound: muted until
// the visitor turns it on, here or anywhere else on the page, its captions carrying the narration meanwhile.
// The first time a film is heard it starts over, so the narration is heard whole, and it no longer loops, so
// the film ends. The glass pill turns the sound on, plays and pauses, and toggles the captions; a visitor's
// pause sticks. Reduced motion: the native controls and captions, and nothing plays by itself.
export const FilmPlayer = ({ film, title, badge, captionsLabel, captionsLang, labels, className }: FilmPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduced = useReducedMotion();
  const [loadRef, shouldLoad] = useInView({ rootMargin: '300px' });
  const [playRef, inView] = useInView({ once: false, threshold: 0.35, rootMargin: '0px' });
  const { muted, volume, toggle, changeVolume, refuse, adopt } = useFilmSound(videoRef);
  const [paused, setPaused] = useState(true);
  const [held, setHeld] = useState(prefersSaveData);
  const [captions, setCaptions] = useState(true);
  const [cue, setCue] = useState('');
  // Whether the film has played with sound yet: the first time it does, it starts from the top.
  const heard = useRef(false);

  const setFrameRef = useCallback(
    (node: HTMLDivElement | null) => {
      loadRef.current = node;
      playRef.current = node;
    },
    [loadRef, playRef]
  );

  // On the landing's sound from the instant it mounts — muted, unless the visitor already turned it on — before
  // the browser weighs autoplay, so the in-view play() goes through. The same state the sound hook applies
  // after every render, so however React orders the two (StrictMode re-attaches refs after effects), they agree.
  const setVideoEl = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;

    if (!node) return;

    const { enabled, volume: level } = readSound();

    tellVideo(node, !enabled, level);
    node.setAttribute('muted', '');
  }, []);

  // On screen it plays with the landing's sound, starting over the first time that sound is on, whether it was
  // switched on here or elsewhere. A browser that refuses the sound leaves the film unheard, for its own
  // button to start over. Under reduced motion the film rests off-screen too, but never starts by itself.
  useEffect(() => {
    const video = videoRef.current;

    if (!video) return;

    if (!inView || held) {
      video.pause();

      return;
    }

    if (reduced) return;

    if (!muted && !heard.current) {
      heard.current = true;
      video.currentTime = 0;
    }

    playWithSound(video, !muted, () => {
      heard.current = false;
      refuse();
    });
  }, [inView, held, reduced, shouldLoad, muted, refuse]);

  // Reduced motion switched on mid-visit stills whatever is playing.
  useEffect(() => {
    if (reduced) videoRef.current?.pause();
  }, [reduced]);

  // The captions are drawn in the frame's own type, above the control pill: the track stays hidden and its
  // active cue is mirrored here. Under reduced motion the native player shows them.
  useEffect(() => {
    const track = videoRef.current?.textTracks[0];

    if (!track) return () => {};

    if (reduced) {
      track.mode = 'showing';

      return () => {};
    }

    track.mode = 'hidden';
    const onCueChange = () => {
      const active = track.activeCues?.[0];
      setCue(active && 'text' in active ? String(active.text) : '');
    };
    track.addEventListener('cuechange', onCueChange);

    return () => {
      track.removeEventListener('cuechange', onCueChange);
    };
  }, [reduced, shouldLoad]);

  const togglePlay = () => {
    const video = videoRef.current;

    if (!video) return;

    if (video.paused) {
      setHeld(false);
      video.play().catch(() => {});

      return;
    }

    setHeld(true);
    video.pause();
  };

  // The first time the sound comes on from this film's own pill, it starts over inside the click, where every
  // browser allows sound, whether the sound came on through the button or the slider.
  const hearFromTheTop = () => {
    const video = videoRef.current;

    if (!video || heard.current) return;

    heard.current = true;
    video.currentTime = 0;
    setHeld(false);
    video.play().catch(() => {});
  };

  const control =
    shouldLoad && !reduced ? (
      <>
        <SoundControl
          muted={muted}
          volume={volume}
          playing={!paused}
          onToggle={() => {
            const turningOn = muted;

            toggle();

            if (turningOn) hearFromTheTop();
          }}
          onVolume={(next) => {
            const turningOn = muted && next > 0;

            changeVolume(next);

            if (turningOn) hearFromTheTop();
          }}
        />
        <FrameButton label={paused ? labels.play : labels.pause} onClick={togglePlay}>
          {paused ? <Play /> : <Pause />}
        </FrameButton>
        <FrameButton
          label={labels.captions}
          pressed={captions}
          onClick={() => {
            setCaptions((shown) => !shown);
          }}
        >
          {captions ? <Captions /> : <CaptionsOff />}
        </FrameButton>
      </>
    ) : undefined;

  return (
    <FilmStage frameRef={setFrameRef} className={className}>
      <FilmScreen badge={badge} control={control} controlLabel={title} paused={paused}>
        {!shouldLoad && (
          <img
            src={film.poster}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover"
          />
        )}
        {shouldLoad && (
          <video
            ref={setVideoEl}
            className="absolute inset-0 size-full object-cover"
            poster={film.poster}
            loop={muted}
            playsInline
            preload="metadata"
            controls={reduced}
            aria-label={title}
            onPlay={() => {
              setPaused(false);
            }}
            onPause={() => {
              setPaused(true);
            }}
            onEnded={() => {
              setHeld(true);
            }}
            // Under reduced motion the native controls can turn the sound on or off: every video follows.
            onVolumeChange={
              reduced
                ? (event) => {
                    adopt(event.currentTarget);
                  }
                : undefined
            }
          >
            <source src={film.mp4} type="video/mp4" />
            <track kind="captions" src={film.captions} srcLang={captionsLang} label={captionsLabel} default />
          </video>
        )}
        {captions && cue && !reduced && (
          <p
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-14 flex justify-center px-6 sm:bottom-16"
          >
            <span className="max-w-3xl rounded-lg bg-black/60 px-3 py-1.5 text-center text-sm font-medium leading-snug text-balance text-white backdrop-blur-sm sm:text-base">
              {cue}
            </span>
          </p>
        )}
      </FilmScreen>
    </FilmStage>
  );
};
