import { useEffect, useRef } from "react";
import { StageProps } from "../ctrl/page.tsx";

const AUDIO_SOURCE = '/audio/001.wav';

export default function FifthTitle({onComplete}:StageProps){
	const audioRef = useRef<HTMLAudioElement | null>(null);

	useEffect(() => {
		const audio = new Audio(AUDIO_SOURCE);
		audioRef.current = audio;

		const handleAudioEnded = () => {
			onComplete();
		};

		audio.addEventListener('ended', handleAudioEnded);

		// ユーザーインタラクションの直後に再生を開始
		// コンポーネントがロードされただけではブラウザの制限で再生できないため、
		// ユーザーの最初の描画操作をトリガーとして再生を開始するのがより安全ですが、
		// 今回はシンプルにロード時に再生を試みます。
		const playAudio = () => {
			audio.play().catch(e => console.log("Audio playback failed (may require user interaction):", e));
		};

		// ロード完了を待って再生を試みる
		audio.oncanplaythrough = playAudio;

		// アンマウント時のクリーンアップ
		return () => {
			audio.pause();
			audio.removeEventListener('ended', handleAudioEnded);
			audioRef.current = null;
		};
	}, [onComplete]);

	return (
		<nav style={{width:"100vw",height:"100vh", display:"flex", justifyContent:"center", alignItems:"center"}}>
		<h1 style={{fontSize:"8rem"}}>
		AIdentity
		</h1>
		</nav>
	);
};
