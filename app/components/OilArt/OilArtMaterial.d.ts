// src/types/OilArtMaterial.d.ts
import { Material } from 'three';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      oilArtMaterial: ThreeElements['shaderMaterial'] & {
        u_time?: number;
        u_resolution?: THREE.Vector2;
        u_dropPosition?: THREE.Vector2;
        u_dropColor?: THREE.Color;
        u_dropRadius?: number;
        u_tiltDirection?: THREE.Vector2;
        u_feedbackTexture?: THREE.Texture | null; // Ping-Pongバッファ用
      };
    }
  }
}
