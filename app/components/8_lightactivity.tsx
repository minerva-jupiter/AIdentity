"use clinet";

import React, { useState, useEffect } from "react";
import styled, { keyframes, css } from "styled-components";

// 演出データ
const flickerEvents = [
  { word: "TSCHERNOBYL", duration: 500, delay: 1000 },
  { word: "HARRISBURG", duration: 600, delay: 5000 },
  // ... その他の単語
];

type FlickerEvent = (typeof flickerEvents)[number];

// --- 1. CSS-in-JSによるアニメーション定義 ---

// 背景のチカチカアニメーション
const backgroundFlicker = keyframes`
0%, 100% { background-color: #000; }
10%, 30%, 50%, 70%, 90% { background-color: #fff; }
20%, 40%, 60%, 80% { background-color: #000; }
`;

// 文字のチカチカアニメーション
const textFlicker = keyframes`
0%, 100% { color: #fff; text-shadow: 0 0 5px rgba(255, 255, 255, 0.5); }
50% { color: #f00; text-shadow: none; }
`;

// --- 2. スタイル付きコンポーネントの定義 ---

// 背景を制御するコンテナ
const VisualContainer = styled.div<{ $isFlickering: boolean }>`
  /* 基本スタイル */
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100vh; /* 画面全体に広げるための例 */
  background-color: black;
  transition: background-color 0.1s;

  /* フリッカー適用 */
  ${(props) =>
    props.$isFlickering &&
    css`
      animation: ${backgroundFlicker} 0.1s infinite step-end;
    `}
`;

// テキストを制御するH1要素
const FlickerText = styled.h1<{ $isFlickering: boolean }>`
  /* 基本スタイル */
  font-size: 8rem;
  font-weight: bold;
  color: white;
  margin: 0;

  /* フリッカー適用 */
  ${(props) =>
    props.$isFlickering &&
    css`
      animation: ${textFlicker} 0.9s infinite step-end;
    `}
`;

const FlickerVisualizer: React.FC = () => {
  const [currentWord, setCurrentWord] = useState<string>("");
  const [isFlickering, setIsFlickering] = useState<boolean>(false);
  const startTime = React.useRef(Date.now()); // 演出開始時間を保持

  useEffect(() => {
    // 演出の開始時刻を固定
    const startOffset = startTime.current;

    const tick = () => {
      const elapsedTime = Date.now() - startOffset;

      // 現在のイベント判定ロジック
      const activeEvent = flickerEvents.find(
        (event) =>
          elapsedTime >= event.delay &&
          elapsedTime < event.delay + event.duration,
      );

      if (activeEvent) {
        setCurrentWord(activeEvent.word);
        setIsFlickering(true);
      } else {
        setIsFlickering(false);
        // フリッカーが終わった後も単語を一定時間表示し続けるなどの調整はここで行う
      }

      // 次のフレームで再実行 (よりスムーズなアニメーション処理)
      // 今回はタイミングが重要なため、setIntervalの代わりに使用
      requestAnimationFrame(tick);
    };

    const animationFrameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animationFrameId);
  }, []); // 依存配列は空で、マウント時に一度だけ実行

  return (
    <VisualContainer $isFlickering={isFlickering}>
      <FlickerText $isFlickering={isFlickering}>{currentWord}</FlickerText>
    </VisualContainer>
  );
};
export default FlickerVisualizer;
