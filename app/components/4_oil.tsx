import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { OilArtAPI, OilArtPlane } from "./OilArt/OilArtPlane.tsx";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { StageProps } from "../ctrl/page.tsx";
const AUDIO_SOURCES: Record<number, string> = {
  1: "/audio/001.wav",
  2: "/audio/002.wav",
};
const useSequentialAudio = (
  initialState: number,
  audioSources: Record<number, string>,
  onComplete: () => void,
) => {
  const [sceneState, setSceneState] = useState(initialState);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioUrl = audioSources[sceneState];
  useEffect(() => {
    if (sceneState > Math.max(...Object.keys(audioSources).map(Number))) {
      console.log("All audio finished. Calling onComplete.");
      onComplete();
      return;
    }
    if (!currentAudioUrl) {
      return;
    }
    console.log(`Starting setup for state ${sceneState}: ${currentAudioUrl}`);
    const existingAudio = audioRef.current;
    if (existingAudio) {
      existingAudio.pause();
    }
    const audio = new Audio(currentAudioUrl);
    audioRef.current = audio;
    const handleAudioEnded = () => {
      console.log(`Audio ${sceneState} finished. Transitioning state.`);
      setSceneState((prev) => prev + 1);
    };
    audio.addEventListener("ended", handleAudioEnded);
    audio.play().catch((e) => {
      console.warn(
        `Audio playback failed for state ${sceneState} (requires user interaction):`,
        e,
      );
    });
    return () => {
      if (audio === audioRef.current) {
        // 現在設定したAudioオブジェクトであることを確認
        audio.pause();
        audio.removeEventListener("ended", handleAudioEnded);
      }
    };
  }, [sceneState, audioSources, onComplete]); // sceneStateとcurrentAudioUrlは基本的に連動するため、sceneStateを依存配列に含める
  return sceneState;
};
export default function OilArtCanvasWrapper({ onComplete }: StageProps) {
  const apiRef = useRef<OilArtAPI>({} as OilArtAPI);
  const sceneState = useSequentialAudio(1, AUDIO_SOURCES, onComplete);
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (apiRef.current.dropOil) {
        const x = Math.random() * 2 - 1; // -1.0〜1.0
        const y = Math.random() * 2 - 1; // -1.0〜1.0
        const color = new THREE.Color(
          Math.random(),
          Math.random(),
          Math.random(),
        );
        apiRef.current.dropOil({ x, y }, color);
        if (sceneState == 2) {
          const tiltX = Math.random() * 0.8 - 0.4;
          const tiltY = Math.random() * 0.8 - 0.4;
          apiRef.current.tilt({ x: tiltX, y: tiltY });
        } else {
          apiRef.current.tilt({ x: 0, y: 0 });
        }
      }
    }, 1500);
    return () => clearInterval(intervalId);
  }, []);
  return (
    <Canvas camera={{ position: [0, 0, 1] }}>
      <color attach="background" args={[0x000000]} />
      <OilArtPlane onTriggerAPI={(api) => (apiRef.current = api)} />
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        enableRotate={false}
      />
    </Canvas>
  );
}
