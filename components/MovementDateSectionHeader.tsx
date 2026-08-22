import { Text, View } from 'react-native';
import { formatSectionHeaderDate } from '../features/movements/date';

interface MovementDateSectionHeaderProps {
  fecha: string;
  totalDelDia: number;
  todayISO: string;
}

export function MovementDateSectionHeader({ fecha, totalDelDia, todayISO }: MovementDateSectionHeaderProps) {
  const isNegative = totalDelDia < 0;
  return (
    // Floats directly on the page background (bg-background), like a real
    // neobanco statement's date group label -- not boxed in its own gray
    // strip, which used to read as a second, competing surface right above
    // the actual white row cards.
    <View className="flex-row items-center justify-between px-4 pt-5 pb-2 bg-background">
      <Text className="text-xs font-jakarta-semibold text-secondary uppercase tracking-wide">
        {formatSectionHeaderDate(fecha, todayISO)}
      </Text>
      <Text
        className={`text-xs font-jakarta-semibold ${isNegative ? 'text-danger' : 'text-income'}`}
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {isNegative ? '-' : '+'}${Math.abs(totalDelDia).toLocaleString('es-CL')}
      </Text>
    </View>
  );
}
