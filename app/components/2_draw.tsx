import React from 'react';
import { StageProps } from '../ctrl/page.tsx';

const SecondDraw: React.FC<StageProps> = ({ onComplete }) => {
	return(
		<div>
		<h1>
			this is SecondDraw
		</h1>
		<button type='button' onClick={onComplete}>onComplete</button>
		</div>
	)
};


export default SecondDraw;
