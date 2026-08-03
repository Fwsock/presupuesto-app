import { useState } from 'react';
import { View, Text, FlatList, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMovements, useUpdateMovement, useDeleteMovement, useDeleteMovementGroup } from '../../features/movements/hooks';
import { useCategories } from '../../features/categories/hooks';
import { MonthSelector } from '../../components/MonthSelector';
import { MovementListItem } from '../../components/MovementListItem';
import { ErrorBanner } from '../../components/ErrorBanner';
import { CategoryFilterChips } from '../../components/CategoryFilterChips';
import { VariableIncomePromptModal } from '../../components/VariableIncomePromptModal';
import { useSelectedMonth } from '../../features/shared/selected-month';
import { useVariableIncomePromptState } from '../../features/income/hooks';
import { useMovementModal } from '../../features/shared/movement-modal-context';
import { MONTH_NAMES } from '../../features/shared/monthNames';
import type { Movement } from '../../features/movements/types';

export default function MovimientosScreen() {
  const router = useRouter();
  const { year, month, setMonth } = useSelectedMonth();
  // Set when the user taps a category on Resumen (drill-down to that category).
  const { categoryId } = useLocalSearchParams<{ categoryId?: string }>();

  const { data: movements, isLoading, isError, refetch } = useMovements(year, month);
  const { data: categories } = useCategories();
  const updateMovement = useUpdateMovement();
  const deleteMovement = useDeleteMovement();
  const deleteMovementGroup = useDeleteMovementGroup();
  const { openEdit } = useMovementModal();

  const [actionError, setActionError] = useState<string | null>(null);

  const toggleEstado = (movement: Movement) => {
    setActionError(null);
    updateMovement.mutate(
      {
        id: movement.id,
        categoryId: movement.category_id,
        concepto: movement.concepto,
        monto: movement.monto,
        notas: movement.notas,
        fecha: movement.fecha,
        icono: movement.icono,
        estado: movement.estado === 'pagado' ? 'pendiente' : 'pagado',
      },
      {
        onError: (err) => setActionError((err as Error).message),
      }
    );
  };

  const handleDelete = (id: string) => {
    setActionError(null);
    const movement = movements?.find((m) => m.id === id);
    if (!movement) return;

    const onDeleteError = (err: unknown) => setActionError((err as Error).message);
    const conceptoTrimmed = movement.concepto.trim();
    const cuotaLabel =
      movement.cuota_numero && movement.cuota_total
        ? ` (cuota ${movement.cuota_numero}/${movement.cuota_total})`
        : '';

    if (movement.recurring_income_id) {
      const monthIndex = Number(movement.fecha.slice(5, 7)) - 1;
      const mesLabel = `${MONTH_NAMES[monthIndex]} ${movement.fecha.slice(0, 4)}`;
      Alert.alert(
        '⚠️ Advertencia',
        `Estás a punto de eliminar tu ingreso mensual. ¿Estás completamente seguro que deseas eliminar el monto de $${movement.monto.toLocaleString('es-CL')} correspondiente a ${mesLabel}?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar', style: 'destructive', onPress: () => deleteMovement.mutate(id, { onError: onDeleteError }) },
        ]
      );
    } else if (movement.installment_group_id) {
      Alert.alert(
        'Eliminar compra en cuotas',
        `"${conceptoTrimmed}"${cuotaLabel}. ¿Qué deseas eliminar?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar solo esta cuota',
            style: 'destructive',
            onPress: () => deleteMovement.mutate(id, { onError: onDeleteError }),
          },
          {
            text: 'Eliminar toda la compra',
            style: 'destructive',
            onPress: () => deleteMovementGroup.mutate(movement.installment_group_id!, { onError: onDeleteError }),
          },
        ]
      );
    } else {
      Alert.alert(
        'Eliminar movimiento',
        `¿Estás seguro que deseas eliminar "${conceptoTrimmed}"?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: () => deleteMovement.mutate(id, { onError: onDeleteError }),
          },
        ]
      );
    }
  };

  // Filter only what's rendered -- the query itself stays unfiltered so the
  // screen behaves normally when there's no categoryId param.
  const visibleMovements = categoryId
    ? movements?.filter((m) => m.category_id === categoryId)
    : movements;

  const variableIncomePrompt = useVariableIncomePromptState(year, month);

  return (
    <View className="flex-1 bg-white">
      <MonthSelector year={year} month={month} onChange={setMonth} />

      {categories && (
        <CategoryFilterChips
          categories={categories}
          selectedCategoryId={categoryId}
          onSelect={(id) =>
            id ? router.replace({ pathname: '/movimientos', params: { categoryId: id } }) : router.replace('/movimientos')
          }
        />
      )}

      {isError && <ErrorBanner message="No se pudieron cargar los movimientos." onRetry={refetch} />}
      {actionError && (
        <ErrorBanner message={actionError} onRetry={() => setActionError(null)} actionLabel="Descartar" />
      )}

      {isLoading ? (
        <Text className="p-4">Cargando...</Text>
      ) : visibleMovements && visibleMovements.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-400 text-center px-8">No hay movimientos registrados para este mes.</Text>
        </View>
      ) : (
        <FlatList
          className="flex-1"
          data={visibleMovements}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MovementListItem
              movement={item}
              category={categories?.find((c) => c.id === item.category_id)}
              onToggleEstado={() => toggleEstado(item)}
              onEdit={() => openEdit(item)}
              onDelete={() => handleDelete(item.id)}
              isUpdating={updateMovement.isPending && updateMovement.variables?.id === item.id}
            />
          )}
        />
      )}

      <VariableIncomePromptModal
        visible={variableIncomePrompt.visible}
        concepto={variableIncomePrompt.concepto}
        year={year}
        month={month}
        loading={variableIncomePrompt.loading}
        error={variableIncomePrompt.error}
        onSubmit={variableIncomePrompt.submit}
        onSkip={variableIncomePrompt.skip}
        onDismissError={variableIncomePrompt.dismissError}
      />
    </View>
  );
}
