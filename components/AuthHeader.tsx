import { View, Text, Image } from 'react-native';

interface AuthHeaderProps {
  subtitle: string;
}

/** Shared brand header for Login/Registro: app icon + "FinanFlow" + a per-screen subtitle. */
export function AuthHeader({ subtitle }: AuthHeaderProps) {
  return (
    <View className="items-center mb-6">
      <View className="w-20 h-20 rounded-3xl overflow-hidden mb-3">
        <Image source={require('../assets/icon.png')} className="w-full h-full" resizeMode="cover" />
      </View>
      <Text className="text-2xl font-bold text-ink">FinanFlow</Text>
      <Text className="text-gray-500 mt-1 text-center">{subtitle}</Text>
    </View>
  );
}
