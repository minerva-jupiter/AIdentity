
export default function Home() {
	return (
		<main style={{paddingTop: "5rem", paddingLeft: "20vw", maxWidth: "60vw"}}>
			<h1>
				AIdentity
			</h1>
			<h5>
				Op.31 by Minerva_Juppiter
			</h5>
			<br />

			<article style={{textAlign: 'center'}}>
				<h3>
					これはOp.31の全貌です。
				</h3>
				
				<a style={{textAlign: 'center', color: 'var(--foreground)', textDecorationLine: 'none', fontSize: '10rem'}} href='/ctrl'>Play</a>

			</article>

			<br />
			<article>
				<h2>
					注意:Attention
				</h2>
				<ul>
					<li>音が出ます。</li>
					<li>フルスクリーンを要求します。</li>
				</ul>
			</article>
		</main>
	);
}
