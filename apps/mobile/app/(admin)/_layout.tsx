import { color_pallet } from '@/styles/colors';
import { typography } from '@/styles/typography';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Image, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LiquidGlassTabBar } from '@/components/LiquidGlassTabBar';

export default function RootLayout() {
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
            source={{ uri: 'https://static.vecteezy.com/system/resources/thumbnails/075/640/866/small/man-sitting-at-cafe-table-with-camera-and-tableware-in-foreground-urban-leisure-creative-lifestyle-streetgraphy-and-relaxed-social-atmosphere-photo.jpg' }}
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
      <View style={{flex: 1}}>
        <BottomTabBar />
      </View>
    </SafeAreaView>
  );
}

function BottomTabBar() {
  return (
    <Tabs 
      screenOptions={
        {
          headerShown: false, 
          sceneStyle: { 
            backgroundColor: color_pallet.bg.DEFAULT 
          },
          tabBarStyle: {
            backgroundColor: color_pallet.bg.DEFAULT,
            paddingVertical: 5,
            paddingBottom: 0
          },
        }
      }
      tabBar={(props) => (
        <LiquidGlassTabBar {...props} />
      )}
    >
      <Tabs.Screen
        name="scans"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="scan" size={size} color={color}/>
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="analytics" size={size} color={color}/>
          ),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: 'Menu',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="menu" size={size} color={color}/>
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Schedule',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar" size={size} color={color}/>
          ),
        }}
      />
    </Tabs>
  );
}
