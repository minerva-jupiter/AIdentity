"use client";
import React, {
	KeyboardEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { StageProps } from "../ctrl/page.tsx";
import init, { chat } from "../../rust-wasm/pkg/rust_wasm.js";
/**
 * カスタムフック: 最初の音源を再生し、終了後にonAudioEndを実行する
 */
const useAudioPlayback = (
	initialAudioId: number, // 1
	audioSources: Record<number, string>,
	onAudioEnd: () => void,
) => {
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const initialAudioUrl = audioSources[initialAudioId] || "";

	// 外部から再生を停止するための関数
	const stop = useCallback(() => {
		if (audioRef.current) {
			audioRef.current.pause();
			audioRef.current.currentTime = 0;
		}
	}, []);

	// 1. Audioオブジェクトの初期化、再生、および終了イベント処理 (一回限りの再生)
	useEffect(() => {
		if (!initialAudioUrl) {
			console.error("Initial audio URL is missing.");
			return;
		}

		// 既存の音源を停止
		stop();

		const audio = new Audio(initialAudioUrl);
		audioRef.current = audio;
		audio.loop = false; // ループはしない

		// 再生終了時のハンドラ: 無条件で onAudioEnd を実行
		const handleEnded = () => {
			console.log(
				"初期音源の再生が終了しました。onAudioEndを実行します。",
			);
			stop();
			onAudioEnd(); // 完了コールバックを実行
		};

		audio.addEventListener("ended", handleEnded);

		// 自動再生の試行 (ユーザーのインタラクションが必要なため、失敗する可能性あり)
		audio.play().catch((e) => {
			console.warn(
				"Audio playback failed initially. Waiting for user interaction.",
			);
		});

		// クリーンアップ関数
		return () => {
			audio.removeEventListener("ended", handleEnded);
			audio.pause();
		};
	}, [initialAudioUrl, onAudioEnd, stop]);

	// 外部とのインタフェースは不要になるが、フックの構造を維持
	return { currentAudioId: initialAudioId };
};
// ------------------------------------------------------------------
// 以下、ChatPage およびその他のコンポーネント
// ------------------------------------------------------------------
const FirstChat: React.FC<StageProps> = ({ onComplete }) => {
	return <ChatPage onComplete={onComplete} />;
};
export default FirstChat;
const AUDIO_SOURCES: Record<number, string> = {
	1: "/audio/001.wav", // 再生される音源はこれのみ
};
interface Message {
	id: number;
	text: string;
	sender: "user" | "ai";
}
const initialMessages: Message[] = [
	{ id: 1, text: "そろそろどうするか決めないとだよ？", sender: "ai" },
	{ id: 2, text: "はやく話して。", sender: "ai" },
];
const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
	const isUser = message.sender === "user";

	const bubbleStyle: React.CSSProperties = {
		padding: "10px 15px",
		borderRadius: "15px",
		maxWidth: "70%",
		wordBreak: "break-word",
		fontSize: "16px",
		backgroundColor: isUser ? "#3b82f6" : "#e5e7eb", // blue-500 or gray-200
		color: isUser ? "white" : "#1f2937", // white or gray-800
		marginLeft: isUser ? "auto" : "0",
		marginRight: isUser ? "0" : "auto",
	};

	const containerStyle: React.CSSProperties = {
		display: "flex",
		marginBottom: "10px",
		justifyContent: isUser ? "flex-end" : "flex-start",
	};

	return (
		<div style={containerStyle}>
			<div style={bubbleStyle}>
				{message.text}
			</div>
		</div>
	);
};
const MessageInput: React.FC<{ onSend: (text: string) => void }> = (
	{ onSend },
) => {
	const [input, setInput] = useState("");

	const handleSend = () => {
		if (input.trim() === "") return;
		onSend(input);
		setInput("");
	};

	const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			e.preventDefault();
			handleSend();
		}
	};

	const inputStyle: React.CSSProperties = {
		flexGrow: 1,
		padding: "12px",
		border: "1px solid #d1d5db", // gray-300
		borderRadius: "8px",
		marginRight: "10px",
		fontSize: "16px",
		outline: "none",
	};

	const buttonStyle: React.CSSProperties = {
		backgroundColor: "#3b82f6", // blue-500
		color: "white",
		border: "none",
		padding: "12px 20px",
		borderRadius: "8px",
		cursor: "pointer",
		fontWeight: "bold",
	};

	return (
		<div
			style={{
				padding: "15px",
				backgroundColor: "#f9fafb",
				display: "flex",
				alignItems: "center",
			}}
		>
			<input
				type="text"
				style={inputStyle}
				placeholder="メッセージを入力してください..."
				value={input}
				onChange={(e) => setInput(e.target.value)}
				onKeyDown={handleKeyPress}
			/>
			<button
				type="submit"
				style={buttonStyle}
				onClick={handleSend}
				disabled={input.trim() === ""}
			>
				送信
			</button>
		</div>
	);
};
function ChatPage({ onComplete }: StageProps) {
	const [messages, setMessages] = useState<Message[]>(initialMessages);
	const [dict, setDict] = useState<Uint8Array | undefined>(undefined);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const dictPath = "/system.dic.zst";

	// for audio: 最初の音源を再生し、終了したら onComplete を呼ぶ
	const { currentAudioId } = useAudioPlayback(
		1, // initialAudioId (最初の音源ID)
		AUDIO_SOURCES,
		onComplete,
	);

	// **注**: talktime の状態は会話継続の要件から削除しました。

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	useEffect(() => {
		const loadData = async () => {
			const loadedDict = await LoadDict(dictPath);
			setDict(loadedDict);
		};
		loadData();
	}, []);

	useEffect(() => {
		init();
	}, []);

	const handleSendMessage = useCallback(async (text: string) => {
		if (text.trim() === "") return;

		const newUserMessage: Message = {
			id: Date.now(),
			text,
			sender: "user",
		};
		setMessages((prev) => [...prev, newUserMessage]);

		let ans = dict == undefined
			? "もっとマシなことを言いなさい。"
			: chat(dict, text);
		if (messages[messages.length - 1].text === ans) {
			ans = "は？";
		}
		const aiResponse: Message = {
			id: Date.now() + 1,
			text: ans,
			sender: "ai",
		};
		setMessages((prev) => [...prev, aiResponse]);

		// **修正**: talktime のインクリメントと終了条件を削除。会話は継続します。
	}, [dict, messages]); // 依存配列から talktimeState を削除

	const pageContainerStyle: React.CSSProperties = {
		display: "flex",
		flexDirection: "column",
		height: "100vh",
		maxWidth: "800px",
		margin: "0 auto",
		backgroundColor: "white",
		boxShadow:
			"0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
	};

	const headerStyle: React.CSSProperties = {
		padding: "15px",
		backgroundColor: "#3b82f6",
		color: "white",
		textAlign: "center",
		fontWeight: "bold",
		fontSize: "20px",
	};

	const messageListStyle: React.CSSProperties = {
		flexGrow: 1,
		padding: "15px",
		overflowY: "auto",
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
	try {
		const response = await fetch(dictPath);
		if (!response.ok) {
			throw new Error(`fail to fetch file: ${response.statusText}`);
		}
		const arrayBuffer = await response.arrayBuffer();
		const byte = new Uint8Array(arrayBuffer);
		return byte;
	} catch (error) {
		console.log("error occur", error);
	}
	return new Uint8Array(0);
}
