import ScanCatalog from '@/screens/ScanCatalog';
import { color_pallet } from '@/styles/colors';
import { typography } from '@/styles/typography';
import { Text, View } from 'react-native';

export default function OwnerSettings() {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 }}>
        <Text style={[typography.eyebrow, { color: color_pallet.ink[500] }]}>Settings</Text>
        <Text style={[typography.h2, { color: color_pallet.ink[900], marginTop: 4 }]}>
          Setup scans
        </Text>
      </View>
      <ScanCatalog />
    </View>
  );
}
