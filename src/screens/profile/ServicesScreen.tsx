import React from 'react';
import { backIcon } from '../../i18n/direction';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { toImageSource } from '../../utils/image';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ScreenContainer from '../../components/ui/ScreenContainer';
import CurrencyIcon from '../../components/ui/CurrencyIcon';
import { colors, spacing, radius, typography } from '../../theme';
import { catalogService, userService } from '../../services';
import { RootStackParamList } from '../../navigation/types';

type Props = {
  route: { params?: { userId?: string } };
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

/** Unregistered in RootNavigator — kept for optional reuse. */
export default function ServicesScreen({ route, navigation }: Props) {
  const user = route.params?.userId ? userService.getByIdSync(route.params.userId) : undefined;
  const services = catalogService.listServices();
  const list = user
    ? services.filter((service) => service.provider.id === user.id)
    : services;

  return (
    <ScreenContainer padded={false}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name={backIcon()} size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {user ? `${user.name.split(' ')[0]}'s Services` : 'Services'}
        </Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate('AddProfileService')}
        >
          <Ionicons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.empty}>No services listed yet.</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('ServiceDetail', { serviceId: item.id })}
            activeOpacity={0.8}
          >
            <Image source={toImageSource(item.images[0])} style={styles.image} contentFit="cover" />
            <View style={styles.info}>
              {item.category ? (
                <Text style={styles.category}>{item.category}</Text>
              ) : null}
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
              <View style={styles.footer}>
                {item.price != null ? (
                  <View style={styles.priceRow}>
                    <CurrencyIcon
                      size={14}
                      color={colors.primary}
                      currency={
                        item.currency === 'AED' || item.currency === 'SAR'
                          ? item.currency
                          : null
                      }
                      location={
                        item.currency === 'AED' || item.currency === 'SAR'
                          ? null
                          : item.provider.location
                      }
                    />
                    <Text style={styles.price}>
                      {item.price.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </Text>
                  </View>
                ) : null}
                {(item.reviewCount ?? 0) > 0 ? (
                  <View style={styles.rating}>
                    <Ionicons name="star" size={14} color={colors.warning} />
                    <Text style={styles.ratingText}>{item.rating} ({item.reviewCount})</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.screen, paddingVertical: spacing.md,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.h3, color: colors.text },
  list: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xxxl },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: 'center', paddingTop: spacing.xxl },
  card: {
    backgroundColor: colors.white, borderRadius: radius.card,
    marginBottom: spacing.md, overflow: 'hidden',
    borderWidth: 1, borderColor: colors.borderLight,
  },
  image: { width: '100%', height: 140 },
  info: { padding: spacing.lg },
  category: { ...typography.caption, color: colors.primary, marginBottom: spacing.xs },
  title: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  description: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 20 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  price: { ...typography.label, color: colors.primary },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { ...typography.caption, color: colors.textSecondary },
});
