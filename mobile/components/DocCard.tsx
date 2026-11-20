import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, StatusPill, Tone } from './ui';
import { COLORS } from '../lib/theme';
import { reviewStyles as styles } from './reviewStyles';

interface DocCardProps {
  label: string;
  url?: string | null;
  status?: string | null;
  note?: string | null;
  canReview: boolean;
  busy: boolean;
  onPreview: (url: string) => void;
  onAccept: () => void;
  onDecline: () => void;
}

function docState(url?: string | null, status?: string | null): { text: string; tone: Tone } {
  if (!url) return { text: 'Not uploaded', tone: 'muted' };
  if (status === 'APPROVED') return { text: 'Approved', tone: 'ok' };
  if (status === 'REJECTED') return { text: 'Declined', tone: 'bad' };
  return { text: 'Awaiting review', tone: 'warn' };
}

export function DocCard({ label, url, status, note, canReview, busy, onPreview, onAccept, onDecline }: DocCardProps) {
  const state = docState(url, status);
  return (
    <Card style={{ gap: 10 }}>
      <View style={styles.docRow}>
        {url ? (
          <Pressable onPress={() => onPreview(url)}>
            <Image source={{ uri: url }} style={styles.docImg} />
          </Pressable>
        ) : (
          <View style={[styles.docImg, styles.docEmpty]}>
            <Ionicons name="document-outline" size={20} color={COLORS.muted} />
          </View>
        )}
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={styles.docLabel}>{label}</Text>
          <StatusPill label={state.text} tone={state.tone} />
          {note ? <Text style={styles.small}>Note: {note}</Text> : null}
        </View>
      </View>
      {url && canReview ? (
        <View style={styles.btnRow}>
          <Button title="Accept" icon="checkmark" small disabled={status === 'APPROVED'} loading={busy} onPress={onAccept} style={{ flex: 1 }} />
          <Button title="Decline" icon="close" variant="danger" small disabled={status === 'REJECTED'} onPress={onDecline} style={{ flex: 1 }} />
        </View>
      ) : null}
    </Card>
  );
}
