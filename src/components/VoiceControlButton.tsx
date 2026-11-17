import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import {
  VOICE_COMMAND_EXAMPLES,
  VoiceCommandAction,
  parseVoiceCommand,
} from '../sim/voiceCommands';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

interface WindowWithSpeech extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

interface VoiceControlButtonProps {
  onCommand: (action: VoiceCommandAction) => void;
  disabled?: boolean;
}

export function VoiceControlButton({ onCommand, disabled = false }: VoiceControlButtonProps) {
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [feedback, setFeedback] = useState<{
    status: 'matched' | 'unmatched' | 'error';
    transcript: string;
    detail: string;
  } | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const wantListeningRef = useRef(false);
  const onCommandRef = useRef(onCommand);
  const handledIdxRef = useRef(-1);
  const feedbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    onCommandRef.current = onCommand;
  }, [onCommand]);

  const showTimedFeedback = useCallback(
    (status: 'matched' | 'unmatched' | 'error', transcript: string, detail: string) => {
      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current);
      }
      setFeedback({ status, transcript, detail });
      feedbackTimerRef.current = window.setTimeout(() => {
        setFeedback(null);
      }, 3600);
    },
    []
  );

  const stopListening = useCallback(() => {
    wantListeningRef.current = false;
    setListening(false);
    setInterimText('');
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {
        // Ignore stop errors if already ended
      }
      recognitionRef.current = null;
    }
  }, []);

  const dispatchTranscript = useCallback(
    (transcript: string) => {
      const action = parseVoiceCommand(transcript);
      if (action) {
        onCommandRef.current(action);
        showTimedFeedback('matched', transcript, action.label);
      } else {
        showTimedFeedback('unmatched', transcript, 'No matching studio command');
      }
    },
    [showTimedFeedback]
  );

  const startListening = useCallback(async () => {
    const win = window as WindowWithSpeech;
    const RecognitionCtor = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!RecognitionCtor) {
      showTimedFeedback(
        'error',
        'Voice input',
        'SpeechRecognition API is not supported in this browser.'
      );
      return;
    }

    // Request microphone access explicitly first so iframe permission prompts trigger cleanly
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        for (const track of stream.getTracks()) {
          track.stop();
        }
      } catch {
        showTimedFeedback(
          'error',
          'Microphone blocked',
          'Allow microphone access in your browser to use vocal commands.'
        );
        return;
      }
    }

    stopListening();
    wantListeningRef.current = true;
    handledIdxRef.current = -1;

    const createAndStart = () => {
      if (!wantListeningRef.current) return;
      const recognition = new RecognitionCtor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      handledIdxRef.current = -1;

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0]?.transcript?.trim() ?? '';
          if (!transcript) continue;
          if (result.isFinal) {
            if (i > handledIdxRef.current) {
              handledIdxRef.current = i;
              setInterimText('');
              dispatchTranscript(transcript);
            }
          } else {
            interim += (interim ? ' ' : '') + transcript;
          }
        }
        if (interim) {
          setInterimText(interim);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        if (event.error === 'no-speech' || event.error === 'aborted') {
          return;
        }
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          showTimedFeedback(
            'error',
            'Permission denied',
            'Enable microphone permission to issue vocal commands.'
          );
          stopListening();
          return;
        }
        showTimedFeedback('error', 'Mic error', `Speech error: ${event.error}`);
        stopListening();
      };

      recognition.onend = () => {
        if (wantListeningRef.current) {
          window.setTimeout(() => {
            if (wantListeningRef.current) {
              createAndStart();
            }
          }, 180);
        }
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
        setListening(true);
      } catch {
        showTimedFeedback('error', 'Mic busy', 'Could not start speech recognition.');
        stopListening();
      }
    };

    createAndStart();
  }, [dispatchTranscript, showTimedFeedback, stopListening]);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current);
      }
      stopListening();
    };
  }, [stopListening]);

  const handleToggle = () => {
    if (disabled) return;
    if (listening) {
      stopListening();
    } else {
      void startListening();
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        aria-pressed={listening}
        aria-label={listening ? 'Stop microphone voice commands' : 'Start microphone voice commands'}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 ${
          listening
            ? 'bg-emerald-500/20 border-emerald-400/80 text-emerald-200'
            : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-200'
        }`}
      >
        {listening ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <Mic className="w-3.5 h-3.5 text-emerald-300" />
            <span>Listening</span>
          </>
        ) : (
          <>
            <MicOff className="w-3.5 h-3.5 text-slate-400" />
            <span>Voice</span>
          </>
        )}
      </button>

      {(listening || feedback) && (
        <div
          role="status"
          aria-live="polite"
          className="absolute right-0 top-full mt-2 w-72 rounded-xl bg-[#0d121c] border border-slate-700/90 shadow-2xl p-3 z-40 flex flex-col gap-2"
        >
          <div className="flex items-center justify-between gap-2 text-[11px] font-mono-data">
            <span className="inline-flex items-center gap-1.5 font-semibold text-cyan-300">
              <Volume2 className="w-3.5 h-3.5" />
              {listening ? 'MIC VOICE CONTROL ACTIVE' : 'VOICE COMMAND'}
            </span>
            {listening && (
              <button
                type="button"
                onClick={stopListening}
                className="text-[10px] text-slate-400 hover:text-slate-200 underline cursor-pointer"
              >
                Mute
              </button>
            )}
          </div>

          {interimText && (
            <p className="text-xs text-slate-200 italic bg-slate-900/90 border border-slate-800 rounded-md px-2 py-1">
              “{interimText}”
            </p>
          )}

          {feedback && (
            <div
              className={`rounded-md px-2.5 py-1.5 text-xs border ${
                feedback.status === 'matched'
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                  : feedback.status === 'unmatched'
                    ? 'bg-amber-950/50 border-amber-500/50 text-amber-200'
                    : 'bg-red-950/60 border-red-500/60 text-red-200'
              }`}
            >
              <div className="font-medium truncate">“{feedback.transcript}”</div>
              <div className="text-[11px] opacity-90">{feedback.detail}</div>
            </div>
          )}

          {listening && (
            <div className="flex flex-col gap-1 pt-1 border-t border-slate-800/80">
              <span className="text-[10px] font-mono-data text-slate-400">
                TRY SAYING OR CLICK TO TEST:
              </span>
              <div className="flex flex-wrap gap-1">
                {VOICE_COMMAND_EXAMPLES.slice(0, 6).map((cmd) => (
                  <button
                    key={cmd}
                    type="button"
                    onClick={() => dispatchTranscript(cmd)}
                    className="px-1.5 py-0.5 text-[10px] font-mono-data rounded bg-slate-900 border border-slate-800 hover:border-cyan-500/60 text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer"
                  >
                    {cmd}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
