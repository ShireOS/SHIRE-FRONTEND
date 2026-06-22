import { color_pallet } from '@/styles/colors';
import { typography } from '@/styles/typography';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Image, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LiquidGlassTabBar } from '@/components/LiquidGlassTabBar';

export default function RootLayout() {
    const pfp = "https://static.vecteezy.com/system/resources/thumbnails/075/640/866/small/man-sitting-at-cafe-table-with-camera-and-tableware-in-foreground-urban-leisure-creative-lifestyle-streetgraphy-and-relaxed-social-atmosphere-photo.jpg"
    return (
        <SafeAreaView 
        edges={['top']}
        style={{ flex: 1, backgroundColor: color_pallet.bg.DEFAULT, justifyContent: "flex-start"}}
        >
            <View style={{ 
                backgroundColor: color_pallet.bg.DEFAULT, 
                marginLeft: 16, 
                marginRight: 16, 
                marginBottom: 16,
                flex: 0, 
                flexDirection: 'row', 
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <Image
                    source={{ 
                        uri: pfp
                    }}
                    style={{
                    height: 45, 
                    width: 45, 
                    borderRadius: 5,
                    borderWidth: 2, 
                    borderColor: color_pallet.elevated.dark
                    }}
                />
                <Text style={[{...typography.h1, fontSize: 29}, { color: '#151313'}]}>Shire</Text>
                <View style={{width: 49}}></View>
            </View>
        </SafeAreaView>
    );
}