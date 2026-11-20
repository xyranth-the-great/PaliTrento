import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { G, Rect, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './ui';
import { peso } from '../lib/constants';
import { COLORS, FONTS, RADIUS, SHADOW } from '../lib/theme';

export interface DemoPaymentConfig {
  amount: number;
  title: string;
  description: string;
  successMessage: string;
  onPay: () => Promise<void>;
  onDone?: () => void;
}

type Step = 'qr' | 'processing' | 'success' | 'error';

/** Exact deterministic decorative DEMO QR code from website dashboard.js */
function DemoQrGraphic({ size = 180 }: { size?: number }) {
  const { rects, viewSize } = useMemo(() => {
    const grid = 21;
    const quiet = 3;
    const modules = Array.from({ length: grid }, () => Array(grid).fill(false));
    const reserved = new Set<number>();
    const out: { x: number; y: number }[] = [];

    const reserve = (x: number, y: number) => {
      if (x >= 0 && x < grid && y >= 0 && y < grid) reserved.add(y * grid + x);
    };

    const placeFinder = (left: number, top: number) => {
      for (let y = top - 1; y <= top + 7; y++) {
        for (let x = left - 1; x <= left + 7; x++) reserve(x, y);
      }
      for (let y = 0; y < 7; y++) {
        for (let x = 0; x < 7; x++) {
          modules[top + y][left + x] =
            x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4);
        }
      }
    };

    placeFinder(0, 0);
    placeFinder(grid - 7, 0);
    placeFinder(0, grid - 7);

    for (let i = 8; i < grid - 8; i++) {
      reserve(i, 6);
      reserve(6, i);
      modules[6][i] = i % 2 === 0;
      modules[i][6] = i % 2 === 0;
    }

    let state = 0x6d2b79f5;
    const nextBit = () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return (state & 1) === 1;
    };

    for (let y = 0; y < grid; y++) {
      for (let x = 0; x < grid; x++) {
        const pos = y * grid + x;
        if (!reserved.has(pos)) modules[y][x] = nextBit();
        if (modules[y][x]) out.push({ x: x + quiet, y: y + quiet });
      }
    }

    return { rects: out, viewSize: grid + quiet * 2 };
  }, []);

  return (
    <View style={styles.qrFrame}>
      <Svg width={size} height={size} viewBox={`0 0 ${viewSize} ${viewSize}`}>
        <Rect width={viewSize} height={viewSize} fill="#FFFFFF" />
        <G fill="#14351F">
          {rects.map((r) => (
            <Rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={1.02} height={1.02} />
          ))}
        </G>
        <Rect
          x={viewSize / 2 - 4.5}
          y={viewSize / 2 - 1.5}
          width={9}
          height={3}
          rx={0.5}
          fill="#FFFFFF"
          stroke="#D7DFD9"
          strokeWidth={0.25}
        />
        <SvgText
          x={viewSize / 2}
          y={viewSize / 2 + 0.55}
          fill="#14351F"
          fontSize={1.55}
          fontWeight="bold"
          textAnchor="middle"
        >
          DEMO
        </SvgText>
      </Svg>
    </View>
  );
}

