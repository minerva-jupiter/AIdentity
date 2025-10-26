const vertexShader = `
void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
uniform float u_time;
uniform vec2 u_resolution;
uniform vec3 u_dropColor;
uniform vec2 u_dropPosition;
uniform float u_dropRadius;
uniform vec2 u_tiltDirection; // -1.0から1.0の傾きベクトル
uniform sampler2D u_feedbackTexture;

// Simplex Noise (Based on Stefan Gustavson's implementation)
// -----------------------------------------------------------

vec3 mod289(vec3 x) {
	return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec2 mod289(vec2 x) {
	return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec3 permute(vec3 x) {
	return mod289(((x*34.0)+1.0)*x);
}

// 2D Simplex Noise
float noise(vec2 v)
{
	const vec4 C = vec4(0.211324865405187,  // (3.0-sqrt(3.0))/6.0
						0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
	-0.577350269189626,  // -1.0 + 2.0 * (3.0-sqrt(3.0))/6.0
	0.024390243902439); // 1.0/41.0
	// First corner
	vec2 i  = floor(v + dot(v, C.yy) );
	vec2 x0 = v -   i + dot(i, C.xx) ;

	// Other corners
	vec2 i1;
	//i1.x = step( x0.y, x0.x ); // x.y > x.x ? 1.0 : 0.0
	//i1.y = 1.0 - i1.x;
	i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
	// x0 is the point after skewing and de-skewing to form the right isosceles triangle.

	vec4 x12 = x0.xyxy + C.xxzz;
	x12.xy -= i1;

	// Permutations
	i = mod289(i); // Avoids truncation effects in GLSL
	vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
					 + i.x + vec3(0.0, i1.x, 1.0 ) );

					 vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
					 m = m*m ;
					 m = m*m ;

					 // Gradients: 41 points on a unit square
					 vec3 x = 2.0 * fract(p * C.www) - 1.0;
					 vec3 y = abs(x) - 0.4;
					 vec3 h = floor(x + 0.5);
					 vec3 ox = h * C.z;
					 vec3 a0 = x - h;

					 // Final gradient computation for the three simplex corners
					 m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + y*y );

				 // Gradients can be written concisely as dot( vec*x, vec*y )
				 vec3 g;
				 g.x  = a0.x  * x0.x  + y.x  * x0.y;
				 g.yz = a0.yz * x12.xz + y.yz * x12.yw;
				 return 130.0 * dot(m, g);
}
// -----------------------------------------------------------

void main() {
	vec2 uv = gl_FragCoord.xy / u_resolution.xy;

	// --- ノイズベクトル生成 ---
	vec2 noise_direction = vec2(
		noise(uv * 10.0 + u_time * 0.1),
		noise(uv * 20.0 - u_time * 0.2)
	) - 0.5;

	vec2 total_displacement = (u_tiltDirection * 0.005) + (noise_direction * 0.001); 

	vec2 shifted_uv = uv - total_displacement;
	shifted_uv = clamp(shifted_uv, 0.001, 0.999);

	vec4 prev_oil = texture2D(u_feedbackTexture, shifted_uv);
	vec3 current_oil_color = prev_oil.rgb;
	float current_alpha = prev_oil.a; 

	// 💡 減衰（フェードアウト）係数を調整 (よりゆっくり淡くなるように1.0に近づける)
	// ただし、完全に1.0だと色が残るため、非常に小さい値で調整
	float decay_factor = 0.998; // 例: 非常にゆっくりと色が減衰
	current_oil_color *= decay_factor; 
	current_alpha *= decay_factor;

	// --- 2. 滴下処理（大幅変更） ---
	if (u_dropPosition.x > -0.9) { 
		vec2 drop_uv = (u_dropPosition + 1.0) / 2.0;
		vec2 relative_pos = uv - drop_uv; // 滴下点からの相対位置

		// 1. 滴下点からの標準距離を計算
		float standard_dist = length(relative_pos);

		// 2. 角度(theta)を計算
		// atan2(y, x) は [-PI, PI] の角度を返す
		float theta = atan(relative_pos.y, relative_pos.x); 

		// 3. 角度と時間に基づいてノイズを生成
		// ノイズは [-1, 1] の範囲で、輪郭に複雑な歪みを与える
		float noise_freq = 5.0; // ノイズの波の数（輪郭のギザギザの細かさ）
		float noise_val = noise(vec2(theta * noise_freq, u_time * 0.5)) * 2.0 - 1.0; 

		// 4. ノイズによる距離補正 (歪曲)
		// 歪み係数: 0.1 は歪みの強さ (この値を大きくすると r'(θ) が急になります)
		float distortion_strength = 0.001; 

		// r(θ) のイメージ: 標準の半径 u_dropRadius にノイズを加える
		// この計算により、ノイズ値が r(θ) の変化率 r'(θ) に大きく影響を与える
		float distorted_radius = u_dropRadius + (noise_val * distortion_strength);

		// 5. ブレンド計算
		// 標準距離 standard_dist と歪んだ半径 distorted_radius を比較
		if (standard_dist < distorted_radius) {
			// スムースステップで中心から輪郭までのグラデーションを制御
			float blend_factor = 1.0 - smoothstep(distorted_radius * 0.9, distorted_radius, standard_dist);

			// 輪郭を暗くする処理（維持）
			float edge_darkness = 1.0 - smoothstep(distorted_radius * 0.4, distorted_radius, standard_dist);
			vec3 darker_drop_color = u_dropColor * (0.25 + edge_darkness * 0.75); 

			// 混色ではなく、色の上書きブレンド
			current_oil_color = mix(current_oil_color, darker_drop_color, blend_factor);
			current_alpha = mix(current_alpha, 1.0, blend_factor);
		}
	}

	// 💡 鮮やかさ（ビビッドさ）の強調処理
	// 1. RGBの平均輝度（グレースケール値）を計算
	float average_light = (current_oil_color.r + current_oil_color.g + current_oil_color.b) / 3.0;

	// 2. 彩度を強調する係数 (Saturation Boost Factor)
	// 1.0より大きい値にすると彩度が増します。2.0〜3.0が推奨値です。
	float saturation_boost = 1.035; 

	// 3. 平均輝度と現在の色を mix し、彩度を上げる
	// (current_oil_color - average_light) は色の「差」成分。
	// この差を大きくすることで彩度が増します。
	vec3 vivid_color = mix(vec3(average_light), current_oil_color, saturation_boost);

	// 結果をクランプして色を [0, 1] の範囲に収める
	current_oil_color = clamp(vivid_color, 0.0, 1.0);

	gl_FragColor = vec4(current_oil_color, current_alpha);
}
`;

