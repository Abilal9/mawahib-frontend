import React, { useState } from 'react';
import { backIcon } from '../../i18n/direction';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import ScreenContainer from '../../components/ui/ScreenContainer';
import Button from '../../components/ui/Button';
import { colors, spacing, radius, typography } from '../../theme';
import { ScreenProps } from '../../navigation/types';

const TOOLS = [
  { id: 'crop', icon: 'crop-outline' as const, label: 'Crop' },
  { id: 'filter', icon: 'color-filter-outline' as const, label: 'Filter' },
  { id: 'adjust', icon: 'options-outline' as const, label: 'Adjust' },
  { id: 'text', icon: 'text-outline' as const, label: 'Text' },
  { id: 'draw', icon: 'brush-outline' as const, label: 'Draw' },
];

export default function PhotoEditScreen({ navigation }: ScreenProps<'PhotoEdit'>) {
  const [activeTool, setActiveTool] = useState('filter');

  return (
    <ScreenContainer padded={false} backgroundColor="#000">
      <StatusBar style="light" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name={backIcon()} size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Photo</Text>
        <Button title="Done" size="sm" onPress={() => navigation.navigate('PostCreate')} />
      </View>

      <View style={styles.preview}>
        <Image
          source={{ uri: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&h=500&fit=crop' }}
          style={styles.previewImage}
          contentFit="contain"
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolbar}>
        {TOOLS.map((tool) => (
          <TouchableOpacity
            key={tool.id}
            style={[styles.tool, activeTool === tool.id && styles.toolActive]}
            onPress={() => setActiveTool(tool.id)}
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
  preview: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  previewImage: { width: '100%', height: '80%' },
  toolbar: { paddingHorizontal: spacing.screen, paddingVertical: spacing.lg, gap: spacing.lg },
  tool: { alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md },
  toolActive: {},
  toolLabel: { ...typography.caption, color: colors.white + '80' },
  toolLabelActive: { color: colors.primary },
});
