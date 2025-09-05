/*Scenario:
You are designing a media player that can play audio files, video files, and live streams. Later, it might also support podcasts and online radio.
Instruction:
Write classes or modules for the media player system.*/

// ---------- Core contract ----------
interface Media {
    play(): void;
    pause(): void;
    stop(): void;
  }
  
  // ---------- Optional capability interfaces ----------
  interface Skippable {
    skipIntro(): void;
  }
  
  interface StationTunable {
    changeStation(station: string): void;
  }
  
  interface LiveInteractive {
    enableChat(): void;
    adjustLatency(ms: number): void;
  }
  
  interface Seekable {
    seek(seconds: number): void;
  }
  
  interface RateAdjustable {
    setPlaybackRate(rate: number): void;
  }
  
  interface Subtitled {
    toggleCaptions(on: boolean): void;
    setSubtitleTrack(langCode: string): void;
  }
  
  interface QualitySwitchable {
    setQuality(
      preset: "auto" | "144p" | "360p" | "480p" | "720p" | "1080p" | "4k"
    ): void;
  }
  
  // ---------- Implementations ----------
  
  class AudioFile implements Media, Seekable, RateAdjustable {
    private position = 0;
    private rate = 1.0;
  
    constructor(private filename: string) {}
  
    play() { console.log(`Playing audio: ${this.filename}`); }
    pause() { console.log(`Pausing audio: ${this.filename}`); }
    stop() { this.position = 0; console.log(`Stopped audio: ${this.filename}`); }
  
    seek(seconds: number) {
      this.position = Math.max(0, seconds);
      console.log(`Seek audio to ${this.position}s`);
    }
  
    setPlaybackRate(rate: number) {
      this.rate = rate;
      console.log(`Audio playback rate set to ${this.rate}x`);
    }
  }
  
  class VideoFile
    implements Media, Seekable, RateAdjustable, Subtitled, QualitySwitchable
  {
    private position = 0;
    private rate = 1.0;
    private captionsOn = false;
    private subtitleLang: string | null = null;
    private quality: QualitySwitchable["setQuality"] extends (q: infer Q) => any ? Q : never = "auto";
  
    constructor(private filename: string) {}
  
    play() { console.log(`Playing video: ${this.filename} [${this.quality}]`); }
    pause() { console.log(`Pausing video: ${this.filename}`); }
    stop() { this.position = 0; console.log(`Stopped video: ${this.filename}`); }
  
    seek(seconds: number) {
      this.position = Math.max(0, seconds);
      console.log(`Seek video to ${this.position}s`);
    }
  
    setPlaybackRate(rate: number) {
      this.rate = rate;
      console.log(`Video playback rate set to ${this.rate}x`);
    }
  
    toggleCaptions(on: boolean) {
      this.captionsOn = on;
      console.log(`Captions ${on ? "ON" : "OFF"}`);
    }
  
    setSubtitleTrack(langCode: string) {
      this.subtitleLang = langCode;
      console.log(`Subtitle track set to ${langCode}`);
    }
  
    setQuality(preset: "auto" | "144p" | "360p" | "480p" | "720p" | "1080p" | "4k") {
      this.quality = preset;
      console.log(`Quality set to ${preset}`);
    }
  }
  
  class Podcast implements Media, Skippable, RateAdjustable {
    private rate = 1.0;
    constructor(private episodeId: string) {}
  
    play() { console.log(`Playing podcast: ${this.episodeId}`); }
    pause() { console.log(`Pausing podcast: ${this.episodeId}`); }
    stop() { console.log(`Stopping podcast: ${this.episodeId}`); }
  
    skipIntro() { console.log(`Skipping intro of podcast: ${this.episodeId}`); }
  
    setPlaybackRate(rate: number) {
      this.rate = rate;
      console.log(`Podcast playback rate set to ${this.rate}x`);
    }
  }
  
  class OnlineRadio implements Media, StationTunable {
    constructor(private station: string) {}
  
    play() { console.log(`Tuning in to station: ${this.station}`); }
    pause() { console.log(`Pausing radio: ${this.station}`); }
    stop() { console.log(`Stopping radio: ${this.station}`); }
  
    changeStation(station: string) {
      this.station = station;
      console.log(`Changed radio station to: ${station}`);
    }
  }
  
  class LiveStream implements Media, LiveInteractive {
    constructor(private url: string) {}
  
    play() { console.log(`Streaming live from: ${this.url}`); }
    pause() { console.log(`Pausing live stream: ${this.url}`); }
    stop() { console.log(`Stopping live stream: ${this.url}`); }
  
    enableChat() { console.log(`Chat enabled for live stream.`); }
    adjustLatency(ms: number) { console.log(`Latency adjusted to ${ms}ms.`); }
  }
  
  // ---------- MediaPlayer Controller ----------
  
  class MediaPlayer {
    private currentMedia: Media | null = null;
  
    load(media: Media) {
      this.currentMedia = media;
      console.log("Media loaded.");
    }
  
    play() { this.currentMedia?.play(); }
    pause() { this.currentMedia?.pause(); }
    stop() { this.currentMedia?.stop(); }
  
    // Runtime-safe access to optional capabilities
    skipIntroIfAvailable() {
      if (this.currentMedia && "skipIntro" in this.currentMedia) {
        (this.currentMedia as Skippable).skipIntro();
      }
    }
  
    changeStationIfAvailable(station: string) {
      if (this.currentMedia && "changeStation" in this.currentMedia) {
        (this.currentMedia as StationTunable).changeStation(station);
      }
    }
  
    enableChatIfAvailable() {
      if (this.currentMedia && "enableChat" in this.currentMedia) {
        (this.currentMedia as unknown as LiveInteractive).enableChat();
      }
    }
  
    adjustLatencyIfAvailable(ms: number) {
      if (this.currentMedia && "adjustLatency" in this.currentMedia) {
        (this.currentMedia as unknown as LiveInteractive).adjustLatency(ms);
      }
    }
  
    seekIfAvailable(seconds: number) {
      if (this.currentMedia && "seek" in this.currentMedia) {
        (this.currentMedia as Seekable).seek(seconds);
      }
    }
  
    setRateIfAvailable(rate: number) {
      if (this.currentMedia && "setPlaybackRate" in this.currentMedia) {
        (this.currentMedia as RateAdjustable).setPlaybackRate(rate);
      }
    }
  
    captionsIfAvailable(on: boolean) {
      if (this.currentMedia && "toggleCaptions" in this.currentMedia) {
        (this.currentMedia as unknown as Subtitled).toggleCaptions(on);
      }
    }
  
    subtitleTrackIfAvailable(lang: string) {
      if (this.currentMedia && "setSubtitleTrack" in this.currentMedia) {
        (this.currentMedia as unknown as Subtitled).setSubtitleTrack(lang);
      }
    }
  
    qualityIfAvailable(
      preset: "auto" | "144p" | "360p" | "480p" | "720p" | "1080p" | "4k"
    ) {
      if (this.currentMedia && "setQuality" in this.currentMedia) {
        (this.currentMedia as QualitySwitchable).setQuality(preset);
      }
    }
  }
  
  // ---------- Usage Example ----------
  
  const player = new MediaPlayer();
  
  const audio = new AudioFile("song.mp3");
  player.load(audio);
  player.play();
  player.seekIfAvailable(30);
  player.setRateIfAvailable(1.5);
  player.pause();
  
  const video = new VideoFile("movie.mp4");
  player.load(video);
  player.play();
  player.seekIfAvailable(120);
  player.setRateIfAvailable(1.5);
  player.captionsIfAvailable(true);
  player.subtitleTrackIfAvailable("en");
  player.qualityIfAvailable("1080p");
  player.pause();
  
  const podcast = new Podcast("episode-42");
  player.load(podcast);
  player.play();
  player.skipIntroIfAvailable();
  player.setRateIfAvailable(1.25);
  
  const radio = new OnlineRadio("Jazz FM");
  player.load(radio);
  player.play();
  player.changeStationIfAvailable("Rock FM");
  
  const live = new LiveStream("https://example.com/live");
  player.load(live);
  player.play();
  player.enableChatIfAvailable();
  player.adjustLatencyIfAvailable(500);
  