export function DemoPaymentModal({
  config,
  onClose,
}: {
  config: DemoPaymentConfig | null;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>('qr');
  const [countdown, setCountdown] = useState(3);
  const [errorMsg, setErrorMsg] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    if (config) {
      clearTimer();
      setStep('qr');
      setCountdown(3);
      setErrorMsg('');
    } else {
      clearTimer();
    }
    return clearTimer;
  }, [config]);

  const handleSimulatePay = () => {
    if (!config || step === 'processing') return;
    clearTimer();
    setStep('processing');
    let left = 3;
    setCountdown(left);

    timerRef.current = setInterval(async () => {
      left -= 1;
      if (left > 0) {
        setCountdown(left);
        return;
      }
      clearTimer();
      try {
        await config.onPay();
        setStep('success');
        let closeLeft = 4;
        setCountdown(closeLeft);
        timerRef.current = setInterval(() => {
          closeLeft -= 1;
          if (closeLeft <= 0) {
            clearTimer();
            const after = config.onDone;
            onClose();
            after?.();
          } else {
            setCountdown(closeLeft);
          }
        }, 1000);
      } catch (e: any) {
        setErrorMsg(e?.message || 'Could not complete this payment. Please try again.');
        setStep('error');
      }
    }, 1000);
  };

  const handleFinishNow = () => {
    clearTimer();
    const after = config?.onDone;
    onClose();
    after?.();
  };

  const handleCancel = () => {
    if (step === 'processing') return;
    clearTimer();
    onClose();
  };

  if (!config) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleCancel}>
      <View style={styles.backdrop}>
        <Pressable style={styles.scrim} onPress={handleCancel} />
        <View style={styles.card}>
          {step === 'qr' && (
            <>
              <View style={styles.topRow}>
                <View style={styles.demoPill}>
                  <Ionicons name="qr-code-outline" size={12} color={COLORS.primary} />
                  <Text style={styles.demoPillText}>DEMO CHECKOUT</Text>
                </View>
                <Pressable onPress={handleCancel} style={styles.closeBtn} hitSlop={8}>
                  <Ionicons name="close" size={18} color={COLORS.ink} />
                </Pressable>
              </View>

              <Text style={styles.title}>{config.title}</Text>
              <Text style={styles.desc}>{config.description}</Text>

              <View style={styles.amountBox}>
                <Text style={styles.amountLabel}>Amount due</Text>
                <Text style={styles.amountVal}>{peso(config.amount)}</Text>
              </View>

              <DemoQrGraphic size={172} />

              <Text style={styles.hint}>
                Demo mode — tap the button below to simulate scanning & paying via QR Ph / GCash.
              </Text>

              <Button
                title={`Simulate scan & pay ${peso(config.amount)}`}
                icon="checkmark-circle-outline"
                onPress={handleSimulatePay}
              />
              <Button title="Cancel" variant="outline" small onPress={handleCancel} />
            </>
          )}

          {step === 'processing' && (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.title}>Verifying payment…</Text>
              <Text style={styles.desc}>
                Confirming your {peso(config.amount)} demo payment ({countdown}s)
              </Text>
            </View>
          )}

          {step === 'success' && (
            <View style={styles.centerState}>
              <View style={styles.okIcon}>
                <Ionicons name="checkmark-circle" size={44} color={COLORS.ok} />
              </View>
              <Text style={styles.title}>Payment Confirmed</Text>
              <Text style={styles.desc}>{config.successMessage}</Text>
              <Text style={styles.hint}>Closing in {countdown}s…</Text>
              <Button
                title="Done"
                onPress={handleFinishNow}
                style={{ alignSelf: 'stretch', marginTop: 4 }}
              />
            </View>
          )}

          {step === 'error' && (
            <View style={styles.centerState}>
              <View style={styles.badIcon}>
                <Ionicons name="alert-circle" size={42} color={COLORS.bad} />
              </View>
              <Text style={styles.title}>Payment Failed</Text>
              <Text style={styles.desc}>{errorMsg}</Text>
              <View style={styles.errActions}>
                <Button title="Cancel" variant="outline" onPress={handleCancel} style={{ flex: 1 }} />
                <Button title="Try again" onPress={() => setStep('qr')} style={{ flex: 1 }} />
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 18,
    position: 'relative',
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(17, 29, 21, 0.6)',
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    padding: 18,
    gap: 11,
    ...SHADOW.floating,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  demoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  demoPillText: {
    fontSize: 10,
    fontFamily: FONTS.extrabold,
    letterSpacing: 0.7,
    color: COLORS.primary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontFamily: FONTS.extrabold,
    color: COLORS.ink,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  desc: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 19,
  },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  amountLabel: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.muted },
  amountVal: { fontSize: 20, fontFamily: FONTS.extrabold, color: COLORS.primary },
  qrFrame: {
    alignSelf: 'center',
    padding: 8,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.line,
  },
  hint: {
    fontSize: 11.5,
    fontFamily: FONTS.medium,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 16,
  },
  centerState: {
    alignItems: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  okIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: COLORS.okBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: COLORS.badBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errActions: {
    flexDirection: 'row',
    gap: 10,
    alignSelf: 'stretch',
    marginTop: 6,
  },
});
