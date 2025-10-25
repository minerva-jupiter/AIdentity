'use client';

import { useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Suspense } from 'react';
import * as THREE from 'three'; // THREE.Mesh などのためにインポート

// GLTFLoaderが返すオブジェクトの型を定義
interface GLTFResult {
  scene: THREE.Group;
  // 他にもanimations, cameras, materials, nodesなどがありますが、ここではsceneのみ使用
}

// モデルの読み込みと表示を担当するコンポーネント
const Model = ({ url }: { url: string }) => {
  // useLoaderの戻り値に型を適用
  const gltf = useLoader(GLTFLoader, url) as unknown as GLTFResult;
  
  // モデル全体に影の設定を有効化するためのトラバース処理
  gltf.scene.traverse((child) => {
    // childがTHREE.Meshであるかを型ガードでチェック
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });

  // gltf.sceneはTHREE.Groupですが、primitiveで表示可能です
  return <primitive object={gltf.scene} scale={1} />; // スケールはモデルに合わせて調整
};

export default function BenchScene() {
  return (
    // モデルの読み込みが完了するまで、何も表示しない (必須)
    <Suspense fallback={null}>
      {/* 準備した3Dモデル (ベンチと草) を読み込み */}
      <Model url="/bench.glb" />
    </Suspense>
  );
}
