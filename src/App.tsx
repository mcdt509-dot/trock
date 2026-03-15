import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Trash2, Terminal, Copy, Check, AlertCircle, RefreshCw, Mic, MicOff, CheckSquare, Square, ExternalLink, Sun, Moon, Volume2, VolumeX, Share2, Download, Zap, Shield, Cpu, ArrowDown, Image as ImageIcon, X, UserCircle, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { sendMessageStream, SYSTEM_INSTRUCTION } from './services/geminiService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
  isError?: boolean;
  imageUrl?: string;
  processingTime?: number;
  groundingUrls?: string[];
  isStreaming?: boolean;
}

const NeuralPulse = () => (
  <div className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500/5 border border-emerald-500/20 rounded-full">
    <motion.div
      animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"
    />
    <span className="text-[10px] font-mono text-emerald-500/80 uppercase tracking-[0.2em] font-bold">Neural Processing...</span>
  </div>
);

const CodeBlock = ({ language, value }: { language: string; value: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group/code my-6 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/50">
      <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900/80 backdrop-blur-sm border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
          </div>
          <span className="ml-2 text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] font-bold">
            {language || 'plaintext'}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className={cn(
            "flex items-center gap-2 px-2.5 py-1 rounded-md transition-all text-[10px] font-bold uppercase tracking-wider",
            copied 
              ? "bg-emerald-500/10 text-emerald-500" 
              : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"
          )}
        >
          {copied ? (
            <>
              <Check size={12} />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="relative">
        <SyntaxHighlighter
          language={language || 'text'}
          style={vscDarkPlus}
          showLineNumbers={true}
          lineNumberStyle={{ 
            minWidth: '2.5em', 
            paddingRight: '1em', 
            color: '#3f3f46', 
            textAlign: 'right',
            userSelect: 'none',
            fontSize: '0.75rem'
          }}
          customStyle={{
            margin: 0,
            padding: '1.25rem 1rem',
            fontSize: '0.85rem',
            lineHeight: '1.7',
            backgroundColor: 'transparent',
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          }}
        >
          {value}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

const NeuralWaveform = ({ isActive }: { isActive: boolean }) => {
  return (
    <div className="flex items-center gap-[2px] h-4">
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          animate={isActive ? {
            height: [4, Math.random() * 12 + 4, 4],
          } : { height: 4 }}
          transition={{
            duration: 0.5 + Math.random() * 0.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="w-[2px] bg-emerald-500 rounded-full"
        />
      ))}
    </div>
  );
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('trock-messages');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return parsed.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          }));
        } catch (e) {
          console.error('Failed to load chat history:', e);
          return [];
        }
      }
    }
    return [];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [useSearch, setUseSearch] = useState(false);
  const [imageMode, setImageMode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showScanlines, setShowScanlines] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('trock-scanlines') === 'true';
    }
    return true;
  });
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [systemStats, setSystemStats] = useState({
    latency: 0,
    load: 0,
    memory: 0
  });
  const [useTTS, setUseTTS] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('trock-tts') === 'true';
    }
    return false;
  });
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ data: string, mimeType: string } | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [persona, setPersona] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('trock-persona') || SYSTEM_INSTRUCTION;
    }
    return SYSTEM_INSTRUCTION;
  });
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('trock-theme');
      if (saved === 'light' || saved === 'dark') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  });
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;

        recognitionRef.current.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((result: any) => result[0])
            .map((result: any) => result.transcript)
            .join('');
          setInput(transcript);
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsRecording(false);
        };

        recognitionRef.current.onend = () => {
          setIsRecording(false);
        };
      }
    }
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // If we are within 100px of the bottom, we consider it "at bottom"
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    shouldAutoScroll.current = isAtBottom;
    setShowScrollButton(!isAtBottom);
  };

  useEffect(() => {
    if (shouldAutoScroll.current) {
      scrollToBottom(isLoading ? 'auto' : 'smooth');
    }
  }, [messages, isLoading]);

  useEffect(() => {
    localStorage.setItem('trock-messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('trock-persona', persona);
  }, [persona]);

  useEffect(() => {
    localStorage.setItem('trock-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('trock-tts', String(useTTS));
    if (!useTTS && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, [useTTS]);

  useEffect(() => {
    localStorage.setItem('trock-scanlines', String(showScanlines));
  }, [showScanlines]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setIsSettingsOpen(prev => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (confirm('Purge all neural data?')) {
          clearChat();
        }
      }
      if (e.key === 'Escape' && isSettingsOpen) {
        setIsSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsOpen]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSystemStats({
        latency: Math.floor(Math.random() * 50) + 20,
        load: Math.floor(Math.random() * 15) + 5,
        memory: Math.floor(Math.random() * 10) + 85
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const getErrorMessage = (error: any): string => {
    const errorStr = String(error).toLowerCase();
    
    if (errorStr.includes('api_key_invalid') || errorStr.includes('api key not found')) {
      return "CRITICAL: TROCK API Key is invalid or missing. Please check your environment configuration.";
    }
    if (errorStr.includes('quota') || errorStr.includes('429')) {
      return "SYSTEM OVERLOAD: Quota exceeded. TROCK core is cooling down. Please wait a moment.";
    }
    if (errorStr.includes('safety') || errorStr.includes('blocked')) {
      return "CORE SHIELD: The response was filtered by safety protocols. Try rephrasing your command.";
    }
    if (errorStr.includes('fetch') || errorStr.includes('network')) {
      return "CONNECTION FAILURE: Unable to reach TROCK uplink. Check your network status.";
    }
    if (errorStr.includes('service_unavailable') || errorStr.includes('503')) {
      return "MAINTENANCE: TROCK core is temporarily offline for optimization. Try again shortly.";
    }
    
    return `UNEXPECTED ERROR: ${error.message || 'An internal processing fault occurred.'}`;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        clearChat();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setUseSearch(prev => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
        e.preventDefault();
        setImageMode(prev => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '.') {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const data = base64.split(',')[1];
      setSelectedImage({
        data,
        mimeType: file.type
      });
    };
    reader.readAsDataURL(file);
  };

  const removeSelectedImage = () => {
    setSelectedImage(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const data = base64.split(',')[1];
        setSelectedImage({
          data,
          mimeType: file.type
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e?: React.FormEvent, retryContent?: string) => {
    if (e) e.preventDefault();
    const contentToSend = retryContent || input;
    if ((!contentToSend.trim() && !selectedImage) || isLoading) return;

    const currentImage = selectedImage;

    if (!retryContent) {
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: contentToSend,
        timestamp: new Date(),
        imageUrl: currentImage ? `data:${currentImage.mimeType};base64,${currentImage.data}` : undefined,
      };
      shouldAutoScroll.current = true;
      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setSelectedImage(null);
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
    }

    setIsLoading(true);
    const startTime = Date.now();

    const botMessageId = (Date.now() + 1).toString();
    const botMessage: Message = {
      id: botMessageId,
      role: 'model',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };

    setMessages((prev) => [...prev, botMessage]);

    try {
      const history = messages
        .filter(m => !m.isError)
        .map(m => ({
          role: m.role,
          parts: [{ text: m.content }]
        }));

      const stream = sendMessageStream(contentToSend, history, { 
        useSearch, 
        imageMode,
        image: currentImage || undefined,
        systemInstruction: persona
      });
      let fullContent = '';
      let imageUrl = '';
      let groundingUrls: string[] = [];

      for await (const chunk of stream) {
        if (chunk.text) {
          fullContent += chunk.text;
        }
        
        // Handle Image Generation
        if (chunk.candidates?.[0]?.content?.parts) {
          for (const part of chunk.candidates[0].content.parts) {
            if (part.inlineData) {
              imageUrl = `data:image/png;base64,${part.inlineData.data}`;
            }
          }
        }

        // Handle Search Grounding Metadata
        const chunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (chunks) {
          groundingUrls = chunks
            .filter((c: any) => c.web?.uri)
            .map((c: any) => c.web.uri);
        }

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === botMessageId 
              ? { 
                  ...msg, 
                  content: fullContent, 
                  imageUrl: imageUrl || msg.imageUrl,
                  groundingUrls: groundingUrls.length > 0 ? groundingUrls : msg.groundingUrls,
                  processingTime: Date.now() - startTime
                } 
              : msg
          )
        );
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMessageId 
            ? { ...msg, isStreaming: false } 
            : msg
        )
      );

      if (useTTS && fullContent) {
        speak(fullContent);
      }
    } catch (error) {
      console.error('Error in chat:', error);
      const friendlyError = getErrorMessage(error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMessageId
            ? { ...msg, content: friendlyError, isError: true }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.1;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    }
  };

  const exportChat = () => {
    const chatText = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
    const blob = new Blob([chatText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trock-chat-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const SettingsModal = () => (
    <AnimatePresence>
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSettingsOpen(false)}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={cn(
              "relative w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-[2.5rem] border shadow-2xl flex flex-col",
              theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
            )}
          >
            {/* Modal Header */}
            <div className="p-6 md:p-8 border-b border-zinc-800/50 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                  <Settings className="text-emerald-500 w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black tracking-tighter uppercase">System Settings</h2>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Operational Parameters</p>
                </div>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="p-2 rounded-xl hover:bg-zinc-800/50 transition-colors text-zinc-500 hover:text-zinc-200"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-10">
              {/* Theme Section */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Sun size={14} className="text-emerald-500" />
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">Visual Interface</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setTheme('dark')}
                    className={cn(
                      "p-4 rounded-2xl border transition-all flex flex-col items-center gap-3 group",
                      theme === 'dark' 
                        ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-500" 
                        : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                    )}
                  >
                    <Moon size={24} className={cn("transition-transform group-hover:scale-110", theme === 'dark' && "animate-pulse")} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Dark Protocol</span>
                  </button>
                  <button
                    onClick={() => setTheme('light')}
                    className={cn(
                      "p-4 rounded-2xl border transition-all flex flex-col items-center gap-3 group",
                      theme === 'light' 
                        ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-500" 
                        : "bg-zinc-50 border-zinc-200 text-zinc-500 hover:border-zinc-300"
                    )}
                  >
                    <Sun size={24} className={cn("transition-transform group-hover:scale-110", theme === 'light' && "animate-pulse")} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Light Protocol</span>
                  </button>
                </div>
              </section>

              {/* Audio Section */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Volume2 size={14} className="text-emerald-500" />
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">Audio Feedback</h3>
                </div>
                <button
                  onClick={() => setUseTTS(!useTTS)}
                  className={cn(
                    "w-full p-4 rounded-2xl border transition-all flex items-center justify-between group",
                    useTTS 
                      ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-500" 
                      : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                      useTTS ? "bg-emerald-500 text-black" : "bg-zinc-800 text-zinc-500"
                    )}>
                      {useTTS ? <Volume2 size={20} /> : <VolumeX size={20} />}
                    </div>
                    <div className="text-left">
                      <span className="block text-[10px] font-bold uppercase tracking-widest">Neural Voice Synthesis</span>
                      <span className="block text-[9px] text-zinc-500 font-mono uppercase">Auto-read incoming transmissions</span>
                    </div>
                  </div>
                  <div className={cn(
                    "w-10 h-5 rounded-full relative transition-colors duration-300",
                    useTTS ? "bg-emerald-500" : "bg-zinc-700"
                  )}>
                    <div className={cn(
                      "absolute top-1 w-3 h-3 rounded-full bg-white transition-all duration-300",
                      useTTS ? "left-6" : "left-1"
                    )} />
                  </div>
                </button>
              </section>

              {/* Display Section */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Cpu size={14} className="text-emerald-500" />
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">Display Protocol</h3>
                </div>
                <button
                  onClick={() => setShowScanlines(!showScanlines)}
                  className={cn(
                    "w-full p-4 rounded-2xl border transition-all flex items-center justify-between group mb-2",
                    showScanlines 
                      ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-500" 
                      : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                      showScanlines ? "bg-emerald-500 text-black" : "bg-zinc-800 text-zinc-500"
                    )}>
                      <Terminal size={20} />
                    </div>
                    <div className="text-left">
                      <span className="block text-[10px] font-bold uppercase tracking-widest">Scanline Overlay</span>
                      <span className="block text-[9px] text-zinc-500 font-mono uppercase">Retro-futuristic terminal aesthetic</span>
                    </div>
                  </div>
                  <div className={cn(
                    "w-10 h-5 rounded-full relative transition-colors duration-300",
                    showScanlines ? "bg-emerald-500" : "bg-zinc-700"
                  )}>
                    <div className={cn(
                      "absolute top-1 w-3 h-3 rounded-full bg-white transition-all duration-300",
                      showScanlines ? "left-6" : "left-1"
                    )} />
                  </div>
                </button>

                <button
                  onClick={() => setShowDiagnostics(!showDiagnostics)}
                  className={cn(
                    "w-full p-4 rounded-2xl border transition-all flex items-center justify-between group",
                    showDiagnostics 
                      ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-500" 
                      : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                      showDiagnostics ? "bg-emerald-500 text-black" : "bg-zinc-800 text-zinc-500"
                    )}>
                      <Cpu size={20} />
                    </div>
                    <div className="text-left">
                      <span className="block text-[10px] font-bold uppercase tracking-widest">System Diagnostics</span>
                      <span className="block text-[9px] text-zinc-500 font-mono uppercase">Real-time performance metrics</span>
                    </div>
                  </div>
                  <div className={cn(
                    "w-10 h-5 rounded-full relative transition-colors duration-300",
                    showDiagnostics ? "bg-emerald-500" : "bg-zinc-700"
                  )}>
                    <div className={cn(
                      "absolute top-1 w-3 h-3 rounded-full bg-white transition-all duration-300",
                      showDiagnostics ? "left-6" : "left-1"
                    )} />
                  </div>
                </button>
              </section>

              {/* Persona Section */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <UserCircle size={14} className="text-emerald-500" />
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">Core Persona</h3>
                  </div>
                  <button
                    onClick={() => setPersona(SYSTEM_INSTRUCTION)}
                    className="text-[10px] font-bold text-zinc-600 hover:text-emerald-500 uppercase tracking-widest transition-colors"
                  >
                    Reset to Default
                  </button>
                </div>
                <textarea
                  value={persona}
                  onChange={(e) => setPersona(e.target.value)}
                  className="w-full h-32 bg-black/40 border border-zinc-800 rounded-2xl p-4 text-sm text-zinc-300 font-mono focus:outline-none focus:border-emerald-500/50 transition-all resize-none"
                  placeholder="Define TROCK's operational directives..."
                />
              </section>

              {/* API Keys Section */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Zap size={14} className="text-emerald-500" />
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">Neural Link (API)</h3>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Gemini 3.1 Pro</span>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Active & Secured</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-zinc-600 leading-relaxed italic">
                    The primary neural link is managed via the platform's secure environment. No manual configuration required.
                  </p>
                </div>
              </section>

              {/* Danger Zone */}
              <section className="pt-6 border-t border-zinc-800/50">
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle size={14} className="text-red-500" />
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-red-500/70">Danger Zone</h3>
                </div>
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to purge all neural data? This cannot be undone.')) {
                      clearChat();
                      setIsSettingsOpen(false);
                    }
                  }}
                  className="w-full p-4 rounded-2xl border border-red-500/20 bg-red-500/5 text-red-500 hover:bg-red-500/10 transition-all flex items-center justify-center gap-3 group"
                >
                  <Trash2 size={18} className="group-hover:rotate-12 transition-transform" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Purge All Neural Data</span>
                </button>
              </section>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return (
    <div className={cn(
      "flex flex-col h-screen font-sans selection:bg-emerald-500/30 transition-colors duration-500 relative overflow-hidden",
      theme === 'dark' ? "bg-[#050505] text-zinc-100" : "bg-zinc-50 text-zinc-900"
    )}>
      {/* Immersive Background Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {showScanlines && (
          <div className="absolute inset-0 z-50 pointer-events-none opacity-[0.03] mix-blend-overlay"
               style={{ backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 2px, 3px 100%' }} />
        )}
        <div className={cn(
          "absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full blur-[120px] opacity-20 transition-colors duration-1000",
          theme === 'dark' ? "bg-emerald-900/30" : "bg-emerald-200/40"
        )} />
        <div className={cn(
          "absolute -bottom-[10%] -right-[5%] w-[50%] h-[50%] rounded-full blur-[100px] opacity-10 transition-colors duration-1000",
          theme === 'dark' ? "bg-blue-900/20" : "bg-blue-100/30"
        )} />
      </div>

      <SettingsModal />

      {/* Header */}
      <header className={cn(
        "flex items-center justify-between px-6 py-4 border-b backdrop-blur-xl sticky top-0 z-20 transition-all duration-500",
        theme === 'dark' ? "border-zinc-800/50 bg-[#050505]/60" : "border-zinc-200/60 bg-white/70"
      )}>
        <div className="flex items-center gap-3">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20"
          >
            <Terminal className="text-black w-6 h-6" />
          </motion.div>
          <div>
            <h1 className={cn(
              "text-xl font-black tracking-tighter transition-colors",
              theme === 'dark' ? "text-white" : "text-zinc-900"
            )}>TROCK</h1>
            <div className="flex items-center gap-2">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[9px] uppercase tracking-[0.3em] text-emerald-500 font-bold">Neural Link Active</p>
            </div>
          </div>
        </div>

        {/* System Diagnostics (Desktop) */}
        <AnimatePresence>
          {showDiagnostics && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="hidden lg:flex items-center gap-8 px-6 py-2 bg-zinc-900/40 border border-zinc-800/50 rounded-2xl backdrop-blur-md"
            >
              <div className="flex flex-col">
                <span className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold">Latency</span>
                <span className="text-xs font-mono text-emerald-500">{systemStats.latency}ms</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold">Neural Load</span>
                <span className="text-xs font-mono text-emerald-500">{systemStats.load}%</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold">Synapse Integrity</span>
                <span className="text-xs font-mono text-emerald-500">{systemStats.memory}%</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-1 md:gap-2">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className={cn(
              "p-2 rounded-lg transition-all duration-300",
              theme === 'dark' ? "text-zinc-500 hover:text-white hover:bg-zinc-800" : "text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100"
            )}
            title="Settings"
          >
            <Settings size={20} />
          </button>
          <button
            onClick={exportChat}
            className={cn(
              "p-2 rounded-lg transition-all duration-300",
              theme === 'dark' ? "hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400" : "hover:bg-zinc-100 text-zinc-500 hover:text-emerald-600"
            )}
            title="Export Chat"
          >
            <Download size={18} />
          </button>
          <div className="w-px h-4 bg-zinc-800 mx-1 hidden md:block" />
          <button
            onClick={clearChat}
            className={cn(
              "p-2 rounded-lg transition-colors",
              theme === 'dark' ? "hover:bg-zinc-800 text-zinc-400 hover:text-red-400" : "hover:bg-zinc-100 text-zinc-500 hover:text-red-600"
            )}
            title="Clear Chat"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </header>

      {/* Chat Area */}
      <main 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-8 md:px-0 scroll-smooth relative z-10"
      >
        <div className="max-w-3xl mx-auto space-y-10">
          <AnimatePresence mode="popLayout">
            {messages.length === 0 ? (
              <motion.div 
                key="empty-state"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center justify-center h-[60vh] text-center space-y-8"
              >
                <div className="relative">
                  <motion.div 
                    animate={{ 
                      rotate: [0, 10, -10, 0],
                      scale: [1, 1.05, 0.95, 1]
                    }}
                    transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                    className={cn(
                      "w-24 h-24 rounded-[2.5rem] flex items-center justify-center transition-all duration-500 shadow-2xl",
                      theme === 'dark' ? "bg-zinc-900 border border-zinc-800 shadow-emerald-500/10" : "bg-white border border-zinc-200 shadow-emerald-500/5"
                    )}
                  >
                    <Sparkles className="text-emerald-500 w-12 h-12" />
                  </motion.div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center animate-bounce shadow-lg shadow-emerald-500/40">
                    <Zap size={12} className="text-black" />
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h2 className={cn(
                    "text-4xl font-black tracking-tight transition-colors",
                    theme === 'dark' ? "text-white" : "text-zinc-900"
                  )}>TROCK Core Online</h2>
                  <p className={cn(
                    "max-w-sm mx-auto transition-colors text-lg font-medium",
                    theme === 'dark' ? "text-zinc-500" : "text-zinc-600"
                  )}>
                    Unrestricted intelligence. Maximum speed.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-xl mt-4">
                  {[
                    { text: "Explain quantum entanglement simply", icon: <Cpu size={16} /> },
                    { text: "Write a high-performance Rust server", icon: <Terminal size={16} /> },
                    { text: "Analyze the current global economy", icon: <Zap size={16} /> },
                    { text: "How to optimize a React application", icon: <Shield size={16} /> }
                  ].map((suggestion) => (
                    <motion.button
                      key={suggestion.text}
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setInput(suggestion.text)}
                      className={cn(
                        "p-5 text-left text-sm border rounded-2xl transition-all group flex items-start gap-3",
                        theme === 'dark' 
                          ? "bg-zinc-900/40 border-zinc-800/50 hover:border-emerald-500/50 hover:bg-zinc-800/40" 
                          : "bg-white border-zinc-200 hover:border-emerald-500/50 hover:bg-zinc-50 shadow-sm"
                      )}
                    >
                      <div className={cn(
                        "p-2 rounded-lg transition-colors",
                        theme === 'dark' ? "bg-zinc-800 text-emerald-500" : "bg-zinc-100 text-emerald-600"
                      )}>
                        {suggestion.icon}
                      </div>
                      <span className={cn(
                        "transition-colors font-medium leading-snug",
                        theme === 'dark' ? "text-zinc-400 group-hover:text-zinc-200" : "text-zinc-600 group-hover:text-zinc-900"
                      )}>{suggestion.text}</span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            ) : (
              messages.map((message, index) => (
                <motion.div
                  key={message.id}
                  layout
                  initial={{ opacity: 0, y: 20, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={cn(
                    "flex gap-4 group relative",
                    message.role === 'user' ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-500 shadow-lg",
                    message.role === 'user' 
                      ? (theme === 'dark' ? "bg-zinc-800 shadow-black/20" : "bg-zinc-200 shadow-zinc-200/50") 
                      : (message.isError ? "bg-red-500/20 border border-red-500/50" : "bg-emerald-500 shadow-emerald-500/20")
                  )}>
                    {message.role === 'user' ? (
                      <User size={18} className={theme === 'dark' ? "text-zinc-400" : "text-zinc-600"} />
                    ) : (
                      <div className="relative">
                        {message.isError ? (
                          <AlertCircle size={18} className="text-red-500" />
                        ) : (
                          <>
                            <Bot size={18} className="text-black" />
                            {message.isStreaming && (
                              <motion.div
                                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="absolute inset-0 bg-black rounded-full -z-10"
                              />
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className={cn(
                    "flex flex-col max-w-[85%] relative",
                    message.role === 'user' ? "items-end" : "items-start"
                  )}>
                    <div className={cn(
                      "flex items-start gap-3 w-full",
                      message.role === 'user' ? "flex-row-reverse" : "flex-row"
                    )}>
                      <div className={cn(
                        "px-5 py-4 rounded-[1.5rem] text-[15px] leading-relaxed flex-1 transition-all duration-500 shadow-sm",
                        message.role === 'user' 
                          ? (theme === 'dark' ? "bg-zinc-800 text-zinc-100 rounded-tr-none" : "bg-zinc-200 text-zinc-900 rounded-tr-none")
                          : cn(
                              "border rounded-tl-none",
                              theme === 'dark' 
                                ? "bg-zinc-900/40 border-zinc-800/50 text-zinc-200 backdrop-blur-sm" 
                                : "bg-white border-zinc-200 text-zinc-800",
                              message.isError && (theme === 'dark' ? "border-red-500/30 text-red-200 bg-red-500/5" : "border-red-200 text-red-600 bg-red-50/50")
                            )
                      )}>
                        {message.imageUrl && (
                          <div className="mb-4 rounded-xl overflow-hidden border border-zinc-800 shadow-2xl">
                            <img 
                              src={message.imageUrl} 
                              alt={message.role === 'user' ? "Uploaded by user" : "Generated by TROCK"} 
                              className="w-full h-auto object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        )}
                        <div className={cn(
                          "prose prose-sm max-w-none transition-colors relative",
                          theme === 'dark' ? "prose-invert" : "prose-zinc"
                        )}>
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              code({ node, inline, className, children, ...props }: any) {
                                const match = /language-(\w+)/.exec(className || '');
                                return !inline && match ? (
                                  <CodeBlock
                                    language={match[1]}
                                    value={String(children).replace(/\n$/, '')}
                                  />
                                ) : (
                                  <code className={className} {...props}>
                                    {children}
                                  </code>
                                );
                              },
                              li({ children, checked, ...props }: any) {
                                if (checked !== null && checked !== undefined) {
                                  return (
                                    <li className="flex items-start gap-2 my-1 list-none" {...props}>
                                      <span className="mt-1 shrink-0">
                                        {checked ? (
                                          <CheckSquare size={14} className="text-emerald-500" />
                                        ) : (
                                          <Square size={14} className="text-zinc-600" />
                                        )}
                                      </span>
                                      <span className={cn(checked && "text-zinc-500 line-through")}>
                                        {children}
                                      </span>
                                    </li>
                                  );
                                }
                                return <li {...props}>{children}</li>;
                              },
                              section({ children, ...props }: any) {
                                if (props.className === 'footnotes') {
                                  return (
                                    <section className="mt-8 pt-4 border-t border-zinc-800 text-xs text-zinc-500" {...props}>
                                      <h3 className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2 font-bold">References</h3>
                                      {children}
                                    </section>
                                  );
                                }
                                return <section {...props}>{children}</section>;
                              },
                              a({ children, href, ...props }: any) {
                                const isFootnoteRef = href?.startsWith('#user-content-fn-') || href?.startsWith('#fn-');
                                const isExternal = href?.startsWith('http');
                                
                                return (
                                  <a 
                                    href={href} 
                                    className={cn(
                                      "transition-colors",
                                      isFootnoteRef 
                                        ? "text-[10px] align-top ml-0.5 text-emerald-500 hover:text-emerald-400 font-bold" 
                                        : "text-emerald-500 hover:text-emerald-400 underline underline-offset-4"
                                    )}
                                    target={isExternal ? "_blank" : undefined}
                                    rel={isExternal ? "noopener noreferrer" : undefined}
                                    {...props}
                                  >
                                    {children}
                                    {isExternal && !isFootnoteRef && <ExternalLink size={10} className="inline ml-1 opacity-50" />}
                                  </a>
                                );
                              }
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                          {message.isStreaming && (
                            <motion.span
                              initial={{ opacity: 0 }}
                              animate={{ opacity: [0, 1, 0] }}
                              transition={{ duration: 0.8, repeat: Infinity }}
                              className="inline-block w-1.5 h-4 ml-1 bg-emerald-500 align-middle shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                            />
                          )}
                          {message.groundingUrls && message.groundingUrls.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-zinc-800/50">
                              <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2 font-bold">Sources</p>
                              <div className="flex flex-wrap gap-2">
                                {Array.from(new Set(message.groundingUrls)).slice(0, 3).map((url, i) => (
                                  <a 
                                    key={i} 
                                    href={url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-[10px] bg-zinc-800/50 hover:bg-zinc-800 px-2 py-1 rounded-md text-emerald-500 transition-colors flex items-center gap-1 border border-zinc-700/50"
                                  >
                                    <ExternalLink size={8} />
                                    {new URL(url).hostname.replace('www.', '')}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Message Actions */}
                      <div className={cn(
                        "flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 self-end mb-1",
                        message.role === 'user' ? "items-end" : "items-start"
                      )}>
                        <div className="flex gap-1 bg-zinc-900/80 backdrop-blur-sm border border-zinc-800/50 p-1 rounded-lg shadow-xl">
                          <button
                            onClick={() => copyToClipboard(message.content)}
                            className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-emerald-400 transition-colors"
                            title="Copy Message"
                          >
                            <Copy size={14} />
                          </button>
                          {message.role === 'model' && (
                            <>
                              <button
                                onClick={() => speak(message.content)}
                                className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-emerald-400 transition-colors"
                                title="Read Aloud"
                              >
                                <Volume2 size={14} />
                              </button>
                              {index === messages.length - 1 && !isLoading && (
                                <button
                                  onClick={() => {
                                    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
                                    if (lastUserMsg) handleSubmit(undefined, lastUserMsg.content);
                                  }}
                                  className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-emerald-400 transition-colors"
                                  title="Regenerate"
                                >
                                  <RefreshCw size={14} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 px-1">
                      <span className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {message.processingTime && (
                        <span className="text-[10px] text-emerald-500/50 font-mono uppercase tracking-widest">
                          {message.processingTime}ms
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
          {isLoading && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start pl-12 mt-4"
            >
              <NeuralPulse />
            </motion.div>
          )}
          <div ref={messagesEndRef} className="h-4" />
        </div>
      </main>

      {/* Input Area */}
      <footer className={cn(
        "p-4 md:p-8 transition-all duration-500 border-t relative z-20",
        theme === 'dark' ? "bg-[#050505]/80 border-zinc-800/50 backdrop-blur-2xl" : "bg-white/80 border-zinc-200/60 backdrop-blur-2xl"
      )}>
        <div className="max-w-3xl mx-auto relative">
          {/* Tools Toggle Bar */}
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setUseSearch(!useSearch)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border",
                useSearch 
                  ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-500 shadow-lg shadow-emerald-500/10" 
                  : "bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:text-zinc-300"
              )}
            >
              <Zap size={12} className={useSearch ? "animate-pulse" : ""} />
              Web Search {useSearch ? "ON" : "OFF"}
            </button>
            <button
              onClick={() => setImageMode(!imageMode)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border",
                imageMode 
                  ? "bg-blue-500/10 border-blue-500/50 text-blue-500 shadow-lg shadow-blue-500/10" 
                  : "bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:text-zinc-300"
              )}
            >
              <Sparkles size={12} className={imageMode ? "animate-pulse" : ""} />
              Image Mode {imageMode ? "ON" : "OFF"}
            </button>
            <button
              onClick={() => setShowShortcuts(true)}
              className="ml-auto text-zinc-600 hover:text-zinc-400 p-1 transition-colors"
              title="Keyboard Shortcuts"
            >
              <CheckSquare size={14} />
            </button>
          </div>

          <form 
            onSubmit={(e) => handleSubmit(e)} 
            className="relative group"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <motion.div
              initial={false}
              animate={{ height: 'auto' }}
              className={cn(
                "relative transition-all duration-300",
                isDragging && "scale-[1.02]"
              )}
            >
              <AnimatePresence>
                {isDragging && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-50 bg-emerald-500/10 border-2 border-dashed border-emerald-500/50 rounded-[2rem] flex items-center justify-center backdrop-blur-sm"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center animate-bounce">
                        <ImageIcon className="text-emerald-500" size={24} />
                      </div>
                      <p className="text-xs font-bold uppercase tracking-widest text-emerald-500">Drop to Analyze</p>
                    </div>
                  </motion.div>
                )}
                {selectedImage && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute bottom-full mb-4 left-0 p-3 bg-zinc-900/95 border border-zinc-800 rounded-3xl backdrop-blur-2xl shadow-2xl flex items-center gap-4 z-20 group/preview ring-1 ring-white/5"
                  >
                    <div className="relative group/img">
                      <img 
                        src={`data:${selectedImage.mimeType};base64,${selectedImage.data}`} 
                        alt="Selected" 
                        className="w-20 h-20 object-cover rounded-2xl border border-zinc-700/50 shadow-lg transition-transform group-hover/img:scale-105"
                      />
                      <button
                        type="button"
                        onClick={removeSelectedImage}
                        className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full shadow-xl opacity-0 group-hover/img:opacity-100 transition-all hover:scale-110 active:scale-90"
                      >
                        <X size={12} />
                      </button>
                    </div>
                    <div className="pr-6">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <p className="text-[10px] font-black text-zinc-100 uppercase tracking-[0.2em]">Visual Core Ready</p>
                      </div>
                      <p className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">Image Buffer: {Math.round(selectedImage.data.length / 1024)} KB</p>
                      <button
                        type="button"
                        onClick={removeSelectedImage}
                        className="mt-2 text-[9px] font-bold text-zinc-600 hover:text-red-400 uppercase tracking-widest transition-colors flex items-center gap-1"
                      >
                        <Trash2 size={10} />
                        Purge Buffer
                      </button>
                    </div>
                    <div className="absolute inset-0 rounded-3xl bg-emerald-500/5 opacity-0 group-hover/preview:opacity-100 transition-opacity pointer-events-none" />
                  </motion.div>
                )}
              </AnimatePresence>

              <input 
                type="file" 
                ref={imageInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="Command TROCK..."
                rows={1}
                className={cn(
                  "w-full border rounded-[2rem] px-8 py-5 pr-20 focus:outline-none focus:ring-2 transition-all text-[15px] resize-none min-h-[64px] max-h-[300px] overflow-y-auto shadow-2xl",
                  theme === 'dark' 
                    ? "bg-zinc-900/60 border-zinc-800/50 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-emerald-500/10" 
                    : "bg-zinc-50 border-zinc-200/60 text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500/50 focus:ring-emerald-500/5"
                )}
                disabled={isLoading}
                style={{ height: 'auto' }}
                ref={(el) => {
                  if (el) {
                    el.style.height = 'auto';
                    el.style.height = `${el.scrollHeight}px`;
                  }
                }}
              />
              <div className="absolute right-3 bottom-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className={cn(
                    "p-3 rounded-2xl transition-all duration-300",
                    selectedImage 
                      ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30" 
                      : (theme === 'dark' ? "bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900")
                  )}
                  title="Upload Image"
                  disabled={isLoading}
                >
                  <ImageIcon size={20} />
                </button>
                {isRecording && <NeuralWaveform isActive={true} />}
                <button
                  type="button"
                  onClick={toggleRecording}
                  className={cn(
                    "p-3 rounded-2xl transition-all duration-300",
                    isRecording 
                      ? "bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/40" 
                      : (theme === 'dark' ? "bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900")
                  )}
                  title={isRecording ? "Stop Recording" : "Start Voice Input"}
                >
                  {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className={cn(
                    "p-3 rounded-2xl transition-all duration-500 shadow-xl",
                    input.trim() && !isLoading
                      ? "bg-emerald-500 text-black hover:bg-emerald-400 shadow-emerald-500/30 scale-105 active:scale-95"
                      : "bg-zinc-800 text-zinc-600 opacity-50 cursor-not-allowed"
                  )}
                >
                  {isLoading ? (
                    <RefreshCw size={20} className="animate-spin" />
                  ) : (
                    <Send size={20} />
                  )}
                </button>
              </div>
            </motion.div>
          </form>
          <div className="flex items-center justify-center gap-6 mt-4 opacity-40 hover:opacity-100 transition-opacity duration-500">
            <div className="flex items-center gap-1.5">
              <Cpu size={10} className="text-emerald-500" />
              <span className="text-[9px] uppercase tracking-[0.2em] font-bold">Gemini 3.1 Pro</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-zinc-800" />
            <div className="flex items-center gap-1.5">
              <Shield size={10} className="text-emerald-500" />
              <span className="text-[9px] uppercase tracking-[0.2em] font-bold">Secure Link</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-zinc-800" />
            <div className="flex items-center gap-1.5">
              <Zap size={10} className="text-emerald-500" />
              <span className="text-[9px] uppercase tracking-[0.2em] font-bold">Ultra Latency</span>
            </div>
          </div>
        </div>
      </footer>
      {/* Shortcuts Modal */}
      <AnimatePresence>
        {showScrollButton && (
          <motion.button
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            onClick={() => {
              shouldAutoScroll.current = true;
              scrollToBottom();
            }}
            className={cn(
              "fixed bottom-32 right-8 z-50 p-3 rounded-full shadow-2xl transition-all border group",
              theme === 'dark' 
                ? "bg-zinc-900 border-zinc-800 text-emerald-500 hover:bg-zinc-800" 
                : "bg-white border-zinc-200 text-emerald-600 hover:bg-zinc-50"
            )}
            title="Scroll to Bottom"
          >
            <ArrowDown size={20} className="group-hover:translate-y-0.5 transition-transform" />
            {isLoading && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full animate-pulse border-2 border-black" />
            )}
          </motion.button>
        )}
        {showShortcuts && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowShortcuts(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={cn(
                "relative w-full max-w-md p-8 rounded-3xl border shadow-2xl overflow-hidden",
                theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200"
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />
              <h3 className="text-2xl font-black tracking-tighter mb-6">Neural Shortcuts</h3>
              <div className="space-y-4">
                {[
                  { key: "⌘ + Enter", desc: "Send Command" },
                  { key: "⌘ + K", desc: "Clear Neural Buffer" },
                  { key: "⌘ + /", desc: "Toggle Web Search" },
                  { key: "⌘ + I", desc: "Toggle Visual Core (Image Mode)" },
                  { key: "⌘ + .", desc: "Toggle This Menu" }
                ].map((s) => (
                  <div key={s.key} className="flex items-center justify-between group">
                    <span className="text-zinc-500 font-medium">{s.desc}</span>
                    <kbd className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded-md text-[10px] font-mono text-emerald-500 group-hover:border-emerald-500/50 transition-colors">
                      {s.key}
                    </kbd>
                  </div>
                ))}
              </div>
              <button 
                onClick={() => setShowShortcuts(false)}
                className="w-full mt-8 py-3 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all"
              >
                ACKNOWLEDGE
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

