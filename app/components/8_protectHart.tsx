"use client";

import React, { useRef, useCallback, useEffect } from "react";
import { StageProps } from "../ctrl/page";

export type Point = {
  x: number;
  y: number;
};

export type FlyingObject = {
  id: number;
  position: Point;
  velocity: Point; // vx, vy
  content: string;
  radius: number;
  isHit: boolean;
  when: number;
};

export type GameState = {
  heartCenter: Point;
  heartRadius: number;
  distortionLevel: number;
  flyingObjects: FlyingObject[];
  mousePosition: Point;
  isGameOver: boolean;
  lastTime: number | undefined;
  totalTime: number;
};

const HEART_RADIUS = 50;
const MOUSE_REPEL_RADIUS = 40;

const HEART_IMAGE_PATHS = [
  "/eyes/1.svg",
  "/eyes/2.svg",
  "/eyes/3.svg",
  "/eyes/4.svg",
  "/eyes/5.svg",
];

const heartImages = new Map<string, HTMLImageElement>();
let imagesLoaded = false;
const preloadImages = async () => {
  if (imagesLoaded) return;
  const promises = HEART_IMAGE_PATHS.map((path) => {
    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.src = path;
      img.onload = () => {
        heartImages.set(path, img);
        resolve();
      };
      img.onerror = reject;
    });
  });

  try {
    await Promise.all(promises);
    imagesLoaded = true;
    console.log("All heart images loaded.");
  } catch (error) {
    console.error("Failed to load heart images:", error);
  }
};

const drawHeart = (ctx: CanvasRenderingContext2D, state: GameState) => {
  const { x, y } = state.heartCenter;
  const R = state.heartRadius;
  const imageIndex = Math.min(
    HEART_IMAGE_PATHS.length - 1,
    Math.floor(state.distortionLevel * HEART_IMAGE_PATHS.length),
  );
  const imagePath = HEART_IMAGE_PATHS[imageIndex];
  const heartImage = heartImages.get(imagePath);

  if (heartImage && imagesLoaded) {
    const drawX = x - heartImage.width / 2;
    const drawY = y - heartImage.height / 2;
    ctx.drawImage(
      heartImage,
      drawX,
      drawY,
      heartImage.width,
      heartImage.height,
    );
  } else {
    ctx.fillStyle = "red";
    ctx.fillRect(x - R / 2, y - R / 2, R, R);
  }
};

const FLY_SPEED_BASE = 0.3; // 速度の基準値 (deltaTimeとの積で調整)

const SPAWN_LIST: Omit<FlyingObject, "id" | "isHit">[] = [
  {
    when: 0,
    content: "あなたのため",
    radius: 15,
    position: { x: 0.1, y: 0.1 },
    velocity: { x: FLY_SPEED_BASE, y: FLY_SPEED_BASE },
  },
  {
    when: 1000,
    content: "みんなそう言ってる",
    radius: 20,
    position: { x: 0.9, y: 0.1 },
    velocity: { x: -FLY_SPEED_BASE, y: FLY_SPEED_BASE },
  },
  {
    when: 2000,
    content: "それって本質じゃないよね？",
    radius: 10,
    position: { x: 0.1, y: 0.9 },
    velocity: { x: FLY_SPEED_BASE, y: -FLY_SPEED_BASE },
  },
  {
    when: 3000,
    content: "意味がわからない。",
    radius: 15,
    position: { x: 1.0, y: 1.0 },
    velocity: { x: -FLY_SPEED_BASE, y: -FLY_SPEED_BASE },
  },
  {
    when: 4000,
    content: "馬鹿なの？",
    radius: 25,
    position: { x: 0.5, y: 0.0 },
    velocity: { x: 0.0, y: FLY_SPEED_BASE * 2.5 },
  },
  {
    when: 4300,
    content: "恥ずかしい",
    radius: 25,
    position: { x: 0.6, y: 0.0 },
    velocity: { x: 0.01, y: FLY_SPEED_BASE * 2.5 },
  },
  {
    when: 4600,
    content: "言うことを聞きなさい",
    radius: 25,
    position: { x: 0.4, y: 0.0 },
    velocity: { x: -0.01, y: FLY_SPEED_BASE * 2.5 },
  },
  {
    when: 5200,
    content: "全部任せてたら大丈夫だからね",
    radius: 20,
    position: { x: 0.4, y: 1.0 },
    velocity: { x: -0.01, y: -FLY_SPEED_BASE * 0.7 },
  },
];

