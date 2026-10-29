import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Mic, 
  MicOff, 
  X, 
  Sparkles, 
  Play, 
  AudioLines, 
  CheckCircle2, 
  AlertCircle,
  FileCheck,
  Building,
  Tag,
  Receipt
} from 'lucide-react';
import { TransactionEntry } from '../types';
import { formatCurrencyINR } from '../utils/formatters';
import { parseVoiceToTransaction } from '../utils/voiceAccountingParser';

interface VoiceRecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTransaction: (entry: TransactionEntry) => void;
}

export const VoiceRecorderModal: React.FC<VoiceRecorderModalProps> = ({
  isOpen,
  onClose,
  onAddTransaction,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [hasSpeechRecognition, setHasSpeechRecognition] = useState(false);
  const [audioLevels, setAudioLevels] = useState<number[]>([12, 24, 16, 28, 8, 20, 32, 14, 22, 10, 26, 18, 8]);

  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const sampleVoicePrompts = [
    'Paid twelve thousand five hundred rupees to Blue Dart Express for corporate parcel delivery via HDFC Bank with 18% GST',
    'Received one lakh fifty thousand rupees from Tata Motors for software consulting milestone with 18 percent IGST',
    'Purchased two laptops from Lenovo India for eighty-five thousand rupees plus eighteen percent GST',
    'Paid office rent forty-five thousand rupees to Nariman Properties for current month workspace lease via bank transfer',
    'Paid four thousand two hundred rupees cash to Navneet Stationery for printing cartridges and office supplies',
  ];

  // Stop recording session cleanup function - defined with useCallback before any useEffect
  const stopRecordingSession = useCallback(() => {
    setIsRecording(false);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore
      }
      recognitionRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      } catch {
        // Ignore
      }
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close().catch(() => {});
      } catch {
        // Ignore
      }
      audioContextRef.current = null;
    }

    setAudioLevels([10, 16, 20, 14, 22, 12, 18, 10, 14, 16, 20, 12, 8]);
  }, []);

  // Real-time audio frequency visualizer using AudioContext & AnalyserNode
  const startAudioVisualizer = useCallback(async (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const audioContext = new AudioCtx();
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateBars = () => {
        if (!analyser) return;
        analyser.getByteFrequencyData(dataArray);

        // Map frequency bands to 13 animated bars
        const bars: number[] = [];
        const step = Math.max(1, Math.floor(bufferLength / 13));
        for (let i = 0; i < 13; i++) {
          const val = dataArray[i * step] || 0;
          // Scale between 6px and 40px
          const scaled = Math.max(6, Math.round((val / 255) * 38) + 6);
          bars.push(scaled);
        }
        setAudioLevels(bars);
        animationFrameRef.current = requestAnimationFrame(updateBars);
      };

      updateBars();
    } catch {
      // AudioContext fallback without error
    }
  }, []);

  // Check speech recognition capability on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      setHasSpeechRecognition(!!SpeechRecognition);
    }
  }, []);

  // Cleanup on modal close or unmount
  useEffect(() => {
    if (!isOpen) {
      stopRecordingSession();
      setTranscribedText('');
      setMicError(null);
      setIsAnalyzing(false);
    }
    return () => {
      stopRecordingSession();
    };
  }, [isOpen, stopRecordingSession]);

  // Handle keyboard shortcuts inside modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleToggleRecord = async () => {
    if (isRecording) {
      stopRecordingSession();
      return;
    }

    setMicError(null);

    // 1. Request microphone access for audio waveform visualization
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = micStream;
        await startAudioVisualizer(micStream);
      } catch (err: any) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setMicError('Microphone permission was denied. Please allow microphone access in your browser address bar.');
        } else {
          setMicError('Could not access microphone hardware. You can type or click a sample prompt below.');
        }
      }
    }

    // 2. Start Web Speech Recognition if available
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-IN'; // Indian English handles Lakhs, Rupees, GST terms best
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          setIsRecording(true);
        };

        recognition.onresult = (event: any) => {
          let fullTranscript = '';
          for (let i = 0; i < event.results.length; i++) {
            fullTranscript += event.results[i][0].transcript + ' ';
          }
          setTranscribedText(fullTranscript.trim());
        };

        recognition.onerror = (event: any) => {
          if (event.error === 'not-allowed') {
            setMicError('Microphone access blocked. Click the lock/camera icon in your URL bar to allow microphone.');
            stopRecordingSession();
          } else if (event.error === 'no-speech') {
            // Keep listening, don't abort
          } else {
            setMicError(`Speech service notice: ${event.error}. You can also type or use sample prompts.`);
          }
        };

        recognition.onend = () => {
          if (recognitionRef.current) {
            setIsRecording(false);
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
        setIsRecording(true);
      } catch {
        setMicError('Browser speech engine could not be initialized. Please type or use sample prompt chips.');
        setIsRecording(false);
      }
    } else {
      // SpeechRecognition not supported in this browser (e.g. Firefox)
      setIsRecording(true);
      const sample = sampleVoicePrompts[Math.floor(Math.random() * sampleVoicePrompts.length)];
      let i = 0;
      const interval = setInterval(() => {
        i += 4;
        setTranscribedText(sample.substring(0, i));
        if (i >= sample.length) {
          clearInterval(interval);
          stopRecordingSession();
        }
      }, 50);
    }
  };

  const handleSelectPreset = (text: string) => {
    stopRecordingSession();
    setTranscribedText(text);
    setMicError(null);
  };

  const handleCommitVoiceEntry = () => {
    if (!transcribedText.trim()) return;
    setIsAnalyzing(true);

    setTimeout(() => {
      const entry = parseVoiceToTransaction(transcribedText);
      onAddTransaction(entry);
      setIsAnalyzing(false);
      onClose();
    }, 600);
  };

  // Only conditional return at the very end after all hooks and functions are declared!
  if (!isOpen) return null;

  // Live parsed preview of what the AI extracted from current transcribed text
  const previewEntry = transcribedText.trim() ? parseVoiceToTransaction(transcribedText) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-xl bg-white dark:bg-[#0c1322] border border-slate-300 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100 transition-colors">
        
        {/* Institutional Header */}
        <div className="px-6 py-3.5 bg-[#5F1915] text-white flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-white/10 rounded-lg">
              <AudioLines className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold font-serif">Voice-to-Voucher Accounting Engine</h3>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-white/20 text-white">
                  Live Dictation
                </span>
              </div>
              <p className="text-xs text-slate-200 mt-0.5">
                Speak naturally in English or Hinglish to automatically generate double-entry Tally vouchers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          
          {/* Error Banner if mic error */}
          {micError && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 flex items-start space-x-2.5 text-xs text-amber-900 dark:text-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold">Microphone Notice: </span>
                {micError}
              </div>
            </div>
          )}

          {/* Big Interactive Microphone & Real Waveform */}
          <div className="text-center py-2 space-y-3 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={handleToggleRecord}
              className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto transition-all shadow-md border-2 cursor-pointer ${
                isRecording
                  ? 'bg-rose-600 text-white border-rose-400 ring-8 ring-rose-100 dark:ring-rose-900/50 scale-110 animate-pulse'
                  : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-[#5F1915] dark:text-[#ffb4ab] border-slate-300 dark:border-slate-700 hover:border-[#5F1915]'
              }`}
            >
              {isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
            </button>

            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center justify-center gap-1.5">
                {isRecording ? (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping inline-block"></span>
                    <span className="text-rose-600 dark:text-rose-400 font-extrabold">Listening live... Speak clearly into your microphone</span>
                  </>
                ) : (
                  <span>Click microphone or select a prompt to begin dictating</span>
                )}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {hasSpeechRecognition 
                  ? 'Web Speech API active • Supports amounts, vendor names, GST rates & ledger heads' 
                  : 'Audio capture active • You can speak, use sample prompts, or type dictation'}
              </p>
            </div>

            {/* Audio Waveform visualization */}
            <div className="flex items-center justify-center space-x-1.5 h-10 pt-1">
              {audioLevels.map((h, idx) => (
                <div
                  key={idx}
                  className={`w-1.5 rounded-full transition-all duration-75 ${
                    isRecording 
                      ? 'bg-gradient-to-t from-[#5F1915] to-rose-500 shadow-sm' 
                      : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                  style={{
                    height: isRecording ? `${h}px` : '8px',
                  }}
                ></div>
              ))}
            </div>
          </div>

          {/* Transcribed Text Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Voice Transcript (Live Speech or Editable Text):
              </label>
              {transcribedText && (
                <button
                  type="button"
                  onClick={() => setTranscribedText('')}
                  className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            <textarea
              value={transcribedText}
              onChange={(e) => setTranscribedText(e.target.value)}
              placeholder="e.g. Paid Rs 15,000 to Lenovo India for computer equipment with 18% GST via bank..."
              rows={3}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 font-medium placeholder-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-[#5F1915] dark:focus:border-[#ffb4ab] resize-none transition-colors shadow-2xs"
            />
          </div>

          {/* Live AI Extraction Preview Card */}
          {previewEntry && (
            <div className="p-3.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800/60 space-y-2 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 uppercase tracking-wide">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                  AI Extracted Double-Entry Preview
                </span>
                <span className="text-[10px] font-bold bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-700">
                  {previewEntry.confidence.overall}% Confidence
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                <div className="bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-bold uppercase flex items-center gap-1">
                    <Tag className="w-3 h-3 text-slate-400" /> Voucher Type
                  </span>
                  <span className="font-extrabold text-slate-900 dark:text-slate-100">
                    {previewEntry.voucherType}
                  </span>
                </div>

                <div className="bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-bold uppercase flex items-center gap-1">
                    <Receipt className="w-3 h-3 text-slate-400" /> Amount
                  </span>
                  <span className="font-mono font-extrabold text-[#5F1915] dark:text-[#ffb4ab]">
                    {formatCurrencyINR(previewEntry.amount)}
                  </span>
                </div>

                <div className="bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-bold uppercase flex items-center gap-1">
                    <Building className="w-3 h-3 text-slate-400" /> Party / Vendor
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                    {previewEntry.party}
                  </span>
                </div>

                <div className="bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-bold uppercase flex items-center gap-1">
                    <FileCheck className="w-3 h-3 text-slate-400" /> Tax &amp; GST
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {previewEntry.gstRate}% {previewEntry.isInterState ? '(IGST)' : '(CGST+SGST)'}
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-slate-600 dark:text-slate-300 bg-white/70 dark:bg-slate-800/70 p-2 rounded border border-slate-200 dark:border-slate-700">
                <span className="font-bold text-slate-700 dark:text-slate-300">Mapped Tally Head: </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{previewEntry.ledger}</span>
                <span className="mx-2 text-slate-300">|</span>
                <span className="font-mono text-slate-600 dark:text-slate-400">Subtotal: {formatCurrencyINR(previewEntry.document.subtotal)} + Tax: {formatCurrencyINR(previewEntry.document.taxAmount)}</span>
              </div>
            </div>
          )}

          {/* Quick Sample Voice Prompts */}
          <div className="space-y-2 pt-1">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Quick 1-Click Accounting Dictation Samples:</span>
              <span className="text-[10px] text-slate-400 font-normal">Click any prompt to test</span>
            </span>
            <div className="space-y-1.5">
              {sampleVoicePrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectPreset(prompt)}
                  className="w-full text-left p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/70 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 font-medium transition-colors flex items-center justify-between group cursor-pointer"
                >
                  <span className="truncate pr-2">{prompt}</span>
                  <Play className="w-3 h-3 text-slate-400 group-hover:text-[#5F1915] dark:group-hover:text-[#ffb4ab] shrink-0" />
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 bg-slate-100 dark:bg-[#111a2e] border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            Shortcut: <span className="font-bold">Alt+V</span> anywhere in app
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCommitVoiceEntry}
              disabled={!transcribedText.trim() || isAnalyzing}
              className="flex items-center space-x-2 px-5 py-2 bg-[#5F1915] hover:bg-[#45120f] text-white rounded-lg text-xs font-bold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isAnalyzing ? 'Committing to Tally Desk...' : 'Commit to Tally Desk'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
