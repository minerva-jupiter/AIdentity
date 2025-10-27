'use client';

import React, { useState, useRef, useEffect, KeyboardEvent, useCallback } from 'react';
import { StageProps } from '../ctrl/page.tsx';
import init, { chat2 } from '../../rust-wasm/pkg/rust_wasm.js';

// useWebAudioControllerの代替となるカスタムフックを定義
const useAudioPlayback = (
	initialTalktime: number,
	audioSources: Record<number, string>,
	onAudioEnd: () => void,
) => {
		// Audioオブジェクトの参照を保持
		const audioRef = useRef<HTMLAudioElement | null>(null);
		// 現在のトークタイムを保持し、変更を監視するためのState
		const talktimesRef = useRef(initialTalktime);
		const [currentAudioUrl, setCurrentAudioUrl] = useState(audioSources[initialTalktime] || '');

		// 外部から再生を停止するための関数
		const stop = useCallback(() => {
			if (audioRef.current) {
				audioRef.current.pause();
				audioRef.current.currentTime = 0; // 最初に戻す
			}
		}, []);

		// 外部からループ設定を変更するための関数（AudioRefのcurrentが更新されるたびに適用される）
		const setLoop = useCallback((isLooping: boolean) => {
			// audioRef.currentが存在する場合にのみ設定を試みる
			if (audioRef.current) {
				audioRef.current.loop = isLooping;
			}
		}, []); // 依存配列は空でOK

		// 1. Audioオブジェクトの初期化、クリーンアップ、および終了イベント処理
		useEffect(() => {
			// 古い音源を停止
			stop();

			const audio = new Audio(currentAudioUrl);
			audioRef.current = audio;
			audio.volume = 0.5; // 必要に応じて音量を設定

			// 常に最新のtalktimesRef.currentに基づいてループ設定
			const isLooping = talktimesRef.current < 4;
			audio.loop = isLooping;
			setLoop(isLooping); // 念のため

			// 自動再生の試行 (ユーザーのインタラクションが必要なため、失敗する可能性あり)
			audio.play().catch(e => {
				console.error("Audio playback error on URL change/init:", e);
				// ユーザーのインタラクションがない場合は再生できないため、ここではエラーを無視するか、ユーザーに操作を促す
			});


			const handleEnded = () => {
				const currentTalktime = talktimesRef.current;

				// 終了条件を満たしている場合は停止し、onAudioEndを実行
				if (currentTalktime >= 4) {
					console.log("最終音源の再生が終了しました。onAudioEndを実行します。");
					stop();
					onAudioEnd();
					return;
				}

				// ループがtrueの場合はonendedは呼ばれないはずだが、フォールバックとして再再生を試みる
				if (!audio.loop) {
					console.log(`音源 ${currentTalktime} の再生が終了しました。ループ再生を再開します。`);
					audio.play().catch(e => console.error("Audio playback error on loop restart:", e));
				}
			};

			audio.addEventListener('ended', handleEnded);

			// コンポーネントがアンマウントされる際のクリーンアップ
			return () => {
				audio.removeEventListener('ended', handleEnded);
				audio.pause();
				// audioRef.current = null; // Audioオブジェクトが再生成されるため、ここではnullにしない
			};
		}, [currentAudioUrl, onAudioEnd, stop, setLoop]); // currentAudioUrlが変わるとAudioオブジェクトが再生成される

		// 2. talktimesRef.currentの変更を監視し、音源の切り替えを行う
		useEffect(() => {
			const currentTalktime = talktimesRef.current;
			const newAudioUrl = audioSources[currentTalktime];

			console.log("talktimesRef is ", currentTalktime);

			if (newAudioUrl && newAudioUrl !== currentAudioUrl) {
				// URLが変わったら、Audioオブジェクトを再生成するためにstateを更新
				// 新しいcurrentAudioUrlで上のuseEffectがトリガーされる
				setCurrentAudioUrl(newAudioUrl);

				// 新しい音源に対するループ設定を即座に更新
				const isLooping = currentTalktime < 4;
				setLoop(isLooping);
			} else if (currentTalktime === initialTalktime && audioRef.current) {
				// 初回ロード時のみ、初期音源を再生（ブラウザの制限のため、ユーザー操作後の初回にのみ有効）
				audioRef.current.play().catch(e => console.error("Initial audio playback error:", e));
			}

		}, [talktimesRef.current]);

		// 外部からの更新用にtalktimesRefと制御関数を返す
		return { talktimesRef, stop, setLoop, currentAudioUrl };
	};

	const FirstChat: React.FC<StageProps> = ({ onComplete }) => {
		return(
			<ChatPage onComplete={onComplete}/>
		)
	};

	export default FirstChat;

	const AUDIO_SOURCES: Record<number, string> = {
		1: '/audio/001.wav',
		2: '/audio/002.wav',
		3: '/audio/003.wav',
		4: '/audio/004.wav',
		// 5以降は終了条件を満たすため、再生する音源は設定不要
	};

	interface Message {
		id: number;
		text: string;
		sender: 'user' | 'ai';
	}

	const initialMessages: Message[] = [
		{ id: 1, text: 'どうせ私のこと、うっさいな死ねよくらいに思ってんでしょ？', sender: 'ai' },
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

	function ChatPage({onComplete}:StageProps) {
		const [messages, setMessages] = useState<Message[]>(initialMessages);
		const [ dict, setDict ] = useState<Uint8Array|undefined>(undefined);
		const messagesEndRef = useRef<HTMLDivElement>(null);
		const dictPath = '/system.dic.zst';

		// for audio
		const { talktimesRef } = useAudioPlayback(
			1, // initialTalktime
			AUDIO_SOURCES,
			onComplete
		);

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

		const handleSendMessage = useCallback(async (text: string) => {
			if (text.trim() === '') return;

			const newUserMessage: Message = {
				id: Date.now(),
				text,
				sender: 'user',
			};
			setMessages((prev) => [...prev, newUserMessage]);
			const ans = dict == undefined ? 'みんなはもうできてるのに、なんでできないの？' : chat2(dict, text);
			const aiResponse: Message = {
				id: Date.now() + 1,
				text: ans,
				sender: 'ai',
			};
			setMessages((prev) => [...prev, aiResponse]);

			talktimesRef.current += 1;

			// termination condition
			if(talktimesRef.current >= 4){ 
				return;
			}

		}, [dict, talktimesRef ]);

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

		// for audio

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

		// function ChatPage's return

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