import { useFrame, extend, useThree } from '@react-three/fiber';
import { useRef, useState, useEffect, useCallback } from 'react';
import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';

// -----------------------------------------------------------
// GLSL シェーダーコード
// -----------------------------------------------------------
// (上記2.の vertexShader と fragmentShader をここに定義またはインポート)

// -----------------------------------------------------------
// カスタムマテリアルの定義と拡張 (型定義は src/types/OilArtMaterial.d.ts に依存)
// -----------------------------------------------------------
const OilArtMaterial = shaderMaterial(
	{
		u_time: 0,
		u_resolution: new THREE.Vector2(),
		u_dropColor: new THREE.Color(0xffffff),
		u_dropPosition: new THREE.Vector2(-1, -1), // 無効な初期値
		u_dropRadius: 0.05,
		u_tiltDirection: new THREE.Vector2(0, 0),
		u_feedbackTexture: null as THREE.Texture | null,
	},
	vertexShader,
	fragmentShader
);
extend({ OilArtMaterial });

// -----------------------------------------------------------
// 外部公開APIとPropsの型定義
// -----------------------------------------------------------
export interface OilArtAPI {
	dropOil: (position: { x: number; y: number }, color: THREE.Color) => void;
	tilt: (direction: { x: number; y: number }) => void;
}

interface OilArtPlaneProps {
	onTriggerAPI: (api: OilArtAPI) => void;
}

type OilArtMaterialRef = THREE.ShaderMaterial & typeof OilArtMaterial.prototype;

