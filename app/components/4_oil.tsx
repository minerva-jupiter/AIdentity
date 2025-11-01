import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { OilArtAPI, OilArtPlane } from "./OilArt/OilArtPlane.tsx";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { StageProps } from "../ctrl/page.tsx";
// --- オーディオ関連の定数とカスタムフック ---
const AUDIO_SOURCES: Record<number, string> = {
	1: "/audio/001.wav",
	2: "/audio/002.wav",
};
// シーケンシャルな音声再生と状態遷移を制御するカスタムフック (修正版)
const useSequentialAudio = (
	initialState: number,
	audioSources: Record<number, string>,
	onComplete: () => void,
) => {
	const [sceneState, setSceneState] = useState(initialState);
	const audioRef = useRef<HTMLAudioElement | null>(null);
	// 現在の状態に対応する音源のURLを取得
	const currentAudioUrl = audioSources[sceneState];
	// 音声再生のロジック
	useEffect(() => {
		// --- 1. 終了条件のチェック ---
		if (sceneState > Math.max(...Object.keys(audioSources).map(Number))) {
			// 定義された全ての音源が再生された後、onCompleteを実行
			console.log("All audio finished. Calling onComplete.");
			onComplete();
			return;
		}
		// 現在の状態に対応する音源がない場合、ここで処理を停止
		if (!currentAudioUrl) {
			return;
		}
		console.log(
			`Starting setup for state ${sceneState}: ${currentAudioUrl}`,
		);
		// --- 2. 古いAudioオブジェクトのクリーンアップ ---
		const existingAudio = audioRef.current;
		if (existingAudio) {
			existingAudio.pause();
			// イベントリスナーの削除 (次のステップで新しいAudioオブジェクトにリスナーを設定するため)
			// このクリーンアップが重要です。古いAudioオブジェクトが'ended'イベントをトリガーするのを防ぎます。
			// `oncanplaythrough`リスナーはここでは不要ですが、もしあれば削除すべきです。
			// Audioオブジェクトのライフサイクルを明確にするため、毎回新しいインスタンスを生成します。
		}
		// --- 3. 新しいAudioオブジェクトの作成と設定 ---
		const audio = new Audio(currentAudioUrl);
		audioRef.current = audio;
		// 再生が終了したときのハンドラを定義
		const handleAudioEnded = () => {
			console.log(`Audio ${sceneState} finished. Transitioning state.`);
			// 次の状態へ遷移 (例: 1 -> 2, 2 -> 3)
			setSceneState((prev) => prev + 1);
		};
		audio.addEventListener("ended", handleAudioEnded);
		// --- 4. 再生の開始 ---
		// ロードやイベントを待たずに、すぐに再生を試みる
		audio.play().catch((e) => {
			console.warn(
				`Audio playback failed for state ${sceneState} (requires user interaction):`,
				e,
			);
			// ユーザーに最初のクリックを促すメッセージなどを表示すると良い
		});
		// --- 5. クリーンアップ関数 ---
		return () => {
			// アンマウント/状態遷移時に現在のAudioオブジェクトを確実に停止し、リスナーを削除
			if (audio === audioRef.current) { // 現在設定したAudioオブジェクトであることを確認
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
		// 外部API経由でランダムな滴下を定期的に実行
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
				// 傾きもランダムに変更
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
