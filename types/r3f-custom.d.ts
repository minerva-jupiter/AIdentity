// THREEとR3Fの型をインポート
import * as THREE from 'three';
import { ThreeElements } from '@react-three/fiber';

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
