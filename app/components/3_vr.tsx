"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Sky,
  ContactShadows,
  Cloud,
  Clouds,
} from "@react-three/drei";
import BenchScene from "./BenchScene.tsx";
import { useState, useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { StageProps } from "../ctrl/page.tsx";

const AUDIO_SOURCES: Record<number, string> = {
  1: "/audio/003-1.flac",
  2: "/audio/003-2.flac",
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
      // 次の状態へ遷移 (例: 1 -> 2, 2 -> 3)
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
        audio.pause();
        audio.removeEventListener("ended", handleAudioEnded);
      }
    };
  }, [sceneState, audioSources, onComplete]);
  return sceneState;
};

interface RandomCloudsProps {
  count: number;
  radius: number;
  height: number;
  sceneState: number;
}

function SceneController({ sceneState }: { sceneState: number }) {
  const isFoggy = sceneState === 2;

  const directionalLightIntensity = isFoggy ? 0.1 : 2;

  const ambientLightIntensity = isFoggy ? 0.05 : 0.5;

  useFrame(({ scene }) => {
    if (isFoggy) {
      scene.fog = new THREE.Fog(0x444444, 5, 40); // Far distanceも少し短くして密度を上げる
    } else {
      scene.fog = null;
    }
  });

  return (
    <>
      <ambientLight intensity={ambientLightIntensity} />

      <directionalLight
        position={[5, 10, 5]}
        intensity={directionalLightIntensity} // ここで制御
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
    </>
  );
}

function AnimatedSky({ sceneState }: { sceneState: number }) {
  const [sunPosition, setSunPosition] = useState<[number, number, number]>([
    0, 100, 0,
  ]);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime() * 0.1;
    const x = Math.sin(time) * 100;
    const z = Math.cos(time) * 100;
    setSunPosition([x, 100, z]);
  });

  if (sceneState === 2) {
    return null;
  }

  return (
    <Sky
      distance={450000}
      sunPosition={new THREE.Vector3(...sunPosition)}
      inclination={sceneState === 2 ? 0.001 : 0.6}
      azimuth={0.25}
      mieCoefficient={0.005}
      mieDirectionalG={0.8}
      rayleigh={0.5}
      turbidity={10}
    />
  );
}

function RandomClouds({
  count,
  radius,
  height,
  sceneState,
}: RandomCloudsProps) {
  const cloudColor = sceneState === 2 ? "#080808" : "#fff";
  const baseOpacity = sceneState === 2 ? 0.9 : 0.5;

  const cloudConfigs = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.sqrt(Math.random()) * radius;

      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;

      return {
        position: [x, height + (Math.random() - 0.5) * 5, z] as [
          number,
          number,
          number,
        ],

        bounds: [
          Math.random() * 10 + 10,
          Math.random() * 2 + 1,
          Math.random() * 10 + 10,
        ] as [number, number, number],
        seed: Math.floor(Math.random() * 1000) + i,
        volume: Math.random() * 20 + 5,
        opacity: Math.random() * 0.4 + baseOpacity,
        color: cloudColor,
      };
    });
  }, [count, radius, height]);

  return (
    <>
      {cloudConfigs.map((config, index) => (
        <Cloud key={index} {...config} />
      ))}
    </>
  );
}

export default function ThreeVR({ onComplete }: StageProps) {
  const sceneState = useSequentialAudio(1, AUDIO_SOURCES, onComplete);

  return (
    <Canvas
      key="r3f-main-canvas"
      camera={{ position: [5, 5, 5], fov: 60 }}
      shadows
      style={{ background: sceneState === 2 ? "#85555B" : "#d0e0ff" }}
    >
      <AnimatedSky sceneState={sceneState} />

      <Clouds material={THREE.MeshLambertMaterial} limit={200}>
        <RandomClouds
          count={100}
          radius={80}
          height={15}
          sceneState={sceneState}
        />
      </Clouds>

      <SceneController sceneState={sceneState} />

      <BenchScene />
      <ContactShadows
        position={[0, -0.5, 0]}
        opacity={0.7}
        scale={10}
        blur={1}
        far={10}
      />
      <OrbitControls enableZoom={true} enablePan={true} enableRotate={true} />
    </Canvas>
  );
}
