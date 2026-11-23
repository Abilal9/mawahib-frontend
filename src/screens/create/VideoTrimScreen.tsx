import React, { useState } from 'react';
import { backIcon } from '../../i18n/direction';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import ScreenContainer from '../../components/ui/ScreenContainer';
import Button from '../../components/ui/Button';
import { colors, spacing, radius, typography } from '../../theme';
import { ScreenProps } from '../../navigation/types';

export default function VideoTrimScreen({ navigation }: ScreenProps<'VideoTrim'>) {
  const [startPos] = useState(0.1);
  const [endPos] = useState(0.8);

  return (
    <ScreenContainer padded={false} backgroundColor="#000">
      <StatusBar style="light" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name={backIcon()} size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trim Video</Text>
        <Button title="Done" size="sm" onPress={() => navigation.navigate('PostCreate')} />
      </View>

      <View style={styles.preview}>
        <Ionicons name="play-circle" size={48} color={colors.white + '80'} />
      </View>

      <View style={styles.trimSection}>
        <Text style={styles.trimLabel}>Drag handles to trim</Text>
        <View style={styles.timeline}>
          {Array.from({ length: 12 }).map((_, i) => (
            <View key={i} style={styles.thumbnail} />
          ))}
          <View style={[styles.trimOverlay, { left: `${startPos * 100}%` }]} />
          <View style={[styles.trimOverlay, { right: `${(1 - endPos) * 100}%` }]} />
          <View style={[styles.trimHandle, { left: `${startPos * 100}%` }]} />
          <View style={[styles.trimHandle, { left: `${endPos * 100}%` }]} />
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>0:01</Text>
          <Text style={styles.timeText}>0:10</Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.md,
  },
  headerTitle: { ...typography.h3, color: colors.white },
  preview: { flex: 1, backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center', margin: spacing.sm, borderRadius: 12 },
  trimSection: { padding: spacing.screen, paddingBottom: spacing.xxxl },
  trimLabel: { ...typography.caption, color: colors.white + '80', marginBottom: spacing.md },
  timeline: { height: 56, flexDirection: 'row', borderRadius: radius.button, overflow: 'hidden', position: 'relative' },
  thumbnail: { flex: 1, backgroundColor: '#333', borderRightWidth: 1, borderRightColor: '#444' },
  trimOverlay: { position: 'absolute', top: 0, bottom: 0, width: '20%', backgroundColor: 'rgba(0,0,0,0.6)' },
  trimHandle: { position: 'absolute', top: 0, bottom: 0, width: 4, backgroundColor: colors.primary, marginLeft: -2 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  timeText: { ...typography.caption, color: colors.white + '80' },
});
