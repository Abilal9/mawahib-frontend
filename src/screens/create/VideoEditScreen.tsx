import React, { useState } from 'react';
import { backIcon } from '../../i18n/direction';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import ScreenContainer from '../../components/ui/ScreenContainer';
import Button from '../../components/ui/Button';
import { colors, spacing, typography } from '../../theme';
import { ScreenProps } from '../../navigation/types';

const TOOLS = [
  { id: 'trim', icon: 'cut-outline' as const, label: 'Trim' },
  { id: 'filter', icon: 'color-filter-outline' as const, label: 'Filter' },
  { id: 'music', icon: 'musical-notes-outline' as const, label: 'Music' },
  { id: 'text', icon: 'text-outline' as const, label: 'Text' },
  { id: 'speed', icon: 'speedometer-outline' as const, label: 'Speed' },
];

export default function VideoEditScreen({ navigation }: ScreenProps<'VideoEdit'>) {
  const [activeTool, setActiveTool] = useState('trim');

  return (
    <ScreenContainer padded={false} backgroundColor="#000">
      <StatusBar style="light" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name={backIcon()} size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Video</Text>
        <Button title="Next" size="sm" onPress={() => navigation.navigate('VideoTrim', {})} />
      </View>

      <View style={styles.preview}>
        <Ionicons name="play-circle" size={64} color={colors.white + '80'} />
        <Text style={styles.duration}>0:12</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolbar}>
        {TOOLS.map((tool) => (
          <TouchableOpacity
            key={tool.id}
            style={styles.tool}
            onPress={() => {
              setActiveTool(tool.id);
              if (tool.id === 'trim') navigation.navigate('VideoTrim', {});
            }}
            activeOpacity={0.8}
          >
            <Ionicons name={tool.icon} size={22} color={activeTool === tool.id ? colors.primary : colors.white} />
            <Text style={[styles.toolLabel, activeTool === tool.id && styles.toolLabelActive]}>{tool.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
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
  duration: { ...typography.body, color: colors.white + '80', marginTop: spacing.md },
  toolbar: { paddingHorizontal: spacing.screen, paddingVertical: spacing.lg, gap: spacing.lg },
  tool: { alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md },
  toolLabel: { ...typography.caption, color: colors.white + '80' },
  toolLabelActive: { color: colors.primary },
});
