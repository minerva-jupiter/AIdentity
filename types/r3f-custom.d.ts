// THREEとR3Fの型をインポート
import * as THREE from 'three';

// OilArtMaterial のユニフォーム型を定義
interface OilArtUniforms {
  u_time?: number;
  u_resolution?: THREE.Vector2;
  u_dropPosition?: THREE.Vector2;
  u_dropColor?: THREE.Color;
  u_dropRadius?: number;
  u_tiltDirection?: THREE.Vector2;
  u_feedbackTexture?: THREE.Texture | null;
}

// @react-three/fiber のモジュールを拡張することで、カスタム要素の型を認識させる
declare module '@react-three/fiber' {
  // ThreeElements インターフェースに新しい要素を追加します
  export interface ThreeElements {
    oilArtMaterial: ThreeElements['shaderMaterial'] & OilArtUniforms;
  }
}

interface WaterMaterialProps extends THREE.ShaderMaterialParameters {
  uTime: number;
  uDropPosition: THREE.Vector3;
  uDropTime: number;
}

// 2. JSXの組み込み要素 (IntrinsicElements) に新しいタグを追加
//    これにより、R3Fが 'waterMaterial' を認識し、
//    Reactがそのプロパティの型チェックを行えるようになります。
declare global {
  namespace JSX {
    interface IntrinsicElements {
      // JSXタグ名 'waterMaterial' に WaterMaterialProps を関連付け
      waterMaterial: WaterMaterialProps & {
        // refを使用する場合のために THREE.ShaderMaterial も追加
        ref?: React.Ref<THREE.ShaderMaterial>; 
      };
    }
  }
}
