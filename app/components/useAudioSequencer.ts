import { useState, useEffect, useRef, useCallback } from 'react';

interface AudioCacheEntry {
    buffer: AudioBuffer;
    url: string; // 元のURLを保持
}

// Web Audio APIのインスタンスを管理するフック
const useAudioSequencer = (currentAudioUrl: string | null) => {
    // AudioContext、再生中のノード、ロード済みのバッファを保持
    const contextRef = useRef<AudioContext | null>(null);
    const sourceRef = useRef<AudioBufferSourceNode | null>(null);
    const bufferCache = useRef<Map<string, AudioCacheEntry>>(new Map());

    const [isPlaying, setIsPlaying] = useState(false);
    const [isSwitching, setIsSwitching] = useState(false);

    // AudioContextの初期化
    useEffect(() => {
        if (typeof globalThis !== 'undefined' && !contextRef.current) {
            contextRef.current = new (globalThis.AudioContext || (globalThis as any).webkitAudioContext)();
        }
    }, []);

    // 音源をロードし、AudioBufferにデコードする関数
    const loadAudio = useCallback(async (url: string): Promise<AudioBuffer> => {
        if (bufferCache.current.has(url)) {
            return bufferCache.current.get(url)!.buffer;
        }
        
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = await contextRef.current!.decodeAudioData(arrayBuffer);
        
        bufferCache.current.set(url, { buffer, url });
        return buffer;
    }, []);

    // 再生を開始・切り替えするメインロジック
	const playSource = (
		buffer: AudioBuffer, 
		context: AudioContext, 
		onEndCallback: () => void // 再生終了時に呼び出すコールバック
	) => {
		const source = context.createBufferSource();
		source.buffer = buffer; 
		// source.loop = true; // ❌ 標準のループ機能を無効化して手動で実装。

		source.connect(context.destination);

		// onended イベントをフックして、手動ループまたはシーケンス制御を行う
		source.onended = onEndCallback; 

		source.start(0); 
		return source;
	};

	// ループを解除し、現在の再生が終了するのを待つ
	const endLoopAndAwaitCompletion = useCallback((): Promise<void> => {
		const source = sourceRef.current;
		if (!source || !isPlaying) {
			return Promise.resolve();
		}

		// ループを無効化
		source.loop = false;

		return new Promise((resolve) => {
			// onended が発火するのを待つ
			source.onended = () => {
				sourceRef.current = null;
				setIsPlaying(false);
				resolve();
			};
		});
	}, [isPlaying]);

	// currentAudioUrl の変更監視
	// useAudioSequencer.ts の useEffect の修正

	useEffect(() => {
		let active = true;
		let isLooping = true; // 💡 手動ループの状態管理用フラグ

		const context = contextRef.current;
		if (!context) return;

		// 💡 関数: 現在の音源が終了したときに呼ばれるコールバック
		const handleSourceEnded = () => {
			// 現在のノードをクリア
			sourceRef.current = null;

			// 1. ループ継続が許可されている場合、即座に同じ音源を再再生（手動ループ）
			if (isLooping && currentAudioUrl) {
				console.log("-> 手動ループ: 同じ音源を再再生");
				sequencePlayback(currentAudioUrl, true);
			} else {
				// 2. ループが解除されている場合、外部の待機処理（Promise）を完了させる
				//    このとき、Promiseの解決は外部のendLoopAndAwaitCompletionで処理されます。
				setIsPlaying(false);
				// 何もしないことで、onendedイベントが外部のPromiseを解決するのを待つ
			}
		};

		// 💡 関数: 再生シーケンスの開始
		const sequencePlayback = async (url: string, isLoopRestart: boolean = false) => {
			if (!active || !context) return;

			try {
				const buffer = await loadAudio(url);

				// 💡 停止中の場合は、古いノードを破棄してから新しいノードを作成
				if (!isLoopRestart && sourceRef.current) {
					// 新しいURLが来たら、古いノードを停止
					sourceRef.current.stop(context.currentTime); 
				}

				// 新しい音源の再生開始
				const newSource = playSource(buffer, context, handleSourceEnded);
				sourceRef.current = newSource;
				setIsPlaying(true);
				setIsSwitching(false);

			} catch (error) {
				console.error('Audio playback failed:', error);
				setIsPlaying(false);
				setIsSwitching(false);
			}
		};

		// 💡 関数: ループを解除し、現在の再生が終了するのを待つ (Promiseを返す)
		const endLoopAndAwaitCompletion = (): Promise<void> => {
			if (!sourceRef.current || !isPlaying) {
				return Promise.resolve();
			}

			// 💡 重要な修正: ループフラグを false に設定することで、handleSourceEndedで再ループが起こるのを防ぐ
			isLooping = false; 

			return new Promise((resolve) => {
				// 現在再生中のノードが終了した時に resolve するための処理
				// handleSourceEndedが呼ばれ、その中で isLooping=false の処理が走るのを待つ。
				// 💡 ここで onended を直接上書きするのではなく、元の handleSourceEnded の動作に依存させる
				sourceRef.current!.onended = () => {
					sourceRef.current = null;
					setIsPlaying(false);
					resolve();
				};
			});
		};

		const getCurrentAudioUrl = (buffer: AudioBuffer): string | undefined => {
			for (const [url, entry] of bufferCache.current.entries()) {
				if (entry.buffer === buffer) {
					return url;
				}
			}
			return undefined;
		};

		// 💡 メイン処理: currentAudioUrlの変更を監視
		const mainSequence = async () => {
			if (!currentAudioUrl) {
				sourceRef.current?.stop();
				sourceRef.current = null;
				setIsPlaying(false);
				return;
			}

			setIsSwitching(true);

			// 1. URLが変わった場合、古い音源の終了を待つ
			if (sourceRef.current && sourceRef.current.buffer) {

				// 💡 修正されたチェックロジック
				const currentUrl = getCurrentAudioUrl(sourceRef.current.buffer);

				// 現在のURLが新しいURLと異なる場合
				if (currentUrl && currentUrl !== currentAudioUrl) {
					// ループを切り、終了を待機
					isLooping = false; // ループを停止
					await endLoopAndAwaitCompletion(); 
				}
			}

			if (!active) return;

			// 2. 新しい音源の再生開始
			isLooping = true;
			sequencePlayback(currentAudioUrl);
			setIsSwitching(false);
		};

		if (currentAudioUrl) {
			mainSequence();
		}

		return () => {
			active = false;
			// ... (クリーンアップ)
		};
	}, [currentAudioUrl, loadAudio]); // 依存配列はシンプルに保つ

	return { 
		isPlaying, 
		isSwitching, 
		stop: () => sourceRef.current?.stop(),
			endLoopAndAwaitCompletion,
	};
};

export default useAudioSequencer;
