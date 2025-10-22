'use clinet'

import React, { useState, useRef, useCallback } from 'react';
import { StageProps } from '../ctrl/page.tsx';
import { Stage, Layer, Line as KonvaLine, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type Konva from 'konva';

const SecondDraw: React.FC<StageProps> = ({ onComplete }) => {
	return(
		<div>
		<DrawingApp onComplete={onComplete}/>
		</div>
	)
};

type Tool = 'pen' | 'eraser';

interface LineData {
	tool: Tool;
	points: number[]; // [x1, y1, x2, y2, ...] の形式
}

function DrawingApp({onComplete}:StageProps) {
	const tool = 'pen';
	const [lines, setLines] = useState<LineData[]>([]);
	const isDrawing = useRef(false);

	const stageRef = useRef<Konva.Stage | null>(null);

	const getPointerPosition = (stage: Konva.Stage | null) => {
		return stage?.getPointerPosition() ?? { x: 0, y: 0 };
	};

	/**
	 * マウス・タッチ開始時の処理
	 */
	const handleMouseDown = useCallback((e: KonvaEventObject<MouseEvent | TouchEvent>) => {
		isDrawing.current = true;
		const stage = e.target.getStage();
		if (stage) {
			const pos = getPointerPosition(stage);
			// 新しいラインを追加
			setLines((prevLines) => [
				...prevLines,
				{ tool, points: [pos.x, pos.y] },
			]);
		}
	}, [tool]); // toolが変更されたら再生成

	/**
	 * マウス・タッチ移動時の処理
	 */
	const handleMouseMove = useCallback((e: KonvaEventObject<MouseEvent | TouchEvent>) => {
		if (!isDrawing.current) {
			return;
		}

		const stage = e.target.getStage();
		if (!stage) return;

		const point = getPointerPosition(stage);

		setLines((prevLines) => {
			// 1. 最後のラインのインデックスを取得
			const lastLineIndex = prevLines.length - 1;
			if (lastLineIndex < 0) return prevLines; // 念のためのチェック

			const lastLine = prevLines[lastLineIndex];

			// 2. 最後の LineData オブジェクトを不変に更新
			const newLine: LineData = {
				...lastLine, // 既存のプロパティをコピー
				// points配列に新しいポイントを追加して、新しい配列を作成
				points: lastLine.points.concat([point.x, point.y]), 
			};

			// 3. lines配列全体を不変に更新
			return [
				...prevLines.slice(0, lastLineIndex), // 最後の要素以外はそのままコピー
				newLine, // 完全に新しい LineData オブジェクトで置き換える
			];
		});
	}, []);

	/**
	 * マウス・タッチ終了時の処理
	 */
	const handleMouseUp = useCallback(() => {
		isDrawing.current = false;
	}, []);

	return (
		<div>
		<Stage
		width={globalThis.innerWidth}
		height={globalThis.innerWidth}
		onMouseDown={handleMouseDown}
		onMouseMove={handleMouseMove}
		onMouseUp={handleMouseUp}
		onTouchStart={handleMouseDown}
		onTouchMove={handleMouseMove}
		onTouchEnd={handleMouseUp}
		ref={stageRef}
		>
		<Layer>
		<Text text="Just start drawing" x={5} y={30} fontSize={16} fill="#000" />
		{lines.map((line, i) => (
			<KonvaLine // `Line`がHTML要素と競合する可能性があるので`KonvaLine`としてインポート
			key={i}
			points={line.points}
			stroke="#ffffff"
			strokeWidth={5} // Eraserは少し太くする
			tension={0.5}
			lineCap="round"
			lineJoin="round"
			/>
		))}
		</Layer>
		</Stage>
		</div>
	);
};

export default SecondDraw;
