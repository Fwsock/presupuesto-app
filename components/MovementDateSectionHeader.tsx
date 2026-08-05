import { Text, View } from 'react-native';
import { formatSectionHeaderDate, formatISODate } from '../features/movements/date';

interface MovementDateSectionHeaderProps {
  fecha: string;
  totalDelDia: number;
}

export function MovementDateSectionHeader({ fecha, totalDelDia }: MovementDateSectionHeaderProps) {
  const todayISO = formatISODate(new Date());
  const isNegative = totalDelDia < 0;
  return (
    <View className="flex-row items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
      <Text className="text-xs font-semibold text-gray-500 uppercase">
        {formatSectionHeaderDate(fecha, todayISO)}
      </Text>
      <Text className={`text-xs font-semibold ${isNegative ? 'text-red-500' : 'text-green-600'}`}>
        {isNegative ? '-' : '+'}${Math.abs(totalDelDia).toLocaleString('es-CL')}
      </Text>
    </View>
  );
}
