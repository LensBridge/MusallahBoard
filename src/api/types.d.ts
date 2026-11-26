// What the board reads from the device agent on 127.0.0.1:8080, written by
// hand to match the agent's JSON (agent/docs/architecture.md, section 7).
// The payload body is built by the LensBridge backend and served verbatim by
// the agent; only `expired`, `lastDay` and `weather` are the agent's. Unknown
// fields are ignored, and every field the board does not need is left out.

/** GET /api/musallah/payload */
export interface MusallahBoardPayload {
  deviceConfig: DeviceConfig;
  /** Display order: the backend composes the sequence. */
  frames: FrameDefinition[];
  /** Raw OpenWeatherMap "current weather"; null when the board has none. */
  weather?: unknown;
  /** True once the installed content is past its last day. Absent on older agents: treat as false. */
  expired?: boolean;
  /** Last day of the installed content, "YYYY-MM-DD". */
  lastDay?: string;
}

export interface DeviceConfig {
  id?: string;
  location: Location;
  /** LIGHT, DARK, or AUTO: dark from Maghrib until sunrise. */
  themeMode: ThemeMode;
  /**
   * Gone from the backend; replaced by themeMode. Content built before the
   * change still carries it: true reads as AUTO, false as LIGHT.
   * @deprecated
   */
  darkModeAfterIsha?: boolean;
  enableScrollingMessage: boolean;
  scrollingMessages: string[];
  /** Not sent by the backend yet; see themes/registry.js. */
  theme?: string | null;
}

export type ThemeMode = 'LIGHT' | 'DARK' | 'AUTO';

export interface Location {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  /** IANA zone. */
  timezone: string;
  /** A key of CALCULATION_METHODS in models/index.js. */
  method: string;
}

export interface FrameDefinition {
  frameId?: string;
  frameType: 'next_prayer' | 'poster' | 'agenda' | 'socials' | 'jummah' | 'islamic_quote';
  /** Dwell time in seconds; null means automatic. */
  durationInSeconds: number | null;
  /** Discriminated on `type`, which equals frameType. */
  frameConfig: Record<string, any>;
}

/** GET /api/local/status */
export interface LocalStatus {
  localApi?: number;
  agentVersion?: string;
  /** Empty or absent on a board that has not been set up. */
  deviceId?: string;
  app?: { version: string } | null;
  content?: LocalContent | null;
  today?: string;
  servingDay?: string | null;
  daysRemaining?: number | null;
  /** Days since the content's last day; 0 while it still runs. */
  staleDays?: number | null;
  sync?: {
    enabled: boolean;
    lastSuccessAt: string | null;
    lastAttemptAt: string | null;
    lastError: string | null;
  } | null;
  update?: { active: boolean };
  /** The ethernet upload page is on. */
  servicePort?: boolean;
  /** USB sticks are read. */
  usbImport?: boolean;
  /** Where the clock's time comes from; trusted false means the board should say it may be wrong. */
  clock?: { source: string; trusted: boolean };
  /** Software waiting for its install window (utils/updates.js). */
  updates?: {
    available: { type: string; version: string; description: string }[];
    installTime: string;
    installAt: string | null;
    installing: boolean;
  };
  /** Installed content could not be read. */
  error?: string;
}

export interface LocalContent {
  firstDay: string;
  lastDay: string;
  timezone?: string;
  sequence?: number;
  createdAt?: string;
  /** sync | usb | upload | cli */
  source?: string;
  installedAt?: string;
}
