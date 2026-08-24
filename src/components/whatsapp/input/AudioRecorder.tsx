import { useState, useEffect, useRef, forwardRef } from 'react';
import { Mic, X, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AudioRecorderProps {
  onAudioReady: (audioBlob: Blob, transcription?: string) => void;
  disabled?: boolean;
}

export const AudioRecorder = forwardRef<HTMLButtonElement, AudioRecorderProps>(
  function AudioRecorder({ onAudioReady, disabled }, ref) {
    const [isRecording, setIsRecording] = useState(false);
    const [duration, setDuration] = useState(0);
    const [audioLevels, setAudioLevels] = useState<number[]>(Array(20).fill(0.1));
    const [isProcessing, setIsProcessing] = useState(false);
    
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    
    // Start recording
    const startRecording = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        analyserRef.current = analyser;
        
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        
        mediaRecorder.start(100);
        setIsRecording(true);
        setDuration(0);
        
        // Start timer
        timerRef.current = setInterval(() => {
          setDuration(prev => prev + 1);
        }, 1000);
        
        // Animate waveform
        const updateLevels = () => {
          if (analyserRef.current) {
            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(dataArray);
            
            const newLevels = Array.from({ length: 20 }, (_, i) => {
              const index = Math.floor(i * dataArray.length / 20);
              return Math.max(0.1, dataArray[index] / 255);
            });
            
            setAudioLevels(newLevels);
          }
          animationFrameRef.current = requestAnimationFrame(updateLevels);
        };
        updateLevels();
        
      } catch (error) {
        console.error('Error accessing microphone:', error);
        toast.error('Não foi possível acessar o microfone');
      }
    };
    
    // Stop and process recording
    const stopRecording = async () => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
        return;
      }
      
      return new Promise<void>((resolve) => {
        mediaRecorderRef.current!.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          cleanup();
          setIsProcessing(true);
          
          try {
            // Transcribe the audio
            const transcription = await transcribeAudio(audioBlob);
            onAudioReady(audioBlob, transcription);
          } catch (error) {
            console.error('Transcription error:', error);
            onAudioReady(audioBlob);
          } finally {
            setIsProcessing(false);
          }
          
          resolve();
        };
        
        mediaRecorderRef.current!.stop();
      });
    };
    
    // Transcribe audio using Whisper
    const transcribeAudio = async (audioBlob: Blob): Promise<string | undefined> => {
      try {
        // Convert blob to base64
        const arrayBuffer = await audioBlob.arrayBuffer();
        const base64Audio = btoa(
          new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        
        const { data, error } = await supabase.functions.invoke('transcribe-audio', {
          body: { 
            audio: base64Audio,
            mimeType: 'audio/webm'
          }
        });
        
        if (error) {
          console.error('Transcription API error:', error);
          return undefined;
        }
        
        return data?.text;
      } catch (error) {
        console.error('Transcription failed:', error);
        return undefined;
      }
    };
    
    // Cancel recording
    const cancelRecording = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      cleanup();
    };
    
    const cleanup = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      setIsRecording(false);
      setDuration(0);
      setAudioLevels(Array(20).fill(0.1));
    };
    
    // Cleanup on unmount
    useEffect(() => {
      return () => {
        cleanup();
      };
    }, []);
    
    const formatDuration = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    
    if (isProcessing) {
      return (
        <div className="flex items-center gap-3 px-4 py-3 bg-card border-t border-border">
          <div className="flex-1 flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Transcrevendo áudio...</span>
          </div>
        </div>
      );
    }
    
    if (isRecording) {
      return (
        <div className="flex items-center gap-3 px-4 py-3 bg-card border-t border-border">
          {/* Cancel button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={cancelRecording}
            className="h-10 w-10 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <X className="h-5 w-5" />
          </Button>
          
          {/* Recording indicator and waveform */}
          <div className="flex-1 flex items-center gap-3">
            {/* Pulsing red dot */}
            <div className="relative">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <div className="absolute inset-0 h-3 w-3 rounded-full bg-red-500 animate-ping" />
            </div>
            
            {/* Duration */}
            <span className="text-sm font-mono text-foreground min-w-[48px]">
              {formatDuration(duration)}
            </span>
            
            {/* Waveform visualization */}
            <div className="flex-1 flex items-center justify-center gap-0.5 h-8">
              {audioLevels.map((level, index) => (
                <div
                  key={index}
                  className="w-1 bg-primary rounded-full transition-all duration-75"
                  style={{ 
                    height: `${Math.max(4, level * 32)}px`,
                  }}
                />
              ))}
            </div>
          </div>
          
          {/* Confirm button */}
          <Button
            size="icon"
            onClick={stopRecording}
            className="h-10 w-10 shrink-0 bg-green-500 hover:bg-green-600"
          >
            <Check className="h-5 w-5" />
          </Button>
        </div>
      );
    }
    
    return (
      <Button
        ref={ref}
        variant="ghost"
        size="icon"
        onClick={startRecording}
        disabled={disabled}
        className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground rounded-full"
      >
        <Mic className="h-5 w-5" />
      </Button>
    );
  }
);
