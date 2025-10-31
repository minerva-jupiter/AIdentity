import React, {
	forwardRef,
	KeyboardEvent,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from "react";
// 質問データ型を拡張し、音源のURLを追加
export type QuestionWithAudio = {
	input: string; // 質問文
	ans: string; // 正しい回答
	audioUrl: string; // 質問に関連付けられた音源のURL
};
// 親コンポーネントからアクセスするためのRef型
export interface QuestionAnswerRef {
	// 外部からの操作は不要なため空のまま
}
interface QuestionAnswerProps {
	questions: QuestionWithAudio[];
	onComplete: () => void; // 全質問完了時のコールバック
}
const QuestionAnswer = forwardRef<QuestionAnswerRef, QuestionAnswerProps>(
	({ questions, onComplete }, ref) => {
		// 現在の質問のインデックス
		const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
		// ユーザーの現在の回答
		const [currentAnswer, setCurrentAnswer] = useState("");
		// エラーメッセージ
		const [errorMessage, setErrorMessage] = useState("");
		// Audioオブジェクトのインスタンスを保持するためのRef
		const audioRef = useRef<HTMLAudioElement | null>(null);

		// **注**: 最新のステートを参照するためのRefは、回答完了時の複雑なロジックを削除するため、ここでは不要になりますが、
		// 回答ロジックのシンプルな遷移のために、念のため残しておきます。
		const latestStateRef = useRef({
			answerLength: 0,
			questionIndex: 0,
			isAnswerComplete: false,
		});

		const currentQuestion = questions[currentQuestionIndex];

		if (!currentQuestion) {
			return <div className="p-4">🎉 すべての質問が完了しました！</div>;
		}

		const { input: questionText, ans: correctAnswer, audioUrl } =
			currentQuestion;
		const nextCorrectKey = correctAnswer[currentAnswer.length];

		// ステートが更新されるたびにRefを更新する (回答完了判定には使わない)
		useEffect(() => {
			latestStateRef.current = {
				answerLength: currentAnswer.length,
				questionIndex: currentQuestionIndex,
				isAnswerComplete: currentAnswer.length === correctAnswer.length,
			};
		}, [currentAnswer.length, currentQuestionIndex, correctAnswer.length]);

		// Refから親コンポーネントに公開するメソッド（今回はnextQuestionの外部からの使用は非推奨）
		useImperativeHandle(ref, () => ({
			// ここでは何もしない
		}));

		// 質問インデックスが変更されたとき、またはコンポーネントがマウントされたときに音源をロード/再生
		useEffect(() => {
			// 既存のAudioがあれば、onendedリスナーを解除して停止
			if (audioRef.current) {
				audioRef.current.pause();
				audioRef.current.currentTime = 0;
				audioRef.current.onended = null;
			}

			// 新しいAudioオブジェクトを作成または既存のものを使用
			const audio = audioRef.current || new Audio();
			audioRef.current = audio;

			// 新しい音源をロード
			audio.src = audioUrl;
			audio.load();

			// 再生終了時のハンドラ: 無条件に次の質問へ強制移行するロジックに変更
			audio.onended = (event: Event) => {
				// 再生終了時の最新の質問インデックスを取得
				const currentQuestionIdx = latestStateRef.current.questionIndex;
				const nextIndex = currentQuestionIdx + 1;

				if (nextIndex < questions.length) {
					// 次の質問へ (音源再生終了を待って強制的に移行)
					setCurrentQuestionIndex(nextIndex);
					setCurrentAnswer("");
					setErrorMessage("");
				} else {
					// 最後の質問の音源再生終了後、onCompleteを実行して終了
					onComplete();
				}
			};

			// 新しい音源の再生を開始
			audio.play().catch((e) =>
				console.error("Audio playback failed on initial play:", e)
			);

			// クリーンアップ関数
			return () => {
				if (audioRef.current) {
					audioRef.current.onended = null;
					audioRef.current.pause();
				}
			};
		}, [currentQuestionIndex, questions.length, audioUrl]); // 依存配列は音源切り替えに必要なもののみ

		// キー入力時のハンドラ: 回答ロジックのみを保持し、音源制御は削除
		const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
			// エンターキーなど、特殊なキーのデフォルト動作を防ぐ
			if (e.key === "Enter") {
				e.preventDefault();
				return;
			}

			// 回答が既に完了している場合は入力を無視
			if (currentAnswer.length >= correctAnswer.length) {
				e.preventDefault();
				return;
			}

			if (e.key === nextCorrectKey) {
				e.preventDefault(); // デフォルトの入力をキャンセル
				setErrorMessage(""); // エラーをクリア

				const newAnswer = currentAnswer + e.key;
				setCurrentAnswer(newAnswer);

				// 回答完了後も、音源が終了するまで質問は切り替わらない
				if (newAnswer.length === correctAnswer.length) {
					// 回答完了時の視覚的な遅延のみを保持 (音源制御は行わない)
					// *注意*: 音源終了時に自動で次の質問へ進むため、ここでは何もしません
				}
			} else {
				e.preventDefault(); // デフォルトの入力をキャンセル
				setErrorMessage("🚫 その回答は正しくありません");
			}
		};

		return (
			<div>
				<p>
					{questionText}
				</p>

				<div>
					<input
						type="text"
						value={currentAnswer}
						onKeyDown={handleKeyDown}
						readOnly // カスタムロジックで値をセットするため、readonlyにする
						placeholder={correctAnswer.split("").map(() => "_")
							.join(" ")}
						autoFocus // 自動フォーカス
					/>
					{/* 回答が正しい場合に緑色の枠線を表示 */}
					{currentAnswer.length === correctAnswer.length && (
						<span></span>
					)}
				</div>

				{errorMessage && (
					<p>
						{errorMessage}
					</p>
				)}

				<p>
					（日本語の回答は**ヘボン式ローマ字**のキー入力のみを想定しています）
				</p>
			</div>
		);
	},
);
QuestionAnswer.displayName = "QuestionAnswer";
// ダミーの音源URLを持つ拡張された質問データ
const myQuestions: QuestionWithAudio[] = [
	{ input: "5 + 9 = ?", ans: "14", audioUrl: "/audio/001.wav" }, // 実際には適切なURLに置き換えてください
	{
		input: "東京のローマ字表記は？",
		ans: "tokyo",
		audioUrl: "/audio/002.wav",
	},
	{ input: "Next.jsの親要素は？", ans: "react", audioUrl: "/audio/003.wav" },
];
// StagePropsの定義がないため、ここでは仮の定義を使用します
interface StageProps {
	onComplete: () => void;
}
export default function QuizPage({ onComplete }: StageProps) {
	const questionAnswerRef = useRef<QuestionAnswerRef>(null);

	const handleQuizComplete = () => {
		alert("全ての質問に正しく回答しました！お疲れ様でした！");
		// QuizPageに渡されたonCompleteを実行
		onComplete();
	};

	return (
		<div style={{ display: "flex" }}>
			<QuestionAnswer
				ref={questionAnswerRef}
				questions={myQuestions}
				onComplete={handleQuizComplete}
			/>
		</div>
	);
}
