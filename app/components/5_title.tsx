import { useEffect, useRef } from "react";
import { StageProps } from "../ctrl/page.tsx";

const AUDIO_SOURCE = "/audio/005.flac";

export default function FifthTitle({ onComplete }: StageProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (audioRef.current) return;
    const audio = new Audio(AUDIO_SOURCE);
    audioRef.current = audio;

    const handleAudioEnded = () => {
      onComplete();
    };

    audio.addEventListener("ended", handleAudioEnded);

    const playAudio = () => {
      audio
        .play()
        .catch((e) =>
          console.log(
            "Audio playback failed (may require user interaction):",
            e,
          ),
        );
    };

    audio.oncanplaythrough = playAudio;

    return () => {
      audio.pause();
      audio.removeEventListener("ended", handleAudioEnded);
      audioRef.current = null;
    };
  }, [onComplete]);

  return (
    <nav
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <h1 style={{ fontSize: "8rem", color: "#bbb" }}>AIdentity</h1>
    </nav>
  );
}
