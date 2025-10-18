'use client';

import { useEffect, useRef, useState } from 'react';

export default function Chat() {

	const pageRef = useRef<HTMLDivElement>(null);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [isInitialCheckDone, setIsInitialCheckDone] = useState(false);

	const checkFullscreen = () => {
		const isTargetFullscreen = document.fullscreenElement === pageRef.current;
		setIsFullscreen(isTargetFullscreen);
	};

	useEffect(() => {
		const element = pageRef.current;
		if (element && element.requestFullscreen) {
			element.requestFullscreen()
				.then(() => {
					checkFullscreen();
				})
				.catch((_err:any) => {
					setIsFullscreen(false);
				})
				.finally(() => {
					setIsInitialCheckDone(true); 
				});
		}else{
			setIsFullscreen(false);
			setIsInitialCheckDone(true);
		}

		document.addEventListener('fullscreenchange', checkFullscreen);
		return () => {
			document.removeEventListener('fullscreenchange', checkFullscreen);
		};
	}, []);

	const enterFullScreen = () => {
		const element = pageRef.current;
		if (element && element.requestFullscreen) {
			element.requestFullscreen().catch((_err:any) => {
				alert("フルスクリーンにできませんでした。")
				setIsFullscreen(false)
			})
		}
	};

	if (!isInitialCheckDone) {
		return <div ref={pageRef} style={{ height: '100vh', width: '100vw' }}></div>;
	}

	return (
		<div ref={pageRef} style={{ height: '100vh', width: '100vw' }}>
		{
			!isFullscreen ? (
				<article style={{height: '100%',width: '100%', alignItems:'center', justifyContent:'center', display:'flex'}}>
				<button type='button' onClick={enterFullScreen} style={{fontSize:'xxx-large'}}>フルスクリーンにする</button>
				</article>
			):(
			<h1>you are full screened</h1>
			)
		}
		</div>
	);
};

