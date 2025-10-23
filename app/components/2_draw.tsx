'use client'

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
// ⚠️ WASMモジュールのインポート。パスはプロジェクト構造に合わせてください。
// 例: import { find_nearest_point_on_path } from '@/wasm/pkg/snap_calculator'; 

// WASMモジュールが返すべき型を定義
interface NearestPointResult {
    x: number;
    y: number;
}
// find_nearest_point_on_path関数のダミー宣言 (WASMの実際のインポートに置き換え)
declare function find_nearest_point_on_path(
    path_d: string, 
    target_x: number, 
    target_y: number,
    max_distance: number
): NearestPointResult | null; 

// --- 型定義 ---
interface StageProps { onComplete: () => void; }
type Point = { x: number; y: number; };

interface LineData {
    id: number;
    tool: 'pen';
	points: Point[];      
	targetPoints: Point[]; 
}

// ⚠️ 実際のSVGのパスデータ。このパスデータに基づいてWASMが計算します。
const BACKGROUND_SVG_PATH_D = "M100 100 L400 100 L400 400 L100 400 Z"; 
const SNAPPING_DISTANCE_PIXELS = 50; // 吸着距離 (50px)

function DrawingApp({onComplete}: StageProps) {
	const [isClient, setIsClient] = useState(false);
    const lineIdCounter = useRef(0);
	const [lines, setLines] = useState<LineData[]>([]); 
	const [currentLines, setCurrentLines] = useState<LineData[]>([]); 

	const isDrawing = useRef(false);
	
	const animationRef = useRef<number>(0);
	const startTimeRef = useRef<number|undefined>(undefined);

	const stageRef = useRef<HTMLDivElement>(null);

    // Stageサイズはビューボックスの標準値として500を基準に、画面サイズに合わせてスケーリングします。
    const VIEWSBOX_SIZE = 500;
	const [stageSize, setStageSize] = useState(0);

	useEffect(() => {
		setIsClient(true);
		
		const handleResize = () => {
			if (typeof window !== 'undefined') {
				const size = Math.min(window.innerWidth, window.innerHeight);
				// 画面の小さい方に合わせて90%のサイズを設定
				setStageSize(size * 0.9);
			}
		};

		handleResize();
		window.addEventListener('resize', handleResize);

		return () => {
			window.removeEventListener('resize', handleResize);
		};
	}, []);


    // --- 座標変換ユーティリティ ---
    // 画面座標をSVGビューボックス座標にスケーリング
    const scaleToViewBox = useCallback((p: Point): Point => {
        if (stageSize === 0) return p;
        const scale = VIEWSBOX_SIZE / stageSize;
        return {
            x: p.x * scale,
            y: p.y * scale,
        };
    }, [stageSize]);

    // SVGビューボックス座標を画面座標にスケーリング
    const scaleToScreen = useCallback((p: Point): Point => {
        if (stageSize === 0) return p;
        const scale = stageSize / VIEWSBOX_SIZE;
        return {
            x: p.x * scale,
            y: p.y * scale,
        };
    }, [stageSize]);


    // ユーティリティ関数: マウス/タッチ座標の取得 (画面座標)
	const getPointerPosition = useCallback((e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent): Point | null => {
		if (!stageRef.current) return null;
		const rect = stageRef.current.getBoundingClientRect();
		
        let clientX: number, clientY: number;
        if ('touches' in e) {
            if (e.touches.length === 0) return null;
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

		return { x: clientX - rect.left, y: clientY - rect.top };
	}, []);


	// --- 吸着ロジック (WASM利用) ---
    const calculateNearestTargetPoint = useCallback((p: Point): Point => {
        // 描画点 (画面座標) を WASM に渡す前にビューボックス座標に変換
        const p_viewbox = scaleToViewBox(p);
        
        // ⚠️ WASMの代わりにダミー関数を使用
        /*
        const nearest_viewbox = find_nearest_point_on_path(
            BACKGROUND_SVG_PATH_D, 
            p_viewbox.x, 
            p_viewbox.y,
            SNAPPING_DISTANCE_PIXELS // 距離はビューボックス座標系で計算される
        );

        if (nearest_viewbox) {
            // 見つかったターゲット点 (ビューボックス座標) を画面座標に戻して返す
            return scaleToScreen(nearest_viewbox);
        }
        */

        // 吸着しない場合は元の点を返す
        return p; 

    }, [scaleToViewBox, scaleToScreen]); 

	const calculateTargetPoints = useCallback((points: Point[]): Point[] => {
        // 全点に対してターゲット点を計算
        return points.map(p => calculateNearestTargetPoint(p));
	}, [calculateNearestTargetPoint]);

	// --- イベントハンドラ（前回の実装を継承し、Konvaの型を削除） ---

    const handleMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
		isDrawing.current = true;
		const pos = getPointerPosition(e);
		if (pos) {
            lineIdCounter.current += 1;
            const newLine = { id: lineIdCounter.current, tool: 'pen' as const, points: [pos], targetPoints: [] };
			setLines(prev => [...prev, newLine]);
            setCurrentLines(prev => [...prev, newLine]);
		}
	}, [getPointerPosition]); 

	const handleMouseMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
		if (!isDrawing.current) return;
		const point = getPointerPosition(e);
		if (!point) return;

		const updateLines = (prevLines: LineData[]) => {
			const lastLineIndex = prevLines.length - 1;
			if (lastLineIndex < 0) return prevLines;
			const lastLine = prevLines[lastLineIndex];
			const newLine: LineData = { ...lastLine, points: [...lastLine.points, point] };
			return [...prevLines.slice(0, lastLineIndex), newLine];
		};

		setLines(updateLines);
        setCurrentLines(updateLines);

	}, [getPointerPosition]);

	const handleMouseUp = useCallback(() => {
		isDrawing.current = false;

		setLines((prevLines) => {
			const lastLineIndex = prevLines.length - 1;
			if (lastLineIndex < 0) return prevLines;
			const lastLine = prevLines[lastLineIndex];
            
			// 描画終了時にtargetPointsを計算
			const targetPoints = calculateTargetPoints(lastLine.points);

			const newLine: LineData = {
				...lastLine,
				targetPoints: targetPoints, 
			};
			return [...prevLines.slice(0, lastLineIndex), newLine];
		});
	}, [calculateTargetPoints]);
    
	// --- アニメーションロジック（前回の実装を継承） ---

	const animateLines = useCallback((timestamp: number) => {
		if (!startTimeRef.current) startTimeRef.current = timestamp;
		const elapsed = timestamp - startTimeRef.current;
		const duration = 1500; 
		const progress = Math.min(1, elapsed / duration);

		const newCurrentLines: LineData[] = lines.map((line) => {
			if (line.targetPoints.length === 0) return line;

			const newPoints: Point[] = line.points.map((originalP, index) => {
                const targetP = line.targetPoints[index];
				return {
                    x: originalP.x + (targetP.x - originalP.x) * progress,
                    y: originalP.y + (targetP.y - originalP.y) * progress,
                };
			});

			return { ...line, points: newPoints };
		});

		setCurrentLines(newCurrentLines);

		if (progress < 1) {
			animationRef.current = requestAnimationFrame(animateLines);
		} else {
			startTimeRef.current = undefined;
			// 移動後のラインを lines (マスターデータ)に反映
			setLines(newCurrentLines.map(line => ({ 
                ...line, 
                points: line.targetPoints, 
                targetPoints: [] 
            }))); 
		}
	}, [lines]);

	useEffect(() => {
		const lastLine = lines[lines.length - 1];
		if (lastLine?.targetPoints.length > 0 && startTimeRef.current === undefined) {
			startTimeRef.current = undefined;
			animationRef.current = requestAnimationFrame(animateLines);
		}

		return () => {
			if (animationRef.current) {
				cancelAnimationFrame(animationRef.current);
			}
		};
	}, [lines, animateLines]);

    // points配列を 'x1,y1 x2,y2 ...' 形式の文字列に変換するヘルパー
    const pointsToSvgString = (points: Point[]): string => {
        return points.map(p => `${p.x},${p.y}`).join(' ');
    };
    
	return (
		<div
			ref={stageRef}
			style={{
				width: stageSize,
				height: stageSize,
				margin: 'auto', 
				position: 'relative',
				border: '1px solid #ccc',
				overflow: 'hidden',
				touchAction: 'none', 
			}}
			onMouseDown={handleMouseDown}
			onMouseMove={handleMouseMove}
			onMouseUp={handleMouseUp}
			onTouchStart={handleMouseDown as any}
			onTouchMove={handleMouseMove as any}
			onTouchEnd={handleMouseUp}
		>
            {/* 1. 背景のSVG (模倣対象) - ビューボックスを使用 */}
			<svg width={stageSize} height={stageSize} viewBox={`0 0 ${VIEWSBOX_SIZE} ${VIEWSBOX_SIZE}`} style={{ position: 'absolute' }}>
				{/* BACKGROUND_SVG_PATH_Dは VIEWSBOX_SIZE の座標系で定義されていることを前提とする */}
				<path 
                    d={BACKGROUND_SVG_PATH_D} 
                    fill="none" 
                    stroke="black" 
                    strokeWidth="5" 
                    opacity="0.2"
                />
			</svg>

            {/* 2. ユーザーの描画 (アニメーション表示用) - ビューボックスを使用 */}
            <svg width={stageSize} height={stageSize} viewBox={`0 0 ${VIEWSBOX_SIZE} ${VIEWSBOX_SIZE}`} style={{ position: 'absolute', top: 0, left: 0 }}>
                {currentLines.map((line) => (
                    <polyline
                        key={line.id}
                        // 描画はビューボックス座標系で行われる
                        points={pointsToSvgString(line.points.map(scaleToViewBox))} 
                        fill="none"
                        stroke="#FF4500" 
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                ))}
            </svg>

			<button
				type="submit"
				onClick={onComplete}
                style={{ position: 'absolute', bottom: 10, left: 10 }}
			>
			完了 (onComplete)
			</button>
		</div>
	);
}

const SecondDraw: React.FC<StageProps> = (props) => {
	return <DrawingApp {...props} />;
};

export default SecondDraw;
