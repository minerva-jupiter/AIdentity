'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sky, ContactShadows, Cloud, Clouds } from '@react-three/drei'; 
import BenchScene from '../components/BenchScene';
import { useState, useMemo } from 'react';
import * as THREE from 'three'; 


function AnimatedSky() {
    // このコンポーネントはそのまま維持し、空のグラデーションと太陽をアニメーションさせます。
    const [sunPosition, setSunPosition] = useState<[number, number, number]>([0, 100, 0]);

    useFrame(({ clock }) => {
        const time = clock.getElapsedTime() * 0.1;
        const x = Math.sin(time) * 100;
        const z = Math.cos(time) * 100;
        setSunPosition([x, 100, z]); 
    });

    return (
        <Sky
            distance={450000} 
            sunPosition={new THREE.Vector3(...sunPosition)} 
            inclination={0.6} 
            azimuth={0.25} 
            mieCoefficient={0.005} 
            mieDirectionalG={0.8} 
            rayleigh={0.5} 
            turbidity={10} 
        />
    );
}

// 必要なプロパティ: 雲の数、空の範囲の半径、雲の高さ
interface RandomCloudsProps {
    count: number;
    radius: number;
    height: number;
}

function RandomClouds({ count, radius, height }: RandomCloudsProps) {
    const cloudConfigs = useMemo(() => {
        return Array.from({ length: count }).map((_, i) => {
            // 💡 修正点: 極座標 (角度と距離) を使って円形に均一に分布させる

            // 1. 角度 (0 から 2π) をランダムに決定
            const angle = Math.random() * Math.PI * 2; 

            // 2. 距離 (0 から radius) をランダムに決定 (二乗根で遠くへ均一に分布)
            // Math.sqrt() を使うことで、原点付近への集中を避け、円内での分布を均一にします
            const distance = Math.sqrt(Math.random()) * radius; 

            // 3. 極座標を直交座標 (X, Z) に変換
            const x = Math.cos(angle) * distance;
            const z = Math.sin(angle) * distance;

            return {
                // 新しいランダムなX, Z座標
                position: [
                    x,
                    height + (Math.random() - 0.5) * 5, 
                    z,
                ] as [number, number, number],
                
                // ... (bounds などの他の設定はそのまま)
                bounds: [
                    Math.random() * 10 + 10,
                    Math.random() * 2 + 1,
                    Math.random() * 10 + 10,
                ] as [number, number, number],
                seed: Math.floor(Math.random() * 1000) + i, 
                volume: Math.random() * 20 + 5, 
                opacity: Math.random() * 0.4 + 0.5,
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

export default function ThreeVR() {
    return (
            <Canvas 
                camera={{ position: [5, 5, 5], fov: 60 }}
                shadows 
            >
                {/* 太陽と空 */}
                <AnimatedSky />
                

				<Clouds material={THREE.MeshLambertMaterial} limit={400}> {/* limitで最大雲数を設定 */}
				<RandomClouds count={100} radius={80} height={15} /> {/* 100個の雲を半径80の範囲、高さ15に生成 */}
				</Clouds>


				{/* ライトとモデル */}
				<ambientLight intensity={0.5} />
				<directionalLight 
				position={[5, 10, 5]} 
				intensity={2}         
				castShadow            
				shadow-mapSize-width={2048} 
				shadow-mapSize-height={2048} 
				shadow-camera-far={50} 
				shadow-camera-left={-10}
				shadow-camera-right={10}
				shadow-camera-top={10}
				shadow-camera-bottom={-10}
				/>

				<BenchScene />
				<ContactShadows position={[0, -0.5, 0]} opacity={0.7} scale={10} blur={1} far={10} />
				<OrbitControls enableZoom={true} enablePan={true} enableRotate={true} />

				</Canvas>
	);
}
