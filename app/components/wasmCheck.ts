// utils/featureChecks.ts

/**
 * ブラウザがWebAssemblyをサポートしているかを確認します。
 * クライアントサイドでのみ実行する必要があります。
 * @returns {boolean} WASMがサポートされていれば true
 */
export const isWasmSupported = (): boolean => {
  // サーバーサイドレンダリング (SSR) を回避
  if (typeof window === 'undefined') {
    return false;
  }

  // グローバルスコープで `WebAssembly` オブジェクトが存在するかチェック
  return typeof WebAssembly !== 'undefined';
};
