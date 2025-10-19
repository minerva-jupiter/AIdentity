'use client';

import React, { useState, useRef, useEffect, KeyboardEvent, useCallback } from 'react';
import { StageProps } from '../ctrl/page.tsx';
import init, { chat } from '../../rust-wasm/pkg/rust_wasm.js';

const FirstChat: React.FC<StageProps> = ({ onComplete }) => {
	return(
		<ChatPage/>
	)
};


export default FirstChat;

interface Message {
	id: number;
	text: string;
	sender: 'user' | 'ai';
}

const initialMessages: Message[] = [
	{ id: 1, text: 'そろそろどうするか決めないとだよ？', sender: 'ai' },
	{ id: 2, text: 'はやく話して。', sender:'ai'},
];

const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
	const isUser = message.sender === 'user';

	const bubbleStyle: React.CSSProperties = {
		padding: '10px 15px',
		borderRadius: '15px',
		maxWidth: '70%',
		wordBreak: 'break-word',
		fontSize: '16px',
		backgroundColor: isUser ? '#3b82f6' : '#e5e7eb', // blue-500 or gray-200
		color: isUser ? 'white' : '#1f2937', // white or gray-800
		marginLeft: isUser ? 'auto' : '0',
		marginRight: isUser ? '0' : 'auto',
	};

	const containerStyle: React.CSSProperties = {
		display: 'flex',
		marginBottom: '10px',
		justifyContent: isUser ? 'flex-end' : 'flex-start',
	};

	return (
		<div style={containerStyle}>
		<div style={bubbleStyle}>
		{message.text}
		</div>
		</div>
	);
};

const MessageInput: React.FC<{ onSend: (text: string) => void }> = ({ onSend }) => {
	const [input, setInput] = useState('');

	const handleSend = () => {
		if (input.trim() === '') return;
		onSend(input);
		setInput('');
	};

	const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleSend();
		}
	};

	const inputStyle: React.CSSProperties = {
		flexGrow: 1,
		padding: '12px',
		border: '1px solid #d1d5db', // gray-300
		borderRadius: '8px',
		marginRight: '10px',
		fontSize: '16px',
		outline: 'none',
	};

	const buttonStyle: React.CSSProperties = {
		backgroundColor: '#3b82f6', // blue-500
		color: 'white',
		border: 'none',
		padding: '12px 20px',
		borderRadius: '8px',
		cursor: 'pointer',
		fontWeight: 'bold',
	};

	return (
		<div style={{ padding: '15px', backgroundColor: '#f9fafb', display: 'flex', alignItems: 'center' }}>
		<input
		type="text"
		style={inputStyle}
		placeholder="メッセージを入力してください..."
		value={input}
		onChange={(e) => setInput(e.target.value)}
		onKeyDown={handleKeyPress}
		/>
		<button
		type='submit'
		style={buttonStyle}
		onClick={handleSend}
		disabled={input.trim() === ''}
		>
		送信
		</button>
		</div>
	);
};



function ChatPage() {
	const [messages, setMessages] = useState<Message[]>(initialMessages);
	const [ dict, setDict ] = useState<Uint8Array|undefined>(undefined);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const dictPath = '/system.dic.zst';

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages]);

	useEffect(() => {
		const loadData = async () => {
			const loadedDict = await LoadDict(dictPath);
			setDict(loadedDict);
		}
		loadData();
	}, []);

	useEffect(() => {
		init();
	}, []);

	const handleSendMessage = useCallback((text: string) => {
		console.log(dict);
		if (text.trim() === '') return;

		const newUserMessage: Message = {
			id: Date.now(),
			text,
			sender: 'user',
		};
		setMessages((prev) => [...prev, newUserMessage]);
		const ans = dict == undefined ? 'もっとまともなことを言いなさい。' : chat(dict, text);
		const aiResponse: Message = {
			id: Date.now() + 1,
			text: ans,
			sender: 'ai',
		};
		setMessages((prev) => [...prev, aiResponse]);
	}, [dict]);

	const pageContainerStyle: React.CSSProperties = {
		display: 'flex',
		flexDirection: 'column',
		height: '100vh', // 全画面の高さ
		maxWidth: '800px', // 最大幅を制限して中央に寄せる
		margin: '0 auto',
		backgroundColor: 'white',
		boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
	};

	const headerStyle: React.CSSProperties = {
		padding: '15px',
		backgroundColor: '#3b82f6', // blue-500
		color: 'white',
		textAlign: 'center',
		fontWeight: 'bold',
		fontSize: '20px',
	};

	const messageListStyle: React.CSSProperties = {
		flexGrow: 1, // 残りのスペースをすべて占める
		padding: '15px',
		overflowY: 'auto', // スクロール可能にする
	};

	return (
		<div style={pageContainerStyle}>
		<div style={headerStyle}>
		チャット
		</div>

		<div style={messageListStyle}>
		{messages.map((msg) => (
			<MessageBubble key={msg.id} message={msg} />
		))}
		<div ref={messagesEndRef} /> 
		</div>

		<MessageInput onSend={handleSendMessage} />
		</div>
	);
}

async function LoadDict(dictPath: string): Promise<Uint8Array> {
	try{
		const response = await fetch(dictPath);
		if(!response.ok){
			throw new Error(`fail to fetch file: ${response.statusText}`);
		}
		const arrayBuffer = await response.arrayBuffer();
		const byte = new Uint8Array(arrayBuffer);
		return byte;
	} catch (error) {
		console.log("error occur",error);
	}
	return new Uint8Array(0);
}
