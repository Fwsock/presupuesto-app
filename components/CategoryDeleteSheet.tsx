import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedBottomSheet } from './AnimatedBottomSheet';
import { Button } from './Button';
import { CategoryIconBadge } from './CategoryIconBadge';
import { PressableScale } from './PressableScale';
import { categoryHasMovements } from '../features/categories/api';
import { getCategoryVisuals } from '../features/categories/visualMapper';
import { theme } from '../lib/theme';
import type { Category } from '../features/categories/types';

type DeleteStatus = 'checking' | 'confirm' | 'reassign' | 'blocked';

interface CategoryDeleteSheetProps {
  visible: boolean;
  category: Category | null;
  /** Every other category, precomputed by the parent with a cheap useMemo -- available the instant this opens, so only the has-movements check itself gates anything. */
  otherCategories: Category[];
  isSubmitting: boolean;
  onConfirmDelete: () => void;
  onReassignAndDelete: (targetCategoryId: string) => void;
  onClose: () => void;
}

/**
 * Single delete-flow sheet, replacing a plain ConfirmDialog (no movements)
 * vs. a separate reassign sheet (has movements) that used to be picked by an
 * AWAITED categoryHasMovements() call BEFORE anything opened -- that network
 * round-trip is exactly why Eliminar used to feel noticeably slower to
 * respond than Editar (which opens synchronously). This sheet instead opens
 * the instant Eliminar is tapped, same feel as Editar, and runs the check
 * internally while already visible -- a brief spinner covers the gap
 * instead of a blank pause before anything appears at all.
 */
export function CategoryDeleteSheet({
  visible,
  category,
  otherCategories,
  isSubmitting,
  onConfirmDelete,
  onReassignAndDelete,
  onClose,
}: CategoryDeleteSheetProps) {
  const [status, setStatus] = useState<DeleteStatus>('checking');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !category) return;
    setStatus('checking');
    setSelectedId(null);
    setCheckError(null);
    let cancelled = false;

    // All-time, not just the currently viewed month's cached movements — a
    // category with movements only in another month still needs the
    // reassign flow, not the plain confirm one (which would otherwise hit
    // an FK-violation at the actual delete instead).
    categoryHasMovements(category.id)
      .then((hasMovements) => {
        if (cancelled) return;
        if (!hasMovements) setStatus('confirm');
        else if (otherCategories.length === 0) setStatus('blocked');
        else setStatus('reassign');
      })
      .catch((err) => {
        if (cancelled) return;
        setCheckError((err as Error).message);
        setStatus('confirm');
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, category?.id]);

  if (!category) return null;

  return (
    <AnimatedBottomSheet visible={visible} onClose={onClose} maxHeightPercent={80}>
      {status === 'checking' && (
        <View className="items-center py-12">
          <ActivityIndicator color={theme.brand} />
          <Text className="font-jakarta text-secondary text-sm mt-3">Comprobando movimientos...</Text>
        </View>
      )}

      {status === 'confirm' && (
        <View className="px-4 pt-6 pb-8">
          <View className="items-center mb-3">
            <View
              className="w-14 h-14 rounded-full items-center justify-center mb-3"
              style={{ backgroundColor: `${theme.danger}1A` }}
            >
              <Ionicons name="trash-outline" size={28} color={theme.danger} />
            </View>
            <Text className="text-lg font-jakarta-bold text-center">¿Eliminar categoría?</Text>
          </View>
          {checkError && (
            <Text className="font-jakarta text-danger text-xs text-center mb-2">
              No se pudo comprobar si tiene movimientos ({checkError}) -- se pedirá confirmación de todos modos.
            </Text>
          )}
          <Text className="font-jakarta text-secondary text-center mb-5">
            ¿Estás seguro de que deseas eliminar "{category.nombre}"? Esta acción no se puede deshacer.
          </Text>
          <View style={{ gap: 10 }}>
            {/* Not the shared Button (only offers primary-blue/ghost) --
                a destructive delete keeps the same solid-red convention as
                ConfirmDialog's own 'destructive' variant everywhere else. */}
            <PressableScale
              onPress={onConfirmDelete}
              disabled={isSubmitting}
              scaleTo={0.965}
              activeOpacity={0.7}
              spring
              haptics
              className={`bg-danger rounded-2xl py-3 items-center justify-center ${isSubmitting ? 'opacity-60' : ''}`}
              accessibilityRole="button"
              accessibilityLabel="Eliminar"
            >
              {isSubmitting ? (
                <View className="flex-row items-center justify-center">
                  <ActivityIndicator size="small" color="#fff" />
                  <Text className="ml-2 text-center font-jakarta-semibold text-white">Eliminando...</Text>
                </View>
              ) : (
                <Text className="text-center font-jakarta-semibold text-white">Eliminar</Text>
              )}
            </PressableScale>
            <PressableScale
              onPress={onClose}
              className="py-3 items-center"
              accessibilityRole="button"
              accessibilityLabel="Cancelar"
            >
              <Text className="font-jakarta-medium text-secondary">Cancelar</Text>
            </PressableScale>
          </View>
        </View>
      )}

      {status === 'blocked' && (
        <View className="px-4 pt-6 pb-8">
          <Text className="text-lg font-jakarta-semibold mb-2">No se puede eliminar todavía</Text>
          <Text className="font-jakarta text-secondary mb-5">
            "{category.nombre}" tiene movimientos y es tu única categoría. Crea otra categoría antes de eliminarla.
          </Text>
          <Button title="Entendido" onPress={onClose} />
        </View>
      )}

      {status === 'reassign' && (
        <>
          <View className="px-4 pt-4 pb-2">
            <Text className="text-lg font-jakarta-semibold">Reasignar movimientos</Text>
            <Text className="font-jakarta text-secondary text-sm mt-1">
              "{category.nombre}" tiene movimientos asociados. Elige a qué categoría se moverán antes de eliminarla.
            </Text>
          </View>

          <FlatList
            data={otherCategories}
            keyExtractor={(c) => c.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
            renderItem={({ item }) => {
              const selected = item.id === selectedId;
              const visuals = getCategoryVisuals(item);
              return (
                <PressableScale
                  onPress={() => setSelectedId(item.id)}
                  scaleTo={0.98}
                  activeOpacity={0.8}
                  className={`flex-row items-center px-3 py-3 mb-2 rounded-2xl border ${
                    selected ? 'border-brand bg-blue-50' : 'border-border'
                  }`}
                  accessibilityRole="button"
                  accessibilityLabel={item.nombre}
                >
                  <CategoryIconBadge icono={visuals.icono} color={visuals.color} size={34} style={{ marginRight: 10 }} />
                  <Text className="flex-1 font-jakarta-medium">{item.nombre}</Text>
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={selected ? theme.brand : '#CBD5E1'}
                  />
                </PressableScale>
              );
            }}
          />

          <View className="px-4 pb-8 pt-2">
            <Button
              title="Reasignar y eliminar"
              onPress={() => selectedId && onReassignAndDelete(selectedId)}
              disabled={!selectedId || isSubmitting}
              loading={isSubmitting}
            />
          </View>
        </>
      )}
    </AnimatedBottomSheet>
  );
}