// -----------------------------------------------------------
// OilArtPlane 本体
// -----------------------------------------------------------
export const OilArtPlane: React.FC<OilArtPlaneProps> = ({ onTriggerAPI }) => {
	const materialRef = useRef<OilArtMaterialRef>(null!);
	const meshRef = useRef<THREE.Mesh>(null!);
	const { gl, size, viewport, camera } = useThree();

	// Ping-pongバッファのためのレンダーターゲット (テクスチャを交互に書き込む)
	const [rtA] = useState(() => new THREE.WebGLRenderTarget(size.width, size.height));
	const [rtB] = useState(() => new THREE.WebGLRenderTarget(size.width, size.height));
	const currentRenderTexture = useRef(rtA);
	const feedbackRenderTexture = useRef(rtB);

	// 初期化とリサイズ処理
	useEffect(() => {
		if (materialRef.current) {
			materialRef.current.uniforms.u_resolution.value.set(size.width, size.height);
			rtA.setSize(size.width, size.height);
			rtB.setSize(size.width, size.height);

			// 初回は基本色でテクスチャをクリア (任意)
			gl.setRenderTarget(rtA);

			// 💡 修正点: setClearColor(Color, alpha) を使用
			// THREE.Colorオブジェクトを使って色を設定
			const baseColor = new THREE.Color(0.0, 0.0, 0.002); 
			const alpha = 0.7; 
			gl.setClearColor(baseColor, alpha); 

			// gl.clear() で設定した色とアルファ値を使ってクリア
			gl.clear(); 
			gl.setRenderTarget(null); // デフォルトに戻す
		}
	}, [gl, size, rtA, rtB]);

	// 滴下処理: positionはビューポート座標 (-1.0〜1.0)
	const dropOil = useCallback((position: { x: number; y: number }, color: THREE.Color) => {
		if (materialRef.current) {
			materialRef.current.uniforms.u_dropPosition.value.set(position.x, position.y);
			materialRef.current.uniforms.u_dropColor.value.copy(color);
			// ドロップをトリガー
		}
	}, []);

	// 傾き処理: directionはベクトル (-1.0〜1.0)
	const tilt = useCallback((direction: { x: number; y: number }) => {
		if (materialRef.current) {
			materialRef.current.uniforms.u_tiltDirection.value.set(direction.x, direction.y);
		}
	}, []);

	// 外部APIの公開
	useEffect(() => {
		onTriggerAPI({ dropOil, tilt });
	}, [onTriggerAPI, dropOil, tilt]);

	useFrame(({ clock }) => {
		if (!materialRef.current || !meshRef.current) return;

		materialRef.current.uniforms.u_time.value = clock.getElapsedTime();

		// 1. **オフスクリーンレンダリング**: 次のフレームの状態を計算し、`feedbackRenderTexture`に書き込む
		gl.setRenderTarget(feedbackRenderTexture.current);
		// 書き込む際には、前のフレームの状態を`u_feedbackTexture`としてシェーダーに渡す
		materialRef.current.uniforms.u_feedbackTexture.value = currentRenderTexture.current.texture;
		gl.render(meshRef.current, camera); // Ping-Pongバッファの計算

		// 2. **画面への最終描画**: 計算したばかりのテクスチャを画面に表示
		gl.setRenderTarget(null); // デフォルトのレンダーターゲット（画面）に戻す
		materialRef.current.uniforms.u_feedbackTexture.value = feedbackRenderTexture.current.texture;
		gl.render(meshRef.current, camera);

		// 3. **バッファのスワップ**: 次のフレームのために currentとfeedbackを入れ替える
		[currentRenderTexture.current, feedbackRenderTexture.current] = [feedbackRenderTexture.current, currentRenderTexture.current];

		// ドロップをリセット: 1フレーム描画したら無効な位置に戻す
		// これにより、毎フレーム新しい色が滴下されるのではなく、トリガー時のみ追加される
		materialRef.current.uniforms.u_dropPosition.value.set(-1, -1);
	});

	return (
		<mesh ref={meshRef} scale={[viewport.width, viewport.height, 1]}>
		<planeGeometry args={[1, 1]} />
		<oilArtMaterial ref={materialRef} />
		</mesh>
	);
};
