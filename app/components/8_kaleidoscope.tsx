'use client'; // Next.jsでクライアントコンポーネントとしてマーク

import { Canvas, useFrame, extend } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

// three.jsのShaderMaterialをReact Three Fiberで使えるように拡張
extend({ ShaderMaterial: THREE.ShaderMaterial }); 

// ----------------------------------------------------
// 🌟 1. 頂点シェーダー (Vertex Shader) 🌟
// ----------------------------------------------------
const vertexShader = `
// NOTE: Three.jsが自動的に以下の組み込み変数を渡すため、
// 以下の行を削除します:
// attribute vec3 position;
// attribute vec2 uv;

// Three.jsの組み込み変数を利用する宣言は残す
// Three.jsはジオメトリから取得したuvを自動的にvarying vUvに渡すための
// 組み込み変数として扱ってくれるため、カスタムシェーダーではvaryingのみを定義します。

varying vec2 vUv; 
// 組み込み変数 (attributes) はカスタムシェーダーでは宣言せず、
// 以下のように直接使用します。
// * Three.jsの組み込み attribute: position, uv, normal...
// * Three.jsの組み込み uniform: modelMatrix, projectionMatrix...

void main() {
    // 組み込みの uv を varying vUv に格納
    vUv = uv; 
    
    // 組み込みの行列を使って頂点位置を計算
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;


// ----------------------------------------------------
// 🌟 2. フラグメントシェーダー (Fragment Shader) 🌟
// ----------------------------------------------------
const fragmentShader = `

uniform float u_time;
uniform vec2 u_resolution;
varying vec2 vUv;
const float PI = 3.14159265359;

// ---------------------------
// 歪み用のノイズ関数 (Simplex Noise 簡易版)
// ---------------------------
// ノイズは万華鏡の中心座標をぐにゃぐにゃと歪ませるために使う
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    
    // 🌟 修正: Quintic (6x^5) から Cubic (3x^2) へ変更 🌟
    vec2 u = f * f * (3.0 - 2.0 * f); 
    // u = smoothstep(0.0, 1.0, f); と同じ

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// ---------------------------
// 万華鏡パターン生成関数
// ---------------------------
vec2 kaleidoscope(vec2 p, float segments) {
    // 1. 極座標に変換
    float radius = length(p);
    float theta = atan(p.y, p.x);
    
    // 2. 時間で回転
    theta += u_time * 3.0; 

    // 3. 分割数で角度を正規化し、ミラーリングを適用
    theta /= (2.0 * PI / segments);
    theta = fract(theta) - 0.5;
    theta = abs(theta) * 2.0;
    
    // 4. 新しい極座標を返す
    return vec2(theta, radius);
}


void main() {
    // 1. 座標の準備とアスペクト比の補正
    vec2 p = vUv * 2.0 - 1.0; 
    float aspect = u_resolution.x / u_resolution.y;
    p.x *= aspect; 
    
    // ---------------------------
    // 🌟 歪みの追加 🌟
    // ---------------------------
    // 時間と共にノイズが変化し、万華鏡全体を歪ませる
    vec2 noiseUV = p * 1.5 + u_time * 0.1;
    // ノイズをサンプリングし、座標 p に加算して歪みを発生させる
    float distortion = noise(noiseUV) * 0.25; 
    p += distortion; 
    
    
    // ---------------------------
    // 🌟 1. 中心からのパターン 🌟
    // ---------------------------
    vec2 k1 = kaleidoscope(p, 10.0); // 分割数 10
    
    // パターン1の色
    float h1 = k1.x + k1.y * 0.5 + u_time * 0.2;
    vec3 color1 = 0.5 + 0.5 * cos(6.283 * (vec3(h1, h1 + 0.33, h1 + 0.66) * 0.3 + 0.5));
    
    
    // ---------------------------
    // 🌟 2. 中心でない場所からの放射状パターン 🌟
    // ---------------------------
    // 新しい中心を設定 (画面左上に時間でゆっくりと移動)
    vec2 offsetCenter = vec2(-0.8 * aspect, 0.6);
    
    // p から offsetCenter へのベクトルを計算
    vec2 p2 = p - offsetCenter; 

    // 新しい中心から万華鏡パターンを生成 (分割数 6)
    vec2 k2 = kaleidoscope(p2, 6.0); 

    // パターン2の色
    // k2.y (半径) の値が小さいほど明るくなるように調整
    float brightness = smoothstep(0.5, 0.0, k2.y);
    vec3 color2 = vec3(1.0, 0.7, 0.3) * brightness; // 暖色系の放射
    
    
    // ---------------------------
    // 🌟 3. 色の合成 🌟
    // ---------------------------
    // パターン1とパターン2を単純に加算合成 (Add Blend)
    vec3 finalColor = color1 + color2 * 1.5; 

    // 外側を暗くする (ケラレ効果)
    finalColor *= (1.0 - length(p) * 0.3);

    gl_FragColor = vec4(finalColor, 1.0);
}
`;

// ----------------------------------------------------
// 🌟 3. R3F コンポーネントの修正 🌟
// ----------------------------------------------------
const KaleidoscopeMesh = () => {
  const meshRef = useRef<THREE.Mesh>(null!);
  
  const uniforms = useMemo(
    () => ({
      u_time: { value: 0.0 },
      u_resolution: { value: new THREE.Vector2(0, 0) },
      // 🌟 追加: 中心点 (初期値は少し左上にずらす) 🌟
      u_center: { value: new THREE.Vector2(-0.2, 0.3) }, 
    }),
    []
  );

  useFrame(({ clock, size }) => {
    if (meshRef.current) {
        const material = meshRef.current.material as THREE.ShaderMaterial;
        material.uniforms.u_time.value = clock.getElapsedTime();
        material.uniforms.u_resolution.value.set(size.width, size.height);
        
        // 🌟 おまけ: 中心点を時間でゆっくり動かす 🌟
        // Wevalの曲のような有機的な動きを追加
        const time = clock.getElapsedTime();
        material.uniforms.u_center.value.x = Math.sin(time * 0.3) * 0.5;
        material.uniforms.u_center.value.y = Math.cos(time * 0.25) * 0.4;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]} scale={2}>
      <planeGeometry args={[1, 1]} /> 
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};


// Next.jsページで呼び出すR3F Canvasコンポーネント
export default function KaleidoscopeScene() {
  return (
    <div style={{ width: '100%', height: '100vh', background: '#000' }}>
      <Canvas 
        // カメラは原点から1だけZ軸方向に離し、メッシュ全体が見えるようにする
        camera={{ position: [0, 0, 1], fov: 75 }} 
      >
        <KaleidoscopeMesh />
      </Canvas>
    </div>
  );
};
