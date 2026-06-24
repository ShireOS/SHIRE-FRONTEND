import { PlushyButton } from '@/components/PlushyButton';
import { ScanCard } from '@/components/ScanCard';
import { createScan, type Scan } from '@/models/scan';
import { color_pallet } from '@/styles/colors';
import { typography } from '@/styles/typography';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Text, View } from 'react-native';

type ScanCatalogProps = {
  // When rendered inside a parent ScrollView, avoid nesting a VirtualizedList.
  embedded?: boolean;
};

export default function ScanCatalog({ embedded = false }: ScanCatalogProps) {
  const [scans, setScans] = useState<Scan[]>([
    createScan({ roomName: 'Test 123', capturedDate: new Date(), type: 'deployed' }),
    createScan({ roomName: 'Test 123', capturedDate: new Date(), type: 'processing' }),
    createScan({ roomName: 'Test 123', capturedDate: new Date(), type: 'uploaded' }),
  ]);
  const router = useRouter();

  const handleAddScan = () => {
    router.push('/add-scan');
  };

  const handleDelete = (id: string) => {
    setScans((prev) => prev.filter((scan) => scan.id !== id));
  };

  const addButton = (
    <View style={{ marginBottom: 10 }}>
      <PlushyButton
        onPress={handleAddScan}
        accessibilityLabel="Add new scan"
        style={{
          backgroundColor: color_pallet.elevated.dark,
          borderRadius: 12,
          paddingVertical: 14,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          marginTop: 10,
        }}
      >
        <Feather name="camera" size={20} color="#FFFFFF" />
        <View style={{ width: 10 }} />
        <Text style={[typography.h3, { color: '#FFFFFF' }]}>Add New Scan</Text>
      </PlushyButton>
    </View>
  );

  if (embedded) {
    return (
      <View>
        {addButton}
        {scans.map((item, index) => (
          <View key={item.id} style={index > 0 ? { marginTop: 10 } : undefined}>
            <ScanCard data={item} onDelete={() => handleDelete(item.id)} />
          </View>
        ))}
      </View>
    );
  }

  return (
    <FlatList
      data={scans}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      ListHeaderComponent={addButton}
      renderItem={({ item }) => (
        <ScanCard data={item} onDelete={() => handleDelete(item.id)} />
      )}
    />
  );
}
