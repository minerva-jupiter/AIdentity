'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sky, ContactShadows, Cloud, Clouds } from '@react-three/drei'; 
import BenchScene from './BenchScene.tsx';
import { useState, useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three'; 
import { StageProps } from '../ctrl/page.tsx';

// --- オーディオ関連の定数とカスタムフック ---
const AUDIO_SOURCES: Record<number, string> = {
    2: '/audio/002.wav',
};

// シーケンシャルな音声再生と状態遷移を制御するカスタムフック (修正版)
const useSequentialAudio = (initialState: number, audioSources: Record<number, string>, onComplete: () => void) => {
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

        console.log(`Starting setup for state ${sceneState}: ${currentAudioUrl}`);

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
            setSceneState(prev => prev + 1);
        };

        audio.addEventListener('ended', handleAudioEnded);
        
        // --- 4. 再生の開始 ---
        // ロードやイベントを待たずに、すぐに再生を試みる
        audio.play().catch(e => {
            console.warn(`Audio playback failed for state ${sceneState} (requires user interaction):`, e);
            // ユーザーに最初のクリックを促すメッセージなどを表示すると良い
        });


        // --- 5. クリーンアップ関数 ---
        return () => {
            // アンマウント/状態遷移時に現在のAudioオブジェクトを確実に停止し、リスナーを削除
            if (audio === audioRef.current) { // 現在設定したAudioオブジェクトであることを確認
                 audio.pause();
                 audio.removeEventListener('ended', handleAudioEnded);
            }
        };
        
    }, [sceneState, audioSources, onComplete]); // sceneStateとcurrentAudioUrlは基本的に連動するため、sceneStateを依存配列に含める

    return sceneState;
};

// 雲のランダム生成のための型
interface RandomCloudsProps {
    count: number;
    radius: number;
    height: number;
	sceneState: number;
}


// 状態に応じてライトと霧を制御するコンポーネント
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


function AnimatedSky({sceneState}:{sceneState:number}) {
    const [sunPosition, setSunPosition] = useState<[number, number, number]>([0, 100, 0]);

    useFrame(({ clock }) => {
        const time = clock.getElapsedTime() * 0.1;
        const x = Math.sin(time) * 100;
        const z = Math.cos(time) * 100;
        setSunPosition([x, 100, z]); 
    });

	if (sceneState === 2){
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


function RandomClouds({ count, radius, height, sceneState }: RandomCloudsProps) {
	const cloudColor = sceneState === 2 ? '#080808' : '#fff';
	const baseOpacity = sceneState === 2 ? 0.9 : 0.5;

    const cloudConfigs = useMemo(() => {
        return Array.from({ length: count }).map((_, i) => {
            const angle = Math.random() * Math.PI * 2; 
            const distance = Math.sqrt(Math.random()) * radius; 

            const x = Math.cos(angle) * distance;
            const z = Math.sin(angle) * distance;

            return {
                position: [
                    x,
                    height + (Math.random() - 0.5) * 5, 
                    z,
                ] as [number, number, number],
                
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


export default function ThreeVR({onComplete}:StageProps) {
    // 💡 状態定義: number型
    const sceneState = useSequentialAudio(2, AUDIO_SOURCES, onComplete);

    return (
            <Canvas 
                key="r3f-main-canvas" 
                camera={{ position: [5, 5, 5], fov: 60 }}
                shadows 
                // 霧の状態によってクリアカラー（背景色）を変える
                style={{ background: sceneState === 2 ? '#050507' : '#d0e0ff' }}
            >
                <AnimatedSky sceneState={sceneState}/>
                
                <Clouds material={THREE.MeshLambertMaterial} limit={200}> 
                    <RandomClouds count={100} radius={80} height={15} sceneState={sceneState}/> 
                </Clouds>
                
                {/* 💡 SceneControllerを配置し、状態を渡す */}
                <SceneController sceneState={sceneState} />
                
                <BenchScene />
                <ContactShadows position={[0, -0.5, 0]} opacity={0.7} scale={10} blur={1} far={10} />
                <OrbitControls enableZoom={true} enablePan={true} enableRotate={true} />
                
            </Canvas>
    );
}
