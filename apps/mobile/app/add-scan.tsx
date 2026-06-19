import React from 'react';
import { TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AddScan() {
  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark px-4 pt-2">
      <View className="bg-surface dark:bg-surface-dark rounded-sm border border-stone-200" style={{ paddingHorizontal: 16 }}>
        <TextInput placeholder="Room name" placeholderTextColor="#757170" style={{ height: 52 }} />
      </View>
    </SafeAreaView>
  );
}
