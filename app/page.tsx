"use client";

import { useEffect, useState } from "react";
import { isWasmSupported } from "./components/wasmCheck.ts";

const WasmCheck: React.FC = () => {
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  useEffect(() => {
    setIsSupported(isWasmSupported());
  }, []);
  if (isSupported === null) {
    return null;
  }
  if (isSupported === false) {
    return <h3>WASMがサポートされていません。</h3>;
  }
  return null;
};
export default function Home() {
  return (
    <main style={{ paddingTop: "5rem", paddingLeft: "20vw", maxWidth: "60vw" }}>
      <h1>AIdentity</h1>
      <h5>Op.31 by Minerva_Juppiter</h5>
      <br />

      <article style={{ textAlign: "center" }}>
        <h3>これはOp.31の全貌です。</h3>

        <a
          style={{
            textAlign: "center",
            color: "var(--foreground)",
            textDecorationLine: "none",
            fontSize: "10rem",
          }}
          href="/ctrl"
        >
          Play
        </a>
      </article>

      <br />
      <article>
        <h2>注意:Attention</h2>
        <ul>
          <li>
            いち素人の実装です．不具合等々ありますが，ご了承ください．issueを投げてもらえば，治せるところは直します．
          </li>
          <li>音が出ます。</li>
          <li>フルスクリーンを要求します。</li>
          <li>
            JavaScript及びWASMを使用します。有効になっているか確認してください。
          </li>
          <noscript>JavaScriptが無効です。</noscript>
          <WasmCheck />
        </ul>
      </article>
    </main>
  );
}