const useGameLoop = (canvasRef: React.RefObject<HTMLCanvasElement | null>) => {
  const gameStateRef = useRef<GameState>({
    heartCenter: { x: 0, y: 0 },
    heartRadius: HEART_RADIUS,
    distortionLevel: 0,
    flyingObjects: [],
    mousePosition: { x: -100, y: -100 }, // 初期値は画面外
    isGameOver: false,
    lastTime: undefined,
    totalTime: 0,
  });

  const scheduledObjectsRef = useRef<FlyingObject[]>(
    JSON.parse(
      JSON.stringify(
        SPAWN_LIST.map((obj, index) => ({ ...obj, id: index, isHit: false })),
      ),
    ),
  );

  const animationFrameId = useRef<number | undefined>(undefined);

  const updateGame = (
    state: GameState,
    deltaTime: number,
    canvasRef: React.RefObject<HTMLCanvasElement | null>,
    scheduledObjectsRef: React.MutableRefObject<FlyingObject[]>,
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    while (
      scheduledObjectsRef.current.length > 0 &&
      scheduledObjectsRef.current[0].when <= state.totalTime
    ) {
      const objToSpawn = scheduledObjectsRef.current.shift(); // 先頭を抜き取る

      if (objToSpawn) {
        objToSpawn.position.x = objToSpawn.position.x * canvas.width;
        objToSpawn.position.y = objToSpawn.position.y * canvas.height;

        objToSpawn.velocity.x = objToSpawn.velocity.x * canvas.width;
        objToSpawn.velocity.y = objToSpawn.velocity.y * canvas.height;

        state.flyingObjects.push(objToSpawn);
      }
    }
    state.flyingObjects = state.flyingObjects
      .map((obj) => {
        obj.position.x += obj.velocity.x * deltaTime * 0.001;
        obj.position.y += obj.velocity.y * deltaTime * 0.001;

        if (ctx) {
          ctx.font = `${obj.radius * 1.5}px sans-serif`;
        }
        const textWidth = ctx
          ? ctx.measureText(obj.content).width
          : obj.radius * 2;
        const textHeight = obj.radius * 1.5; // 高さの近似値 (radius * 1.5 = font-size)

        const halfWidth = textWidth / 2;
        const halfHeight = textHeight / 2;

        const dxMouse = Math.abs(obj.position.x - state.mousePosition.x);
        const dyMouse = Math.abs(obj.position.y - state.mousePosition.y);

        const closestX = Math.max(
          obj.position.x - halfWidth,
          Math.min(state.mousePosition.x, obj.position.x + halfWidth),
        );
        const closestY = Math.max(
          obj.position.y - halfHeight,
          Math.min(state.mousePosition.y, obj.position.y + halfHeight),
        );

        const dxClosest = state.mousePosition.x - closestX;
        const dyClosest = state.mousePosition.y - closestY;
        const distanceMouse = Math.hypot(dxClosest, dyClosest);

        const effectiveRadius = 5; // マウスカーソル自体の半径の近似値

        if (distanceMouse < MOUSE_REPEL_RADIUS + effectiveRadius) {
          if (
            dxMouse < halfWidth + effectiveRadius &&
            dyMouse < halfHeight + effectiveRadius
          ) {
          }
        }

        const dxMouseCenter = obj.position.x - state.mousePosition.x;
        const dyMouseCenter = obj.position.y - state.mousePosition.y;
        const distanceMouseCenter = Math.hypot(dxMouseCenter, dyMouseCenter);

        const effectiveObjectRadius = Math.max(halfWidth, halfHeight);
        const totalRepelRadius = MOUSE_REPEL_RADIUS + effectiveObjectRadius;

        if (distanceMouseCenter < totalRepelRadius) {
          const overlap = totalRepelRadius - distanceMouseCenter;
          const repelFactor = overlap / totalRepelRadius; // 衝突の中心に近いほど1.0に近づく

          const PUSH_STRENGTH = 9000; // 🔥 数値を大幅に増やして強く弾く

          const repelX = dxMouseCenter * repelFactor * PUSH_STRENGTH;
          const repelY = dyMouseCenter * repelFactor * PUSH_STRENGTH;

          const accelerationFactor = 0.000005;

          obj.velocity.x += repelX * accelerationFactor;
          obj.velocity.y += repelY * accelerationFactor;

          if (overlap > 0 && distanceMouseCenter > 0) {
            const adjustX = (dxMouseCenter / distanceMouseCenter) * overlap;
            const adjustY = (dyMouseCenter / distanceMouseCenter) * overlap;
            obj.position.x += adjustX;
            obj.position.y += adjustY;
          }
        }

        const heartClosestX = Math.max(
          obj.position.x - halfWidth,
          Math.min(state.heartCenter.x, obj.position.x + halfWidth),
        );
        const heartClosestY = Math.max(
          obj.position.y - halfHeight,
          Math.min(state.heartCenter.y, obj.position.y + halfHeight),
        );

        const dxHeart = state.heartCenter.x - heartClosestX;
        const dyHeart = state.heartCenter.y - heartClosestY;
        const distanceHeart = Math.hypot(dxHeart, dyHeart);

        if (distanceHeart < state.heartRadius && !obj.isHit) {
          obj.isHit = true;
          /*
          console.log("--- COLLISION DETECTED! ---");
          console.log("Flying Object ID:", obj.id, "Content:", obj.content);
          console.log("New Distortion Level:", state.distortionLevel + 0.05);
          */

          state.distortionLevel = Math.min(1.0, state.distortionLevel + 0.05);
        }

        return obj;
      })
      .filter((obj) => !obj.isHit && obj.position.y < canvas.height * 1.5);
    const dxHeartMouse = state.heartCenter.x - state.mousePosition.x;
    const dyHeartMouse = state.heartCenter.y - state.mousePosition.y;
    if (Math.hypot(dxHeartMouse, dyHeartMouse) < state.heartRadius + 30) {
      state.heartCenter.x += dxHeartMouse * 0.15;
      state.heartCenter.y += dyHeartMouse * 0.15;
    }
    state.heartCenter.x += (canvas.width / 2 - state.heartCenter.x) * 0.01;
    state.heartCenter.y += (canvas.height / 2 - state.heartCenter.y) * 0.01;
  };

  const drawGame = (ctx: CanvasRenderingContext2D, state: GameState) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    state.flyingObjects.forEach((obj) => {
      ctx.fillStyle = "white";
      ctx.font = `${obj.radius * 1.5}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(obj.content, obj.position.x, obj.position.y);
    });

    drawHeart(ctx, state);
  };

  const gameLoop = useCallback(
    (timestamp: DOMHighResTimeStamp) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const lastTime = gameStateRef.current.lastTime || timestamp;
      const deltaTime = timestamp - lastTime;
      gameStateRef.current.totalTime += deltaTime;
      updateGame(
        gameStateRef.current,
        deltaTime,
        canvasRef,
        scheduledObjectsRef,
      );

      drawGame(ctx, gameStateRef.current);

      gameStateRef.current.lastTime = timestamp;

      animationFrameId.current = requestAnimationFrame(gameLoop);
    },
    [canvasRef, scheduledObjectsRef],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        gameStateRef.current.mousePosition = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };
      }
    },
    [canvasRef],
  );

  const startGame = async () => {
    await preloadImages();
    const canvas = canvasRef.current;
    if (!canvas) return;
    gameStateRef.current.heartCenter = {
      x: canvas.width / 2,
      y: canvas.height / 2,
    };
    animationFrameId.current = requestAnimationFrame(gameLoop);
  };

  const stopGame = () => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
  };

  return {
    startGame,
    stopGame,
    handleMouseMove,
    gameState: gameStateRef.current,
  };
};

// Fur Audio

const AUDIO_SOURCE = "/audio/001.wav";
const useAudioPlayback = (onComplete: () => void) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    const audio = new Audio(AUDIO_SOURCE);
    audioRef.current = audio;
    audio.volume = 1.0; // 音量設定 (任意)
    audio.loop = false;

    const handleAudioEnded = () => {
      console.log("Audio playback finished. Calling onComplete.");
      onCompleteRef.current(); // Ref 経由で最新の onComplete を呼び出す
    };

    audio.addEventListener("ended", handleAudioEnded);

    // 再生開始ロジック:
    const playAudio = () => {
      audio
        .play()
        .catch((e) =>
          console.warn(
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
  }, []);
  return { audioRef };
};

export default function GameCanvas({ onComplete }: StageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useAudioPlayback(onComplete);

  const { startGame, stopGame, handleMouseMove, gameState } =
    useGameLoop(canvasRef);

  useEffect(() => {
    const initGame = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (canvasRef.current) {
        canvasRef.current.width = globalThis.innerWidth;
        canvasRef.current.height = globalThis.innerHeight;
        await startGame();
      }
    };
    initGame();

    return () => {
      stopGame();
    };
  }, [startGame, stopGame]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
      }}
    >
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        style={{
          display: "block",
          width: "100vw",
          height: "100vh",
        }}
      />
      {gameState.isGameOver && (
        <div
          style={{ width: "100%", height: "100%", backgroundColor: "black" }}
        ></div>
      )}
    </div>
  );
}
