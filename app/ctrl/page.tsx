'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';

export interface StageProps {
  onComplete: () => void;
}

const Loading = () => <p>loading...</p>;

//component dynamic import handler
const FirstChat = dynamic<StageProps>(() => import('../components/1_chat.tsx'), {
	loading: Loading,
});
const SecondDraw = dynamic<StageProps>(() => import('../components/2_draw.tsx'), {
	loading: Loading,
});
const Error = dynamic<StageProps>(() => import('../components/error.tsx'), {
	loading: Loading,
});

export default function Chat() {

	const pageRef = useRef<HTMLDivElement>(null);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [isInitialCheckDone, setIsInitialCheckDone] = useState(false);
	const [ stage, setStage ] = useState(1);
	const handleStageComplete = useCallback(() => {
    	setStage(stage + 1);
	}, []);

	let StageComponent: React.ReactNode;
	/*
	switch (stage) {
		case 1:
			StageComponent = <FirstChat onComplete={handleStageComplete}/>;
			break;
		case 2:
			StageComponent = <SecondDraw onComplete={handleStageComplete}/>;
			break;
		default:
			StageComponent = <Error onComplete={handleStageComplete}/>;
	}
	*/
   	StageComponent = <SecondDraw onComplete={handleStageComplete}/>;
	const checkFullscreen = () => {
		const isTargetFullscreen = document.fullscreenElement === pageRef.current;
		setIsFullscreen(isTargetFullscreen);
	};

//	const checkStage = () => {
//		const stage;
//	};

	useEffect(() => {
		// for fullscreen
		const element = pageRef.current;
		if (element && element.requestFullscreen) {
			element.requestFullscreen()
				.then(() => {
					checkFullscreen();
				})
				.catch(() => {
					setIsFullscreen(false);
				})
				.finally(() => {
					setIsInitialCheckDone(true); 
				});
		}else{
			setIsFullscreen(false);
			setIsInitialCheckDone(true);
			setStage(1);
		}

		document.addEventListener('fullscreenchange', checkFullscreen);
		return () => {
			document.removeEventListener('fullscreenchange', checkFullscreen);
		};
	}, []);

	const enterFullScreen = () => {
		const element = pageRef.current;
		if (element && element.requestFullscreen) {
			element.requestFullscreen().catch(() => {
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
			StageComponent
			)
		}
		</div>
	);
};

