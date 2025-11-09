"use client";

import React, { useRef, useCallback, useEffect } from "react";

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
  distortionLevel: number; // 歪み度合い (0.0 ～ 1.0)
  flyingObjects: FlyingObject[];
  mousePosition: Point;
  isGameOver: boolean;
  lastTime: number | undefined;
  totalTime: number;
};

// --- 設定値 ---
const HEART_RADIUS = 50;
const MOUSE_REPEL_RADIUS = 40;
const FLY_SPEED = 2;
const MAX_OBJECTS = 15;

// (省略: 飛来物生成や衝突判定などのヘルパー関数はここでは割愛)
const HEART_IMAGE_PATHS = [
  "/images/heart_0.png", // distortionLevel 0.0-0.2
  "/images/heart_1.png", // distortionLevel 0.2-0.4
  "/images/heart_2.png", // distortionLevel 0.4-0.6
  "/images/heart_3.png", // distortionLevel 0.6-0.8
  "/images/heart_4.png", // distortionLevel 0.8-1.0
];

const heartImages = new Map<string, HTMLImageElement>();
let imagesLoaded = false; // 全ての画像が読み込まれたかのフラグ

const preloadImages = async () => {
  if (imagesLoaded) return; // 既に読み込み済みなら何もしない

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
  const R = state.heartRadius; // このRは画像のサイズ調整に使われる

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

const FLY_SPEED_BASE = 0.05; // 速度の基準値 (deltaTimeとの積で調整)

const SPAWN_LIST: Omit<FlyingObject, "id" | "isHit">[] = [
  {
    when: 1000,
    content: "H",
    radius: 20,
    position: { x: 0.1, y: 0.1 },
    velocity: { x: FLY_SPEED_BASE, y: FLY_SPEED_BASE },
  },
  {
    when: 2500,
    content: "W",
    radius: 20,
    position: { x: 0.9, y: 0.1 },
    velocity: { x: -FLY_SPEED_BASE, y: FLY_SPEED_BASE },
  },
  {
    when: 3200,
    content: "X",
    radius: 20,
    position: { x: 0.5, y: 1.0 },
    velocity: { x: 0.0, y: -FLY_SPEED_BASE * 1.5 },
  },
  {
    when: 4000,
    content: "!!",
    radius: 25,
    position: { x: 0.0, y: 0.5 },
    velocity: { x: FLY_SPEED_BASE, y: 0.0 },
  },
];

const useGameLoop = (canvasRef: React.RefObject<HTMLCanvasElement | null>) => {
  // ゲームの状態をuseRefで保持し、再レンダーに依存しないようにする
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

  // requestAnimationFrameのIDを保持
  const animationFrameId = useRef<number | undefined>(undefined);

  // --- ゲーム更新ロジック ---
  const updateGame = (state: GameState, deltaTime: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
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

        // 飛来中オブジェクトリストに、新しくスポーンしたオブジェクトを追加
        state.flyingObjects.push(objToSpawn);
      }
    }
    state.flyingObjects = state.flyingObjects
      .map((obj) => {
        // ハートに向かって移動
        obj.position.x += obj.velocity.x * deltaTime * 0.001;
        obj.position.y += obj.velocity.y * deltaTime * 0.001;

        // a. マウスとの衝突判定（弾くロジック）
        const dxMouse = obj.position.x - state.mousePosition.x;
        const dyMouse = obj.position.y - state.mousePosition.y;
        const distanceMouse = Math.hypot(dxMouse, dyMouse); // マウスからの距離

        if (distanceMouse < MOUSE_REPEL_RADIUS + obj.radius) {
          // 弾かれた後に止まらないように、現在の速度ベクトルに反発力を加算する

          // 衝突の中心に近いほど反発が強くなる係数を計算 (0.0 ～ 1.0)
          const overlap = MOUSE_REPEL_RADIUS + obj.radius - distanceMouse;
          const repelFactor = overlap / (MOUSE_REPEL_RADIUS + obj.radius);

          // 反発力の強さの基準 (値を大きくするとより勢いよく弾かれる)
          const PUSH_STRENGTH = 200; // 👈 調整可能な定数 (大きめに設定)

          // 反発力のベクトルを計算
          const repelX = dxMouse * repelFactor * PUSH_STRENGTH;
          const repelY = dyMouse * repelFactor * PUSH_STRENGTH;

          // 🔥 修正: 現在の速度に反発力を加える（完全上書きを避ける）
          // deltaTimeで調整するため、速度の変化量として加える
          const accelerationFactor = 0.5; // 速度変化の感度 (調整可能)

          obj.velocity.x += repelX * accelerationFactor;
          obj.velocity.y += repelY * accelerationFactor; // オブジェクトが押し出された後、マウスと重ならないように位置を少し修正 (前回と同じロジック)

          if (overlap > 0 && distanceMouse > 0) {
            const adjustX = (dxMouse / distanceMouse) * overlap;
            const adjustY = (dyMouse / distanceMouse) * overlap;
            obj.position.x += adjustX;
            obj.position.y += adjustY;
          }
        }

        // b. ハートとの衝突判定（蹂躙ロジック）
        const dxHeart = obj.position.x - state.heartCenter.x;
        const dyHeart = obj.position.y - state.heartCenter.y;
        if (
          Math.hypot(dxHeart, dyHeart) < state.heartRadius + obj.radius &&
          !obj.isHit
        ) {
          obj.isHit = true;
          state.distortionLevel = Math.min(1.0, state.distortionLevel + 0.05);
        }

        return obj;
      })
      .filter((obj) => !obj.isHit && obj.position.y < canvas.height * 1.5); // 画面外に出たものと当たったものを削除

    // 3. ハートとマウスの衝突判定（ハートも弾かれる）
    const dxHeartMouse = state.heartCenter.x - state.mousePosition.x;
    const dyHeartMouse = state.heartCenter.y - state.mousePosition.y;
    if (Math.hypot(dxHeartMouse, dyHeartMouse) < state.heartRadius + 30) {
      // マウスによってハートが押しやられる
      state.heartCenter.x += dxHeartMouse * 0.05;
      state.heartCenter.y += dyHeartMouse * 0.05;
    }
    state.heartCenter.x += (canvas.width / 2 - state.heartCenter.x) * 0.01;
    state.heartCenter.y += (canvas.height / 2 - state.heartCenter.y) * 0.01;
  };

  const drawGame = (ctx: CanvasRenderingContext2D, state: GameState) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    state.flyingObjects.forEach((obj) => {
      ctx.fillStyle = "white";
      ctx.font = `${obj.radius * 1.5}px sans-serif`;
      ctx.fillText(obj.content, obj.position.x, obj.position.y);
    });

    // ハートの描画（画像を使用）
    drawHeart(ctx, state);
  };

  // --- メインゲームループ ---
  const gameLoop = useCallback(
    (timestamp: DOMHighResTimeStamp) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // 前回の実行時刻を保持 (deltaTime計算のため)
      const lastTime = gameStateRef.current.lastTime || timestamp;
      const deltaTime = timestamp - lastTime;
      gameStateRef.current.totalTime += deltaTime;
      // 1. **更新 (Update):** ゲームの状態を更新
      updateGame(gameStateRef.current, deltaTime);

      // 2. **描画 (Draw):** Canvasに描画
      drawGame(ctx, gameStateRef.current);

      gameStateRef.current.lastTime = timestamp;

      // ループを継続
      animationFrameId.current = requestAnimationFrame(gameLoop);
    },
    [canvasRef],
  );

  // マウスイベントハンドラ (コンポーネントで登録し、ここで使う)
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (canvasRef.current) {
        // キャンバス内の相対座標に変換
        const rect = canvasRef.current.getBoundingClientRect();
        gameStateRef.current.mousePosition = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };
      }
    },
    [canvasRef],
  );

  // ゲームの開始・停止関数
  const startGame = async () => {
    await preloadImages();
    const canvas = canvasRef.current;
    if (!canvas) return; // nullチェック
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

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // useGameLoopカスタムフックを呼び出し、ゲームロジックのAPIを取得
  const { startGame, stopGame, handleMouseMove, gameState } =
    useGameLoop(canvasRef);

  useEffect(() => {
    const initGame = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return; // nullチェック
      if (canvasRef.current) {
        canvasRef.current.width = globalThis.innerWidth;
        canvasRef.current.height = globalThis.innerHeight;
        await startGame(); // awaitで画像の読み込み完了を待つ
      }
    };
    initGame(); // 実行

    return () => {
      stopGame();
    };
  }, []);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
      }}
    >
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove} // マウスイベントをフックに渡す
        style={{
          display: "block",
          width: "100vw",
          height: "100vh",
        }}
      />
      {gameState.isGameOver && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "red",
            fontSize: "48px",
          }}
        >
          GAME OVER
        </div>
      )}
    </div>
  );
}
