/**
 * AudioWorklet processor for real-time MFCC-based viseme extraction.
 *
 * This is a placeholder for the advanced audio worklet pipeline.
 * The current LipSyncEngine uses AnalyserNode FFT directly, which is
 * sufficient for v0.1. The worklet approach would offer lower latency
 * (~5ms vs ~20ms) and more accurate MFCC-based viseme classification.
 *
 * TODO(v0.2): Implement MFCC extraction in AudioWorklet for improved
 * lip-sync accuracy and lower latency.
 */
export const VISEME_WORKLET_AVAILABLE = false
