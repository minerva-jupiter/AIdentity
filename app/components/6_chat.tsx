import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { StageProps } from "../ctrl/page.tsx";
export type QuestionWithAudio = {
  input: string; // 質問文
  ans: string; // 正しい回答
  audioUrl: string; // 質問に関連付けられた音源のURL
};
interface QuestionAnswerProps {
  questions: QuestionWithAudio[];
  onComplete: () => void; // 全質問完了時のコールバック
}
const QuestionAnswer: React.FC<QuestionAnswerProps> = ({
  questions,
  onComplete,
}) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const latestStateRef = useRef({
    answerLength: 0,
    questionIndex: 0,
    isAnswerComplete: false,
  });
  const currentQuestion = questions[currentQuestionIndex];
  const { input: questionText, ans: correctAnswer, audioUrl } = currentQuestion;
  const nextCorrectKey = correctAnswer[currentAnswer.length];
  useEffect(() => {
    latestStateRef.current = {
      answerLength: currentAnswer.length,
      questionIndex: currentQuestionIndex,
      isAnswerComplete: currentAnswer.length === correctAnswer.length,
    };
  }, [currentAnswer.length, currentQuestionIndex]);
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.onended = null;
    }
    const audio = audioRef.current || new Audio();
    audioRef.current = audio;
    audio.src = audioUrl;
    audio.load();
    audio.onended = (event: Event) => {
      const currentQuestionIdx = latestStateRef.current.questionIndex;
      const nextIndex = currentQuestionIdx + 1;
      if (nextIndex < questions.length) {
        setCurrentQuestionIndex(nextIndex);
        setCurrentAnswer("");
        setErrorMessage("");
      } else {
        onComplete();
      }
    };
    audio
      .play()
      .catch((e) => console.error("Audio playback failed on initial play:", e));
    return () => {
      if (audioRef.current) {
        audioRef.current.onended = null;
        audioRef.current.pause();
      }
    };
  }, [currentQuestionIndex, questions.length, audioUrl]); // 依存配列は音源切り替えに必要なもののみ
  if (!currentQuestion) {
    return <div className="p-4">🎉 すべての質問が完了しました！</div>;
  }
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      return;
    }
    if (currentAnswer.length >= correctAnswer.length) {
      e.preventDefault();
      return;
    }
    if (e.key === nextCorrectKey) {
      e.preventDefault(); // デフォルトの入力をキャンセル
      setErrorMessage(""); // エラーをクリア
      const newAnswer = currentAnswer + e.key;
      setCurrentAnswer(newAnswer);
      if (newAnswer.length === correctAnswer.length) {
      }
    } else {
      e.preventDefault(); // デフォルトの入力をキャンセル
      setErrorMessage("🚫 その回答は正しくありません");
    }
  };
  return (
    <article style={{}}>
      <p style={{ textAlign: "center", fontSize: "5rem" }}>{questionText}</p>
      <div style={{ textAlign: "center" }}>
        <input
          type="text"
          value={currentAnswer}
          onKeyDown={handleKeyDown}
          readOnly // カスタムロジックで値をセットするため、readonlyにする
          placeholder={correctAnswer
            .split("")
            .map(() => "_")
            .join(" ")}
          autoFocus // 自動フォーカス
          style={{ fontSize: "2rem" }}
        />
        {currentAnswer.length === correctAnswer.length && <span></span>}
      </div>
      {errorMessage && <p>{errorMessage}</p>}
      <p style={{ textAlign: "center", padding: "5vh" }}>
        （日本語の回答は**ヘボン式ローマ字**のキー入力のみを想定しています）
      </p>
    </article>
  );
};
const myQuestions: QuestionWithAudio[] = [
  { input: "5 + 9 = ?", ans: "14", audioUrl: "/audio/006-1.flac" }, // 実際には適切なURLに置き換えてください
  {
    input: "東京のローマ字表記は？",
    ans: "tokyo",
    audioUrl: "/audio/006-2.flac",
  },
  { input: "Next.jsの親要素は？", ans: "react", audioUrl: "/audio/006-3.flac" },
];
export default function QuizPage({ onComplete }: StageProps) {
  const handleQuizComplete = () => {
    onComplete();
  };
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <QuestionAnswer questions={myQuestions} onComplete={handleQuizComplete} />
    </div>
  );
}
