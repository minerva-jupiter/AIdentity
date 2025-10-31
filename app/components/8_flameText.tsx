import React, { useRef } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import * as THREE from 'three';

// Three.jsのShaderMaterialをR3Fで使えるように拡張
extend({ ShaderMaterial: THREE.ShaderMaterial });

// ---------------------------------------------------------------- //
//                               GLSL シェーダー                    //
// ---------------------------------------------------------------- //

// 頂点シェーダー (画面全体を覆う板ポリゴン用)
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// フラグメントシェーダー (炎と熱ゆらぎの表現)
// Source: 共通のGLSLノイズ関数と炎のアルゴリズムを簡略化して使用
const fragmentShader = `
  uniform float uTime;
  uniform vec2 uResolution;
  varying vec2 vUv;

  // 簡略化された擬似ランダムノイズ関数
  float rand(vec2 n) {
    return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
  }

  // ノイズを重ねて流れを作るFBM関数
  float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    
    vec2 u = f * f * (3.0 - 2.0 * f);
    
    float a = rand(i);
    float b = rand(i + vec2(1.0, 0.0));
    float c = rand(i + vec2(0.0, 1.0));
    float d = rand(i + vec2(1.0, 1.0));
    
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  // 炎のテクスチャを生成
  float fbm(vec2 st) {
    float v = 0.0;
    float a = 0.5;
    vec2 r = mat2(1.5, 0.8, -0.8, 1.5) * st; // 回転とスケールで流れを作る
    for (int i = 0; i < 4; ++i) { // 4層のノイズを重ねる
      v += a * noise(st);
      st *= 2.0;
      a *= 0.5;
      st += r; 
    }
    return v;
  }

  void main() {
    // 画面アスペクト比補正 (uv.xが0.0から1.0になるように)
    vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;

    // 時間によるゆらぎを加えたノイズ
    float n = fbm(uv * vec2(1.0, 2.0) - vec2(0.0, uTime * 0.3));

    // 炎の形状 (下から上へ)
    float mask = pow(1.0 - uv.y * 1.5, 3.0); // 下部を明るく、上部を暗く
    float fire = n * mask * 5.0; // ノイズにマスクをかけ、強度を上げる

    // 熱ゆらぎの表現 (UV座標をノイズで歪ませる)
    vec2 distortedUv = uv + n * 0.005; 
    float distortion = fbm(distortedUv * 10.0 + uTime * 0.5) * 0.5;
    fire += distortion * 0.5; // 炎の強度にゆらぎを加える

    // 炎の色のグラデーション
    vec3 color = vec3(0.0);
    color = mix(color, vec3(1.0, 0.0, 0.0), fire * 0.8);      // 赤
    color = mix(color, vec3(1.0, 0.5, 0.0), fire * 1.2);      // オレンジ
    color = mix(color, vec3(1.0, 1.0, 0.0), fire * 2.0);      // 黄
    
    // 強度に応じてアルファ値を設定（炎の外側は透明に）
    float alpha = clamp(fire * 0.8, 0.0, 1.0);
    
    gl_FragColor = vec4(color, alpha);
  }
`;

// ---------------------------------------------------------------- //
//                             R3F コンポーネント                   //
// ---------------------------------------------------------------- //

const FlameMaterial = () => {
  const material = useRef<THREE.ShaderMaterial>(null!);

  useFrame(({ clock, viewport }) => {
    if (material.current) {
      material.current.uniforms.uTime.value = clock.getElapsedTime();
      material.current.uniforms.uResolution.value.set(viewport.width, viewport.height);
    }
  });

  return (
    <mesh position={[0, 0, 0]}>
      {/* 画面を覆う板ポリゴン */}
      <planeGeometry args={[100, 100]} />
      {/* カスタムシェーダーマテリアル */}
      <shaderMaterial
        ref={material}
        uniforms={{
          uTime: { value: 0 },
          uResolution: { value: new THREE.Vector2(0, 0) },
        }}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
};

// ---------------------------------------------------------------- //
//                            文字コンポーネント                    //
// ---------------------------------------------------------------- //

type TextOverlayProps = {
  text: string;
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
  rotation?: string; // 例: "15deg"
};

const TextOverlay: React.FC<TextOverlayProps> = ({
  text,
  top,
  bottom,
  left,
  right,
  rotation = '0deg',
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        top,
        bottom,
        left,
        right,
        color: 'white',
        fontSize: '8vw',
        fontWeight: 'bold',
        textShadow: '0 0 10px #f00, 0 0 20px #ff0', // 炎に合わせた光彩
        transform: `rotate(${rotation})`,
        zIndex: 10, // Canvasよりも手前に配置
        pointerEvents: 'none', // クリックイベントを無視
      }}
    >
      {text}
    </div>
  );
};

// ---------------------------------------------------------------- //
//                                メインページ                      //
// ---------------------------------------------------------------- //

export default function HomePage() {
  return (
      <Canvas camera={{ position: [0, 0, 1], near: 0.1, far: 100 }}>
        <color attach="background" args={['black']} /> {/* 背景色を黒に */}
        <FlameMaterial />
      </Canvas>
  );
};
