import React from 'react';
import { StageProps } from '../ctrl/page.tsx';

const Error: React.FC<StageProps> = ({ onComplete }) => {
	return(
		<div>
		<h1>
			Error
		</h1>
		<button type='button' onClick={onComplete}>onComplete</button>
		</div>
	)
};


export default Error;
