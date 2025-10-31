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
const ThreeVR = dynamic<StageProps>(()=>import('../components/3_vr.tsx'),{
	loading: Loading,
});
const OilArt = dynamic<StageProps>(()=>import('../components/4_oil.tsx'),{
	loading: Loading,
});
const FifthTitle = dynamic<StageProps>(()=>import('../components/5_title.tsx'),{
	loading: Loading,
});
const SixthChat = dynamic<StageProps>(()=>import('../components/6_chat.tsx'),{
	loading: Loading,
});
const SeventhVR = dynamic<StageProps>(()=>import('../components/7_vr.tsx'),{
	loading: Loading,
});
const EighthLightActivity = dynamic<StageProps>(()=>import('../components/8_lightactivity.tsx'),{
	loading: Loading,
});
const Error = dynamic<StageProps>(() => import('../components/error.tsx'), {
	loading: Loading,
});

export default function Play() {

	const pageRef = useRef<HTMLDivElement>(null);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [isInitialCheckDone, setIsInitialCheckDone] = useState(false);
	const [ stage, setStage ] = useState(1);
	const handleStageComplete = useCallback(() => {
    	setStage(prevStage => prevStage + 1);
	}, []);

	let StageComponent: React.ReactNode;
	console.log("now, stage is ",stage);
	switch (stage) {
		case 1:
			StageComponent = <FirstChat onComplete={handleStageComplete}/>;
			break;
		case 2:
			StageComponent = <SecondDraw onComplete={handleStageComplete}/>;
			break;
		case 3:
			StageComponent = <ThreeVR onComplete={handleStageComplete}/>;
			break;
		case 4:
			StageComponent = <OilArt onComplete={handleStageComplete}/>
			break;
		case 5:
			StageComponent = <FifthTitle onComplete={handleStageComplete}/>
			break;
		case 6:
			StageComponent = <SixthChat onComplete={handleStageComplete}/>
			break;
		case 7:
			StageComponent = <SeventhVR onComplete={handleStageComplete}/>
			break;
		case 8:
			StageComponent = <EighthLightActivity onComplete={handleStageComplete}/>
			break;
		default:
			StageComponent = <Error onComplete={handleStageComplete}/>;
	}

	const checkFullscreen = () => {
		const isTargetFullscreen = document.fullscreenElement === pageRef.current;
		setIsFullscreen(isTargetFullscreen);
	};

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
		<main ref={pageRef} style={{ height: '100vh', width: '100vw' }}>
		{
			!isFullscreen ? (
				<article style={{height: '100%',width: '100%', alignItems:'center', justifyContent:'center', display:'flex'}}>
				<button type='button' onClick={enterFullScreen} style={{fontSize:'xxx-large'}}>フルスクリーンにする</button>
				</article>
			):(
			StageComponent
			)
		}
		</main>
	);
};

