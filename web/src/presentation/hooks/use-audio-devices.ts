"use client";

/**
 * useAudioDevices — enumerate browser audio input devices for the
 * Settings → Audio section.
 *
 * Browser quirk: `navigator.mediaDevices.enumerateDevices()` returns
 * devices for any origin, but the `label` field is empty until the user
 * has granted microphone permission at least once for the origin. The
 * `requestPermission()` helper triggers the standard prompt with
 * `getUserMedia({ audio: true })` and immediately stops the resulting
 * tracks (we only need the permission, not the stream).
 *
 * SSR-safe: every navigator access is gated behind `typeof navigator`.
 */

import { useCallback, useEffect, useState } from "react";

export interface AudioInputDevice {
  deviceId: string;
  label: string;
}

interface UseAudioDevicesResult {
  devices: AudioInputDevice[];
  permissionGranted: boolean;
  supported: boolean;
  requesting: boolean;
  permissionError: string | null;
  requestPermission: () => Promise<void>;
  refresh: () => Promise<void>;
}

const FALLBACK_LABEL = "Micrófono sin nombre";

export function useAudioDevices(): UseAudioDevicesResult {
  const [devices, setDevices] = useState<AudioInputDevice[]>([]);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  const enumerate = useCallback(async (): Promise<void> => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.enumerateDevices !== "function"
    ) {
      setSupported(false);
      return;
    }
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const audioInputs: AudioInputDevice[] = list
        .filter((d) => d.kind === "audioinput")
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || FALLBACK_LABEL,
        }));
      setDevices(audioInputs);
      // Permission is considered granted when at least one device exposes
      // a real label (browsers hide labels otherwise).
      setPermissionGranted(audioInputs.some((d) => d.label !== FALLBACK_LABEL));
    } catch (err) {
      // eslint-disable-next-line no-console -- diagnostic, no UX impact
      console.error("[susurra] enumerateDevices failed:", err);
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<void> => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function"
    ) {
      setSupported(false);
      return;
    }
    setRequesting(true);
    setPermissionError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      // Discard immediately — we only needed the permission grant.
      stream.getTracks().forEach((t) => t.stop());
      await enumerate();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "No pudimos acceder al micrófono.";
      setPermissionError(
        `No pudimos acceder al micrófono: ${msg}. Revisá los permisos del navegador.`,
      );
    } finally {
      setRequesting(false);
    }
  }, [enumerate]);

  useEffect(() => {
    void enumerate();
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.addEventListener !== "function"
    ) {
      return;
    }
    const handler = (): void => {
      void enumerate();
    };
    navigator.mediaDevices.addEventListener("devicechange", handler);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", handler);
    };
  }, [enumerate]);

  return {
    devices,
    permissionGranted,
    supported,
    requesting,
    permissionError,
    requestPermission,
    refresh: enumerate,
  };
}
