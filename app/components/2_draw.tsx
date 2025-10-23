'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react';
import init, { find_nearest_point_on_path, NearestPointResult } from '../../rust-wasm/pkg/rust_wasm.js';
import { StageProps } from '../ctrl/page.tsx';

type Tool = 'pen';
type Point = { x: number; y: number; }; 

interface LineData {
    id: number;
    tool: Tool;
	points: Point[];      
	targetPoints: Point[]; 
}

const BACKGROUND_SVG_PATH_D_DEFAULT = ""; 
const VIEWSBOX_SIZE = 500; 
const SNAPPING_DISTANCE_PIXELS = 30; 


function DrawingApp({onComplete}: StageProps) {
	const [isClient, setIsClient] = useState(false);
    const lineIdCounter = useRef(0);
	const [lines, setLines] = useState<LineData[]>([]); 
	const [currentLines, setCurrentLines] = useState<LineData[]>([]); 

    const [stageWidth, setStageWidth] = useState(0);
    const [stageHeight, setStageHeight] = useState(0);
    const [backgroundPathD, setBackgroundPathD] = useState(BACKGROUND_SVG_PATH_D_DEFAULT); 
    const [viewBoxSize, setViewBoxSize] = useState(VIEWSBOX_SIZE); 
    
	const isDrawing = useRef(false);
	
	const animationRef = useRef<number>(0);
	const startTimeRef = useRef<number|undefined>(undefined);

	const stageRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		init();
	},[])

	// --- 1. サイズ計算とステージ設定 (画面全体を使用) ---
	useEffect(() => {
		setIsClient(true);
		
		const handleResize = () => {
			if (typeof globalThis !== 'undefined') {
				setStageWidth(globalThis.innerWidth);
				setStageHeight(globalThis.innerHeight);
			}
		};

		handleResize();
		globalThis.addEventListener('resize', handleResize);

		return () => {
			globalThis.removeEventListener('resize', handleResize);
		};
	}, []);
    
    // --- 2. 座標変換ユーティリティ ---
    
    const scaleToViewBox = useCallback((p: Point): Point => {
        if (stageWidth === 0 || stageHeight === 0) return p;
        
        const effectiveSize = Math.min(stageWidth, stageHeight);
        const scale = viewBoxSize / effectiveSize;

        const offsetX = (stageWidth - effectiveSize) / 2;
        const offsetY = (stageHeight - effectiveSize) / 2;

        return {
            x: (p.x - offsetX) * scale,
            y: (p.y - offsetY) * scale,
        };
    }, [stageWidth, stageHeight, viewBoxSize]);

    const scaleToScreen = useCallback((p: Point): Point => {
        if (stageWidth === 0 || stageHeight === 0) return p;

        const effectiveSize = Math.min(stageWidth, stageHeight);
        const scale = effectiveSize / viewBoxSize;
        
        const offsetX = (stageWidth - effectiveSize) / 2;
        const offsetY = (stageHeight - effectiveSize) / 2;

        return {
            x: p.x * scale + offsetX,
            y: p.y * scale + offsetY,
        };
    }, [stageWidth, stageHeight, viewBoxSize]);

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
    
    // --- 3. SVGコンテンツの取得ロジック (DOMParser) ---
    useEffect(() => {
        const fetchAndParseSvg = async () => {
            try {
                const response = await fetch('/whiteperson.svg'); 
                const svgText = await response.text();

                const parser = new DOMParser();
                const doc = parser.parseFromString(svgText, "image/svg+xml");
                
                const svgElement = doc.querySelector('svg');
                if (svgElement) {
                    const viewBoxAttr = svgElement.getAttribute('viewBox');
                    if (viewBoxAttr) {
                        const parts = viewBoxAttr.trim().split(/\s+/);
                        if (parts.length === 4) {
                             const size = Math.max(parseFloat(parts[2]), parseFloat(parts[3]));
                             if (!isNaN(size) && size > 0) {
                                 setViewBoxSize(size);
                             }
                        }
                    }
                }
                
                const pathElements = doc.querySelectorAll('path');
                let foundDValue = null;

                for (const element of Array.from(pathElements)) {
                    const dValue = element.getAttribute('d');
                    if (dValue && dValue.trim().length > 0) {
                        foundDValue = dValue;
                        break; 
                    }
                }

                if (foundDValue) {
                    setBackgroundPathD(foundDValue);
                    return; 
                }
                
                console.error("Error: <path> element or 'd' attribute not found in whiteperson.svg.");

            } catch (error) {
                console.error("Failed to load or parse whiteperson.svg:", error);
            }
        };

        if (isClient && backgroundPathD === "") { 
             fetchAndParseSvg();
        }
    }, [isClient, backgroundPathD]);


    // --- 4. 吸着ロジック (WASM呼び出し) ---
    const calculateNearestTargetPoint = useCallback((p: Point): Point => {
        const p_viewbox = scaleToViewBox(p);
        
        const effectiveSize = Math.min(stageWidth, stageHeight);
        const snapping_distance_viewbox = SNAPPING_DISTANCE_PIXELS * (viewBoxSize / effectiveSize);

        // ⚠️ WASM呼び出し
        const nearest_viewbox: NearestPointResult | null = find_nearest_point_on_path(
            backgroundPathD, 
            p_viewbox.x, 
            p_viewbox.y,
            snapping_distance_viewbox
        );
		console.log("nearest_viewbox is ",nearest_viewbox);

        if (nearest_viewbox) {
            return scaleToScreen(nearest_viewbox);
        }
        return p; 
    }, [scaleToViewBox, scaleToScreen, stageWidth, stageHeight, viewBoxSize, backgroundPathD]); 

	const calculateTargetPoints = useCallback((points: Point[]): Point[] => {
        return points.map(p => calculateNearestTargetPoint(p));
	}, [calculateNearestTargetPoint]);


    // --- 5. イベントハンドラ (吹き飛んでいた部分を再定義) ---

    /**
	 * マウス・タッチ開始時の処理
	 */
    const handleMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
		isDrawing.current = true;
		const pos = getPointerPosition(e);
		if (pos) {
            lineIdCounter.current += 1;
            const newLine: LineData = { id: lineIdCounter.current, tool: 'pen', points: [pos], targetPoints: [] };
			setLines(prev => [...prev, newLine]);
            setCurrentLines(prev => [...prev, newLine]);
		}
	}, [getPointerPosition]); 

    /**
	 * マウス・タッチ移動時の処理
	 */
	const handleMouseMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
		if (!isDrawing.current) return;
		const point = getPointerPosition(e);
		if (!point) return;

		const updateLines = (prevLines: LineData[]) => {
			const lastLineIndex = prevLines.length - 1;
			if (lastLineIndex < 0) return prevLines;
			const lastLine = prevLines[lastLineIndex];
			const newPoints: Point[] = [...lastLine.points, point];
			return [...prevLines.slice(0, lastLineIndex), { ...lastLine, points: newPoints }];
		};
        
		setLines(updateLines);
        setCurrentLines(updateLines);

	}, [getPointerPosition]);

    /**
	 * マウス・タッチ終了時の処理
	 */
	const handleMouseUp = useCallback(() => {
		isDrawing.current = false;

		setLines((prevLines) => {
			const lastLineIndex = prevLines.length - 1;
			if (lastLineIndex < 0) return prevLines;
			const lastLine = prevLines[lastLineIndex];
			
			const targetPoints = calculateTargetPoints(lastLine.points);

			const newLine: LineData = {
				...lastLine,
				targetPoints: targetPoints, 
			};
			return [...prevLines.slice(0, lastLineIndex), newLine];
		});
	}, [calculateTargetPoints]);
    
	// --- 6. アニメーションロジック (変更なし) ---

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


    const pointsToSvgString = (points: Point[]): string => {
        return points.map(p => `${p.x},${p.y}`).join(' ');
    };
    
	return (
		<div
			ref={stageRef}
			style={{
				width: stageWidth,
				height: stageHeight,
				margin: 0,
				position: 'fixed',
                top: 0,
                left: 0,
				overflow: 'hidden',
				touchAction: 'none', 
			}}
			onMouseDown={handleMouseDown}
			onMouseMove={handleMouseMove}
			onMouseUp={handleMouseUp}
			onTouchStart={handleMouseDown}
			onTouchMove={handleMouseMove}
			onTouchEnd={handleMouseUp}
		>
            {/* 1. 背景のSVG (模倣対象) */}
			{backgroundPathD && (
                <svg 
                    width={stageWidth} 
                    height={stageHeight} 
                    viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`} 
                    style={{ position: 'absolute' }}
                    preserveAspectRatio="xMidYMid meet" 
                >
                    <path 
                        d={backgroundPathD} 
                        fill="none" 
                        stroke="white" 
                        strokeWidth="5" 
                        opacity="0.2"
                    />
                </svg>
			)}

            {/* 2. ユーザーの描画 (アニメーション表示用) */}
            <svg width={stageWidth} height={stageHeight} viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`} style={{ position: 'absolute', top: 0, left: 0 }}
                 preserveAspectRatio="xMidYMid meet"
            >
                {currentLines.map((line) => (
                    <polyline
                        key={line.id}
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
                style={{ position: 'fixed', bottom: 10, left: 10 }}
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
