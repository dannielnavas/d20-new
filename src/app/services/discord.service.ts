import { Injectable, signal } from "@angular/core";

interface DiscordVoicePayload {
  user_id?: string;
  userId?: string;
}

interface DiscordChannelInfo {
  id?: string;
  guild_id?: string;
  guildId?: string;
}

interface DiscordSdkLike {
  ready(): Promise<void>;
  subscribe?: (eventName: string, callback: (payload: unknown) => void) => void;
  instanceId?: string;
  channelId?: string;
  guildId?: string;
  commands?: {
    getChannel?: (...args: unknown[]) => Promise<DiscordChannelInfo>;
  };
}

export interface DiscordActivityContext {
  instanceId: string;
  channelId: string;
  guildId?: string;
}

@Injectable({ providedIn: "root" })
export class DiscordService {
  private sdk: DiscordSdkLike | null = null;

  readonly isActivity = signal(false);
  readonly participants = signal<string[]>([]);
  readonly context = signal<DiscordActivityContext | null>(null);
  readonly activityError = signal<{ code: string; message: string } | null>(null);

  setActivityError(payload: { code: string; message: string }): void {
    this.activityError.set(payload);
  }

  clearActivityError(): void {
    this.activityError.set(null);
  }

  async init(clientId: string): Promise<DiscordActivityContext | null> {
    if (!clientId) {
      this.isActivity.set(false);
      this.context.set(null);
      return null;
    }

    this.clearActivityError();

    const module = await import("@discord/embedded-app-sdk");
    const sdk = new module.DiscordSDK(clientId) as unknown as DiscordSdkLike;
    await sdk.ready();

    this.sdk = sdk;
    this.isActivity.set(true);

    const context = await this.resolveContext(sdk);
    this.context.set(context);
    this.bindVoiceEvents(sdk);

    return context;
  }

  setParticipants(participants: string[]): void {
    this.participants.set(participants);
  }

  private bindVoiceEvents(sdk: DiscordSdkLike): void {
    if (!sdk.subscribe) {
      return;
    }

    const updateFromPayload = (payload: unknown): void => {
      if (!payload || typeof payload !== "object") {
        return;
      }

      const voicePayload = payload as DiscordVoicePayload;
      const userId = voicePayload.user_id ?? voicePayload.userId;
      if (!userId) {
        return;
      }

      const current = this.participants();
      if (!current.includes(userId)) {
        this.participants.set([...current, userId]);
      }
    };

    sdk.subscribe("VOICE_STATE_UPDATE", updateFromPayload);
    sdk.subscribe("SPEAKING_START", updateFromPayload);
  }

  private readQueryParam(name: string): string | null {
    if (typeof window === "undefined") {
      return null;
    }
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
  }

  private async resolveContext(sdk: DiscordSdkLike): Promise<DiscordActivityContext | null> {
    const instanceId = sdk.instanceId ?? this.readQueryParam("instance_id") ?? this.readQueryParam("instanceId");

    let channelId = sdk.channelId ?? this.readQueryParam("channel_id") ?? this.readQueryParam("channelId");
    let guildId = sdk.guildId ?? this.readQueryParam("guild_id") ?? this.readQueryParam("guildId") ?? undefined;

    if (sdk.commands?.getChannel) {
      try {
        const channelInfo = await sdk.commands.getChannel();
        channelId = channelId ?? channelInfo.id ?? null;
        guildId = guildId ?? channelInfo.guild_id ?? channelInfo.guildId;
      } catch {
        // Ignored: not all embed contexts expose getChannel.
      }
    }

    if (!instanceId || !channelId) {
      return null;
    }

    return {
      instanceId,
      channelId,
      guildId,
    };
  }

  leaveActivity(): void {
    this.sdk = null;
    this.isActivity.set(false);
    this.participants.set([]);
    this.context.set(null);
    this.clearActivityError();
  }

  /**
   * Etiqueta legible para la lista de participantes (IDs de Discord o sesiones de la mesa).
   * No llama a la API de Discord.
   */
  peerDisplayLabel(id: string): string {
    const trimmed = id.trim();
    if (/^\d{17,20}$/.test(trimmed)) {
      return trimmed.length <= 10 ? trimmed : `Voz en Discord · …${trimmed.slice(-6)}`;
    }
    return trimmed.length <= 12 ? trimmed : `Conectado a la mesa · …${trimmed.slice(-6)}`;
  }
}
